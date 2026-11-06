'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexia-scores-test-'));
process.env.CTF_DATA_DIR = temporaryDir;
process.env.ADMIN_PASSWORD = 'ClaveDePrueba-2026';
const remoteBest = new Map();
const calls = [];
const mockSupabase = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/rest/v1/rpc/registrar_batalla_final' && req.method === 'POST') {
    assert.equal(req.headers.apikey, 'sb_publishable_test_only');
    let body = '';
    for await (const chunk of req) body += chunk;
    const {p_equipo, p_puntaje} = JSON.parse(body);
    calls.push({p_equipo, p_puntaje});
    if (!Number.isInteger(p_equipo) || p_equipo < 1 || p_equipo > 20 || !Number.isInteger(p_puntaje) || p_puntaje < 1 || p_puntaje > 100) {
      res.statusCode = 400;
      return res.end(JSON.stringify({message:'Rango inválido'}));
    }
    remoteBest.set(p_equipo, Math.max(remoteBest.get(p_equipo) || 0, p_puntaje));
    return res.end(JSON.stringify(remoteBest.get(p_equipo)));
  }
  if (req.url.startsWith('/rest/v1/scores?') && req.method === 'GET') {
    const scores = [...remoteBest].map(([equipo, batalla_final]) => ({
      equipo, taller_1: 0, taller_2: 0, taller_3: 0, taller_4: 0,
      batalla_final, total: batalla_final,
    })).sort((a,b) => b.total-a.total || a.equipo-b.equipo);
    return res.end(JSON.stringify(scores));
  }
  res.statusCode = 404;
  res.end('{}');
});

function browser(host) {
  const cookies = new Map();
  return async (pathname, body) => {
    const headers = {};
    if (cookies.size) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(host + pathname, {
      method: body === undefined ? 'GET' : 'POST', headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      const [key, ...parts] = cookieHeader.split(';')[0].split('=');
      if (parts.join('=')) cookies.set(key, parts.join('=')); else cookies.delete(key);
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return {status: response.status, data};
  };
}
async function waitFor(predicate, reason) {
  for (let n = 0; n < 80; n++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(reason);
}
const passwords = ['Orion#73!n', 'V3l0c1dad@24', 'F1rewall-9X!', 'R3d-S3gura_86!', 'R00t_Access#26'];

// Esta prueba usa un falso servidor de Supabase; nunca escribe en la base real.
test('Equipo obligatorio, misión de 45 min, reintentos y mejor nota en Supabase', async () => {
  await new Promise(resolve => mockSupabase.listen(0, '127.0.0.1', resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${mockSupabase.address().port}/rest/v1/`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  const app = require('../app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const host = `http://127.0.0.1:${server.address().port}`;
  const a = browser(host);
  const b = browser(host);
  const c = browser(host);
  const admin = browser(host);
  const originalNow = Date.now;
  try {
    const home = await fetch(host + '/');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /id="joinTeamNumber"/);
    assert.match(html, /id="startBtn" disabled/);
    assert.match(html, /youtube-nocookie\.com\/embed\/5z5KkYpFvO4/);
    assert.match(html, /MATRIZ DE/);
    assert.equal((await a('/api/state')).data.started, false);
    for (const teamNumber of [undefined, null, '', 0, 21, 2.5, 'abc', '99']) {
      assert.equal((await a('/api/start', {teamNumber})).status, 400);
    }
    assert.equal((await a('/reto/1')).status, 401);
    assert.equal((await a('/api/start', {name:'NO SE PERMITE NOMBRE LIBRE'})).status, 400);
    assert.equal((await a('/api/start', {teamNumber:3})).status, 201);
    assert.equal((await a('/api/state')).data.name, 'Equipo 3');
    assert.equal((await a('/api/state')).data.maxDurationMs, 2700000);
    assert.equal((await a('/api/state')).data.score, 1);
    assert.equal((await a('/api/start', {teamNumber:4})).data.alreadyStarted, true);
    assert.equal((await a('/reto/5')).status, 403);
    assert.equal((await a('/api/answer', {level:1, answer:'incorrecto'})).status, 400);
    for (let i = 1; i <= 5; i++) {
      assert.equal((await a('/reto/' + i)).status, 200);
      const answer = await a('/api/answer', {level:i, answer:passwords[i-1]});
      assert.equal(answer.status, 200);
      assert.equal(answer.data.score, i * 20); // Resueltos inmediatamente: 20, 40, 60, 80, 100
    }
    const completed = (await a('/api/state')).data;
    assert.equal(completed.ended, true);
    assert.ok(completed.completedAt);
    assert.equal(completed.expiredAt, null);
    assert.equal(completed.score, 100);
    await waitFor(() => remoteBest.get(3) === 100, 'No se publicó calificación final');
    assert.equal((await a('/api/answer', {level:5, answer:passwords[4]})).status, 409);
    assert.equal((await a('/api/retry', {})).status, 201);
    const retryState = (await a('/api/state')).data;
    assert.equal(retryState.name, 'Equipo 3');
    assert.equal(retryState.solved.length, 0);
    assert.equal(retryState.ended, false);
    assert.equal((await a('/api/retry', {})).status, 409);
    assert.equal((await a('/api/answer', {level:1, answer:passwords[0]})).status, 200);
    await waitFor(() => calls.some(r => r.p_equipo === 3 && r.p_puntaje === 20), 'No se reenvió calificación inferior');
    assert.equal(remoteBest.get(3), 100);
    // Simular el vencimiento de los 45 minutos sin esperar realmente.
    const baseTime = originalNow();
    Date.now = () => baseTime + 46 * 60000;
    const expired = (await a('/api/state')).data;
    assert.equal(expired.ended, true);
    assert.ok(expired.expiredAt);
    assert.equal(expired.elapsedMs, 2700000);
    assert.equal(expired.score, 20); // Se calcula con el instante del último reto resuelto.
    assert.equal((await a('/api/answer', {level:2, answer:passwords[1]})).status, 409);
    Date.now = originalNow;
    assert.equal(remoteBest.get(3), 100);

    assert.equal((await b('/api/start', {teamNumber:4})).status, 201);
    for (let i = 1; i <= 4; i++) assert.equal((await b('/api/answer', {level:i, answer:passwords[i-1]})).status, 200);
    const slowerBase = originalNow();
    Date.now = () => slowerBase + 44 * 60000 + 59 * 1000;
    const slower = await b('/api/answer', {level:5, answer:passwords[4]});
    assert.equal(slower.status, 200);
    assert.equal(slower.data.score, 81);
    Date.now = originalNow;
    await waitFor(() => remoteBest.get(4) === 81, 'No se publicó el score de 44:59');

    assert.equal((await c('/api/start', {teamNumber:20})).status, 201);
    const blankStarted = originalNow();
    Date.now = () => blankStarted + 45 * 60000 + 1;
    const blankExpired = (await c('/api/state')).data;
    assert.equal(blankExpired.score, 1);
    assert.ok(blankExpired.expiredAt);
    assert.equal((await c('/reto/1')).status, 410);
    Date.now = originalNow;
    await waitFor(() => remoteBest.get(20) === 1, 'No se registró la partida con 0 retos');
    assert.equal((await c('/api/retry', {})).status, 201);

    const publicPage = await fetch(host + '/resultados');
    assert.equal(publicPage.status, 200);
    assert.match(await publicPage.text(), /CLASIFICACIÓN POR PUNTOS TOTALES/);
    const ranking = await c('/api/scores');
    assert.equal(ranking.status, 200);
    assert.deepEqual(ranking.data.scores.map(x=>x.equipo), [3,4,20]);
    assert.equal(ranking.data.scores[0].batalla_final, 100);
    assert.equal((await admin('/api/admin/teams')).status, 401);
    assert.equal((await admin('/api/admin/login', {password:'ClaveDePrueba-2026'})).status, 200);
    const adminResponse = await admin('/api/admin/teams');
    assert.equal(adminResponse.status, 200);
    assert.ok(adminResponse.data.teams.length >= 5); // Se guardan los intentos, no solo los equipos.
  } finally {
    Date.now = originalNow;
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => mockSupabase.close(resolve));
    fs.rmSync(temporaryDir, {recursive:true, force:true});
  }
});
