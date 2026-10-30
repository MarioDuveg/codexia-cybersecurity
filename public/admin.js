'use strict';
const $ = (selector) => document.querySelector(selector);
let snapshot = null;
let syncedAt = performance.now();
let loading = false;

function duration(ms) {
  const cs = Math.max(0, Math.floor(ms / 10));
  const hh = Math.floor(cs / 360000);
  const mm = Math.floor(cs / 6000) % 60;
  const ss = Math.floor(cs / 100) % 60;
  const prefix = hh ? `${String(hh).padStart(2, '0')}:` : '';
  return `${prefix}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}
async function api(url, options = {}) {
  const res = await fetch(url, { ...options, cache:'no-store', credentials:'same-origin' });
  let data;
  try { data = await res.json(); } catch { throw new Error('Respuesta inválida del servidor'); }
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}
function showLogin() { $('#adminGate').hidden = false; $('#adminMain').hidden = true; snapshot = null; }
function showPanel() { $('#adminGate').hidden = true; $('#adminMain').hidden = false; }
async function refresh() {
  if (loading || $('#adminMain').hidden) return;
  loading = true;
  try {
    const data = await api('/api/admin/teams');
    snapshot = data;
    syncedAt = performance.now();
    $('#totalTeams').textContent = data.total;
    $('#activeTeams').textContent = data.active;
    $('#finishedTeams').textContent = data.finished;
    const best = data.teams.find(t => t.completedAt);
    $('#bestTime').textContent = best ? duration(best.elapsedMs) : '--:--.--';
    $('#bestTeam').textContent = best ? best.name : 'Sin resultados';
    $('#lastSync').textContent = 'Sincronizado: ' + new Date().toLocaleTimeString('es-MX');
    populate(data.teams);
  } catch (e) {
    $('#lastSync').textContent = 'Sin conexión: ' + e.message;
    if (/exclusivo|autorizado/i.test(e.message)) showLogin();
  } finally { loading = false; }
}
function populate(teams) {
  const tbody = $('#scoreRows');
  tbody.replaceChildren();
  if (!teams.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty-state';
    cell.textContent = 'Aún no hay equipos. Comparte la dirección de la misión con tus alumnos.';
    row.append(cell); tbody.append(row);
    return;
  }
  for (const t of teams) {
    const row = document.createElement('tr');
    if (t.completedAt) row.className = 'finished-row';
    const cells = Array.from({ length: 6 }, () => document.createElement('td'));
    cells[0].textContent = t.rank ? `#${String(t.rank).padStart(2, '0')}` : '—';
    if (t.rank === 1) cells[0].className = 'first-place';
    cells[1].className = 'table-name'; cells[1].textContent = t.name;
    const progress = document.createElement('div'); progress.className = 'table-progress';
    const bars = document.createElement('div'); bars.className = 'tiny-bars';
    for (let i = 0; i < 5; i++) { const bar = document.createElement('i'); if (i < t.solvedCount) bar.className = 'filled'; bars.append(bar); }
    const count = document.createElement('span'); count.textContent = `${t.solvedCount}/5`;
    progress.append(bars, count); cells[2].append(progress);
    cells[3].className = 'table-clock';
    cells[3].textContent = duration(t.elapsedMs);
    cells[3].dataset.teamId = t.id;
    cells[4].append(makeStatus(t.completedAt));
    cells[5].textContent = t.arrival ? `#${String(t.arrival).padStart(2, '0')}` : '—';
    for (const cell of cells) row.append(cell);
    tbody.append(row);
  }
}
function makeStatus(finished) {
  const el = document.createElement('span');
  el.className = finished ? 'status-badge done' : 'status-badge running';
  el.textContent = finished ? '✓ FINALIZADO' : '● EN CURSO';
  return el;
}
function animateTimes() {
  if (!snapshot || $('#adminMain').hidden) return;
  const diff = performance.now() - syncedAt;
  const live = new Map(snapshot.teams.map(t => [t.id, t.completedAt ? t.elapsedMs : t.elapsedMs + diff]));
  document.querySelectorAll('[data-team-id]').forEach(cell => {
    if (live.has(cell.dataset.teamId)) cell.textContent = duration(live.get(cell.dataset.teamId));
  });
}
$('#adminLogin').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#loginBtn').disabled = true;
  $('#loginError').textContent = '';
  try {
    await api('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password:$('#adminPassword').value}) });
    $('#adminPassword').value = '';
    showPanel();
    await refresh();
  } catch(e) { $('#loginError').textContent = e.message; }
  finally { $('#loginBtn').disabled = false; }
});
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', {method:'POST'}); } catch (_) {}
  showLogin();
});
$('#resetBtn').addEventListener('click', async () => {
  const confirmation = window.prompt('Se borrarán todos los equipos y los tiempos. Escribe REINICIAR para confirmar:');
  if (confirmation !== 'REINICIAR') return;
  try {
    await api('/api/admin/reset', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirm:confirmation})});
    await refresh();
  } catch(e) { window.alert(e.message); }
});
$('#exportBtn').addEventListener('click', () => {
  if (!snapshot) return;
  const csvCell = (value) => {
    const safe = String(value ?? '').replace(/^[=+@\-]/, "'$&").replaceAll('"', '""');
    return `"${safe}"`;
  };
  const rows = [['Puesto por tiempo','Equipo','Retos resueltos','Tiempo (ms)','Tiempo visible','Estado','Orden de llegada','Inicio ISO','Fin ISO']];
  for (const t of snapshot.teams) rows.push([t.rank || '', t.name, t.solvedCount, Math.round(t.elapsedMs), duration(t.elapsedMs), t.completedAt ? 'Finalizado' : 'En curso', t.arrival || '', new Date(t.startedAt).toISOString(), t.completedAt ? new Date(t.completedAt).toISOString() : '']);
  const text = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `cyberctf-resultados-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
});
setInterval(animateTimes, 70);
setInterval(refresh, 2300);
(async () => {
  try { const result = await api('/api/admin/session'); if (result.authenticated) { showPanel(); await refresh(); } else showLogin(); }
  catch { showLogin(); }
})();
