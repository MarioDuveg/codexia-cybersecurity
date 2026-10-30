'use strict';

// Mini CTF de laboratorio. La validación y los tiempos viven en el servidor.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// Enrutador HTTP mínimo con APIs del núcleo de Node.js (sin paquetes externos).
// Solo sirve las rutas definidas aquí y los recursos permitidos de /public.
const routes = [];
const app = {
  get(pattern, ...handlers) { routes.push({ method: 'GET', pattern, handlers }); },
  post(pattern, ...handlers) { routes.push({ method: 'POST', pattern, handlers }); },
  listen(port, host, callback) { return http.createServer(handleRequest).listen(port, host, callback); },
};
function matchRoute(pattern, pathname) {
  const keys = [];
  const escaped = pattern.split('/').map(segment => {
    if (segment.startsWith(':')) { keys.push(segment.slice(1)); return '([^/]+)'; }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  const match = pathname.match(new RegExp('^' + escaped + '$'));
  if (!match) return null;
  return Object.fromEntries(keys.map((k, i) => [k, match[i + 1]]));
}
function appendCookie(res, header) {
  const old = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', old ? [...(Array.isArray(old) ? old : [old]), header] : [header]);
}
function decorateResponse(res) {
  res.status = function (code) { this.statusCode = code; return this; };
  res.send = function (value) {
    if (!this.hasHeader('Content-Type')) this.setHeader('Content-Type', 'text/html; charset=utf-8');
    this.end(String(value)); return this;
  };
  res.json = function (value) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(value)); return this;
  };
  res.sendFile = function (filepath) {
    fs.readFile(filepath, (err, contents) => {
      if (err) return this.status(404).send('Archivo no encontrado.');
      this.setHeader('Content-Type', 'text/html; charset=utf-8');
      this.end(contents);
    });
  };
  res.cookie = function (key, value, opts = {}) {
    let header = encodeURIComponent(key) + '=' + encodeURIComponent(value);
    header += '; Path=' + (opts.path || '/');
    if (opts.httpOnly) header += '; HttpOnly';
    if (opts.sameSite) header += '; SameSite=' + opts.sameSite;
    if (opts.secure) header += '; Secure';
    if (opts.maxAge !== undefined) header += '; Max-Age=' + Math.ceil(opts.maxAge / 1000);
    appendCookie(this, header);
  };
  res.clearCookie = function (key) { appendCookie(this, encodeURIComponent(key) + '=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'); };
}
async function handleRequest(req, res) {
  decorateResponse(res);
  req.ip = req.socket.remoteAddress || 'unknown';
  req.secure = Boolean(req.socket.encrypted);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/public/')) {
      if (req.method !== 'GET') return res.status(405).send('Método no permitido.');
      const name = pathname.slice('/public/'.length);
      if (!/^[a-z0-9_-]+\.(css|js|webp|png)$/.test(name)) return res.status(404).send('Archivo no encontrado.');
      const filepath = path.join(ROOT, 'public', name);
      const type = name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.webp') ? 'image/webp' : 'image/png';
      const data = await fs.promises.readFile(filepath).catch(() => null);
      if (!data) return res.status(404).send('Archivo no encontrado.');
      res.setHeader('Content-Type', type + '; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.end(data);
    }
    if (pathname.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString('utf8');
        if (body.length > 8192) return res.status(413).json({error:'Petición demasiado grande.'});
      }
      if (body && !(req.headers['content-type'] || '').startsWith('application/json')) {
        return res.status(415).json({error:'Se requiere JSON.'});
      }
      try { req.body = body ? JSON.parse(body) : {}; }
      catch { return res.status(400).json({error:'JSON inválido.'}); }
    }
    for (const route of routes) {
      if (req.method !== route.method) continue;
      const params = matchRoute(route.pattern, pathname);
      if (!params) continue;
      req.params = params;
      let index = 0;
      const next = () => {
        const handler = route.handlers[index++];
        if (handler) handler(req, res, next);
      };
      return next();
    }
    res.status(404).send('Ruta no encontrada.');
  } catch (err) {
    console.error('Error de petición:', err);
    if (!res.headersSent) res.status(500).json({error:'Error interno del servidor.'});
    else res.end();
  }
}

const PORT = Number(process.env.PORT) || 3011;
const ROOT = __dirname;
const DATA_DIR = process.env.CTF_DATA_DIR ? path.resolve(process.env.CTF_DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'equipos.json');
const KEY_FILE = path.join(DATA_DIR, '.clave-servidor');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
const ADMIN_GENERATED = !process.env.ADMIN_PASSWORD;
const COOKIE_TEAM = 'ctf_equipo';
const COOKIE_ADMIN = 'ctf_docente';
const MAX_ANSWER_LENGTH = 90;

// Claves de prácticas, inventadas; NUNCA utilizar credenciales reales.
const LEVELS = [
  { title: 'El comentario perdido', topic: 'HTML', password: 'Orion#73!n', hint: 'Abre este reto en otra pestaña y usa Ctrl+U, o examina el DOM con F12.' },
  { title: 'La señal invisible', topic: 'ELEMENTOS', password: 'V3l0c1dad@24', hint: 'Busca un elemento con display:none en la pestaña Elementos.' },
  { title: 'Dentro del diseño', topic: 'CSS', password: 'F1rewall-9X!', hint: 'En el código de la página hay una variable CSS que no controla ningún color.' },
  { title: 'Fragmentos de una clave', topic: 'JAVASCRIPT', password: 'R3d-S3gura_86!', hint: 'Inspecciona el script: reverse() invierte el arreglo y join("") une los fragmentos.' },
  { title: 'Acceso ROOT', topic: 'BASE64', password: 'R00t_Access#26', hint: 'Base64 NO es cifrado. En la consola del navegador puedes usar atob(tokenDeRespaldo).' },
];

fs.mkdirSync(DATA_DIR, { recursive: true });
const serverKey = fs.existsSync(KEY_FILE)
  ? fs.readFileSync(KEY_FILE, 'utf8').trim()
  : crypto.randomBytes(32).toString('hex');
if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, serverKey + '\n', { mode: 0o600 });
let db = { version: 1, teams: [] };
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!Array.isArray(db.teams)) throw new Error('La base de datos no contiene equipos válidos.');
}

function save() {
  const tmp = DB_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hmac(value) { return crypto.createHmac('sha256', serverKey).update(value).digest('hex'); }
function safeEqual(a, b) {
  const aa = Buffer.from(sha256(a), 'hex');
  const bb = Buffer.from(sha256(b), 'hex');
  return crypto.timingSafeEqual(aa, bb);
}
function getCookies(req) {
  const all = {};
  for (const item of (req.headers.cookie || '').split(';')) {
    const split = item.indexOf('=');
    if (split < 0) continue;
    const key = item.slice(0, split).trim();
    const value = item.slice(split + 1).trim();
    try { all[key] = decodeURIComponent(value); } catch { /* cookie malformada */ }
  }
  return all;
}
function setCookie(res, key, value, seconds, req) {
  res.cookie(key, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: seconds * 1000,
  });
}
function teamFromReq(req) {
  const token = getCookies(req)[COOKIE_TEAM];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const digest = sha256(token);
  return db.teams.find(t => t.tokenHash === digest) || null;
}
function adminFromReq(req) {
  const token = getCookies(req)[COOKIE_ADMIN];
  if (!token) return false;
  const chunks = token.split('.');
  if (chunks.length !== 4) return false;
  const [version, expiry, nonce, signature] = chunks;
  if (version !== 'v1' || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now()) return false;
  if (!/^[a-f0-9]{24}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = hmac(version + '.' + expiry + '.' + nonce);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
function requireAdmin(req, res, next) {
  if (!adminFromReq(req)) return res.status(401).json({ error: 'Acceso exclusivo del docente.' });
  next();
}
function htmlEsc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function elapsed(t, now = Date.now()) { return (t.completedAt || now) - t.startedAt; }
function nameKey(name) { return name.normalize('NFC').toLocaleLowerCase('es-MX'); }
const wrongAttempts = new Map();
const adminAttempts = new Map();
function isRateLimited(map, key, max, windowMs) {
  const now = Date.now();
  const previous = (map.get(key) || []).filter(x => now - x < windowMs);
  if (previous.length >= max) { map.set(key, previous); return true; }
  previous.push(now);
  map.set(key, previous);
  return false;
}
function requireApiTeam(req, res, next) {
  const team = teamFromReq(req);
  if (!team) return res.status(401).json({ error: 'Primero inicia la misión con tu equipo.' });
  req.team = team;
  next();
}


app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));

app.get('/api/state', (req, res) => {
  const team = teamFromReq(req);
  if (!team) return res.json({ started: false, serverNow: Date.now() });
  const finishers = db.teams.filter(t => t.completedAt).sort((a, b) => elapsed(a) - elapsed(b) || a.completedAt - b.completedAt);
  const rank = team.completedAt ? finishers.findIndex(t => t.id === team.id) + 1 : null;
  res.json({
    started: true,
    serverNow: Date.now(),
    name: team.name,
    startedAt: team.startedAt,
    completedAt: team.completedAt,
    elapsedMs: elapsed(team),
    currentLevel: team.currentLevel,
    solved: team.solved,
    rank,
  });
});

app.post('/api/start', (req, res) => {
  const existing = teamFromReq(req);
  if (existing) return res.json({ ok: true, alreadyStarted: true });
  const name = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim().normalize('NFC') : '';
  if (name.length < 2 || name.length > 32 || !/^[\p{L}\p{N} ._#-]+$/u.test(name)) {
    return res.status(400).json({ error: 'Usa un nombre de 2 a 32 caracteres: letras, números, espacios, punto, guion o #.' });
  }
  if (db.teams.some(t => nameKey(t.name) === nameKey(name))) {
    return res.status(409).json({ error: 'Ese nombre ya está registrado. Elige otro para tu equipo.' });
  }
  const rawToken = crypto.randomBytes(32).toString('hex');
  const team = {
    id: crypto.randomUUID(),
    name,
    tokenHash: sha256(rawToken),
    startedAt: Date.now(),
    completedAt: null,
    currentLevel: 1,
    solved: [],
  };
  db.teams.push(team);
  save();
  setCookie(res, COOKIE_TEAM, rawToken, 60 * 60 * 24 * 30, req);
  res.status(201).json({ ok: true });
});

app.post('/api/answer', requireApiTeam, (req, res) => {
  const { team } = req;
  const level = Number(req.body?.level);
  const answer = req.body?.answer;
  if (team.completedAt) return res.status(409).json({ error: 'Esta misión ya fue completada.' });
  if (!Number.isInteger(level) || level !== team.currentLevel) {
    return res.status(409).json({ error: 'Este reto no es el que tienes activo.' });
  }
  if (typeof answer !== 'string' || answer.length > MAX_ANSWER_LENGTH) {
    return res.status(400).json({ error: 'Introduce una contraseña válida.' });
  }
  const attemptsKey = team.id;
  if (isRateLimited(wrongAttempts, attemptsKey, 25, 60_000)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto antes de continuar.' });
  }
  if (!safeEqual(answer.trim(), LEVELS[level - 1].password)) {
    return res.status(400).json({ error: 'Contraseña incorrecta. Revisa la pista y el código fuente.' });
  }
  const solvedAt = Date.now();
  team.solved.push(solvedAt);
  team.currentLevel += 1;
  if (team.currentLevel === 6) team.completedAt = solvedAt;
  wrongAttempts.delete(attemptsKey);
  save();
  res.json({ ok: true, completed: Boolean(team.completedAt), nextLevel: team.completedAt ? null : team.currentLevel });
});

function levelExtra(level) {
  switch (level) {
    case 1:
      return {
        title: 'ARCHIVO HTML // REGISTRO 001',
        text: 'El equipo de desarrollo dejó una nota durante una auditoría. Nadie puede verla en la pantalla, pero el navegador sí la recibió.',
        instruction: 'Encuentra la contraseña oculta en un comentario HTML.',
        visual: '<div class="terminal-line">&gt; Escaneando documento...</div><div class="terminal-line">&gt; 1 anotación encontrada</div><div class="terminal-line dim">&gt; El secreto no se dibuja en la pantalla.</div>',
        secret: '<!-- AUDITORÍA / credencial-de-pruebas: Orion#73!n -->',
      };
    case 2:
      return {
        title: 'DOM // USUARIO FANTASMA',
        text: 'Hay tres cuentas en pantalla. Una cuarta ficha desapareció visualmente, pero sigue formando parte de la página.',
        instruction: 'Localiza el elemento oculto con el inspector.',
        visual: '<div class="account-row"><span>VISITANTE</span><span class="pill okay">VISIBLE</span></div><div class="account-row"><span>OPERADOR</span><span class="pill okay">VISIBLE</span></div><div class="account-row"><span>ADMINISTRADOR</span><span class="pill warn">RESTRINGIDO</span></div><div id="ficha-de-respaldo" style="display:none" data-motivo="oculto-con-css">Contraseña de respaldo: V3l0c1dad@24</div>',
        secret: '',
      };
    case 3:
      return {
        title: 'HOJA DE ESTILOS // VARIABLES',
        text: 'El diseñador almacenó una credencial en una variable CSS. No aparece en la interfaz, pero está en los estilos.',
        instruction: 'Inspecciona las variables :root del CSS de este documento.',
        visual: '<div class="swatch-row"><span class="swatch swatch-one"></span><span class="swatch swatch-two"></span><span class="swatch swatch-three"></span><span>Paleta del sistema / ONLINE</span></div><div class="terminal-line dim">&gt; Existe una variable que no es un color...</div>',
        secret: '<style>:root { --color-sistema: #ff1638; --color-alerta: #c7c7cc; --clave-de-emergencia: "F1rewall-9X!"; }</style>',
      };
    case 4:
      return {
        title: 'SCRIPT // FRAGMENTOS',
        text: 'La contraseña se construye cuando el navegador procesa un arreglo de cadenas. Las piezas están guardadas en orden inverso.',
        instruction: 'Inspecciona el JavaScript del documento. Ordena los fragmentos y únelos sin espacios.',
        visual: '<div class="terminal-line">&gt; fragmentos_almacenados: 3</div><div class="terminal-line">&gt; reconstruccion: habilitada</div><div class="terminal-line dim">&gt; Localiza la operación en el script del documento.</div>',
        secret: '<script>const fragmentos = ["86!", "S3gura_", "R3d-"]; const claveReconstruida = [...fragmentos].reverse().join("");</script>',
      };
    case 5:
      return {
        title: 'AUTH // ROOT ACCESS',
        text: 'Última barrera. El desarrollador no dejó la clave en texto normal: usó Base64. Recupera la contraseña de acceso.',
        instruction: 'Busca cfgToken en el JavaScript y decodifícalo con atob(...) en la consola.',
        visual: '<div class="root-mark">ROOT</div><div class="terminal-line">&gt; Enlace seguro establecido</div><div class="terminal-line">&gt; Recuperación de clave: BASE64</div><div class="terminal-line dim">&gt; No confundas codificación con cifrado.</div>',
        secret: '<script>const cfgToken = "UjAwdF9BY2Nlc3MjMjY="; const tokenDeRespaldo = cfgToken;</script>',
      };
    default: throw new Error('Nivel inexistente');
  }
}

function challengeDocument(level) {
  const details = levelExtra(level);
  // El HTML completo y sus pistas SÓLO se entregan cuando el nivel está desbloqueado.
  return `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reto ${level} — ${htmlEsc(LEVELS[level - 1].title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/public/challenge.css">${level === 3 ? details.secret : ''}
</head><body>
<main class="challenge">
  <div class="eyebrow"><span class="live-led"></span> TRANSMISIÓN INTERCEPTADA <span class="challenge-no">/ NIVEL 0${level}</span></div>
  <h1>${htmlEsc(details.title)}</h1>
  <p class="story">${htmlEsc(details.text)}</p>
  <div class="screen"><div class="screen-top"><span class="dots"><i></i><i></i><i></i></span> SISTEMA / 0${level} <span>● CONECTADO</span></div><div class="screen-body">${details.visual}</div></div>
  <div class="objective"><span class="objective-icon">⌁</span><div><strong>TU MISIÓN</strong><p>${htmlEsc(details.instruction)}</p></div></div>
  <form id="answerForm" autocomplete="off"><label for="password">CONTRASEÑA ENCONTRADA</label>
   <div class="form-row"><input id="password" name="password" type="text" autocomplete="off" spellcheck="false" placeholder="Escribe la clave descubierta" maxlength="90" required aria-label="Contraseña encontrada"><button type="submit" id="submitBtn">VALIDAR <span>↗</span></button></div>
   <p class="feedback" id="feedback" aria-live="polite"></p></form>
  <div class="help-row"><button type="button" id="hintBtn">¿Necesitas una pista? <span>+</span></button><p id="hintText" hidden>${htmlEsc(LEVELS[level - 1].hint)}</p></div>
  <div class="footer-meta">ENTORNO DE PRÁCTICA · INSPECCIÓN DE CÓDIGO · NO USES CONTRASEÑAS REALES</div>
</main>
${level !== 3 ? details.secret : ''}
<script>
(function(){
  const form = document.getElementById('answerForm');
  const input = document.getElementById('password');
  const button = document.getElementById('submitBtn');
  const feedback = document.getElementById('feedback');
  const hintBtn = document.getElementById('hintBtn');
  const hintText = document.getElementById('hintText');
  hintBtn.addEventListener('click', function(){
    hintText.hidden = !hintText.hidden;
    hintBtn.querySelector('span').textContent = hintText.hidden ? '+' : '−';
  });
  form.addEventListener('submit', async function(event){
    event.preventDefault();
    button.disabled = true;
    feedback.textContent = 'Validando con el servidor...';
    feedback.className = 'feedback';
    try {
      const response = await fetch('/api/answer', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({level: ${level}, answer: input.value})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al validar');
      feedback.textContent = result.completed ? '¡MISIÓN COMPLETADA! Se detuvo tu tiempo.' : '¡ACCESO CONCEDIDO! Desbloqueando el siguiente reto...';
      feedback.className = 'feedback good';
      input.disabled = true;
      try { window.parent.postMessage({type:'cyberctf-updated'}, window.location.origin); } catch (_) {}
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'feedback bad';
      button.disabled = false;
    }
  });
})();
</script>
</body></html>`;
}

app.get('/reto/:level', (req, res) => {
  const team = teamFromReq(req);
  if (!team) return res.status(401).send('Primero inicia tu misión desde la página principal.');
  const level = Number(req.params.level);
  if (!Number.isInteger(level) || level < 1 || level > 5) return res.status(404).send('Reto inexistente.');
  if (level > team.currentLevel) return res.status(403).send('Este reto sigue bloqueado. Supera el anterior.');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.send(challengeDocument(level));
});

app.get('/api/admin/session', (req, res) => res.json({ authenticated: adminFromReq(req) }));
app.post('/api/admin/login', (req, res) => {
  const address = req.ip || 'unknown';
  if (isRateLimited(adminAttempts, address, 12, 10 * 60_000)) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta nuevamente más tarde.' });
  }
  if (typeof req.body?.password !== 'string' || !safeEqual(req.body.password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Contraseña de docente incorrecta.' });
  }
  adminAttempts.delete(address);
  const expiry = String(Date.now() + 12 * 60 * 60 * 1000);
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = 'v1.' + expiry + '.' + nonce;
  setCookie(res, COOKIE_ADMIN, payload + '.' + hmac(payload), 12 * 60 * 60, req);
  res.json({ ok: true });
});
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  res.clearCookie(COOKIE_ADMIN, { path: '/' });
  res.json({ ok: true });
});
app.get('/api/admin/teams', requireAdmin, (req, res) => {
  const now = Date.now();
  const finished = db.teams.filter(t => t.completedAt);
  const byTime = [...finished].sort((a, b) => elapsed(a) - elapsed(b) || a.completedAt - b.completedAt);
  const byArrival = [...finished].sort((a, b) => a.completedAt - b.completedAt || elapsed(a) - elapsed(b));
  const times = new Map(byTime.map((t, i) => [t.id, i + 1]));
  const arrivals = new Map(byArrival.map((t, i) => [t.id, i + 1]));
  const teams = db.teams.map(t => ({
    id: t.id,
    name: t.name,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    elapsedMs: elapsed(t, now),
    solvedCount: t.solved.length,
    currentLevel: t.currentLevel,
    rank: times.get(t.id) || null,
    arrival: arrivals.get(t.id) || null,
  })).sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return b.solvedCount - a.solvedCount || a.startedAt - b.startedAt;
  });
  res.json({ serverNow: now, total: teams.length, finished: finished.length, active: teams.length - finished.length, teams });
});
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  if (req.body?.confirm !== 'REINICIAR') return res.status(400).json({ error: 'Debes confirmar escribiendo REINICIAR.' });
  db.teams = [];
  wrongAttempts.clear();
  save();
  res.clearCookie(COOKIE_TEAM, { path: '/' });
  res.json({ ok: true });
});


if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const addresses = Object.values(os.networkInterfaces()).flat()
      .filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address);
    console.log('\n  CYBER CTF / PREPARATORIA');
    console.log('  Alumnos: http://localhost:' + PORT);
    for (const address of [...new Set(addresses)]) console.log('  Red local: http://' + address + ':' + PORT);
    console.log('  Docente: http://localhost:' + PORT + '/admin');
    if (ADMIN_GENERATED) {
      console.log('\n  CONTRASEÑA TEMPORAL DEL DOCENTE: ' + ADMIN_PASSWORD);
      console.log('  (Para fijarla configura ADMIN_PASSWORD antes de iniciar.)');
    }
    console.log('  Datos: ' + DB_FILE + '\n');
  });
}
module.exports = app;
