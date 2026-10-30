'use strict';

const LEVEL_TITLES = ['Comentario HTML', 'Elemento oculto', 'Variable CSS', 'Fragmentos JavaScript', 'Código Base64'];
const $ = (selector) => document.querySelector(selector);
let state = null;
let timeAnchor = performance.now();
let anchoredElapsedMs = 0;
let viewedLevel = null;
let pollInFlight = false;

function formatElapsed(ms) {
  const cs = Math.max(0, Math.floor(ms / 10));
  const hh = Math.floor(cs / 360000);
  const mm = Math.floor(cs / 6000) % 60;
  const ss = Math.floor(cs / 100) % 60;
  const cc = cs % 100;
  const prefix = hh ? `${String(hh).padStart(2,'0')}:` : '';
  return `${prefix}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store' });
  let result;
  try { result = await response.json(); } catch { throw new Error('El servidor no respondió correctamente.'); }
  if (!response.ok) throw new Error(result.error || 'Error al conectar.');
  return result;
}
function openLevel(number) {
  if (!state || !state.started || number < 1 || number > 5 || number > state.currentLevel) return;
  viewedLevel = number;
  const url = `/reto/${number}`;
  $('#challengeFrame').src = url;
  $('#openTab').href = url;
  $('#activeLevel').textContent = `NIVEL ${String(number).padStart(2, '0')} / 05`;
  renderNav();
  $('#iframeWrap').hidden = false;
  $('#finishCard').hidden = true;
  $('#openTab').hidden = false;
}
function renderNav() {
  if (!state?.started) return;
  const list = $('#levelList');
  list.replaceChildren();
  LEVEL_TITLES.forEach((title, idx) => {
    const n = idx + 1;
    const completed = idx < state.solved.length;
    const unlocked = n <= state.currentLevel;
    const active = viewedLevel === n && !state.completedAt;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `level-item${completed ? ' is-done' : ''}${active ? ' is-active' : ''}${!unlocked ? ' is-locked' : ''}`;
    item.disabled = !unlocked;
    item.setAttribute('aria-label', `Reto ${n}: ${title}${completed ? ', resuelto' : !unlocked ? ', bloqueado' : ', disponible'}`);
    if (viewedLevel === n) item.setAttribute('aria-current', 'step');
    const index = document.createElement('span');
    index.className = 'level-number';
    index.textContent = String(n).padStart(2, '0');
    const info = document.createElement('span');
    info.className = 'level-info';
    const label = document.createElement('span'); label.textContent = `RETO ${String(n).padStart(2, '0')}`;
    const name = document.createElement('strong'); name.textContent = title;
    info.append(label, name);
    const check = document.createElement('span');
    check.className = 'level-check';
    check.textContent = completed ? '✓' : !unlocked ? '⌁' : '→';
    item.append(index, info, check);
    item.addEventListener('click', () => openLevel(n));
    list.append(item);
  });
}
function updateTimer() {
  if (!state?.started) return;
  const elapsed = state.completedAt ? anchoredElapsedMs : anchoredElapsedMs + (performance.now() - timeAnchor);
  $('#timer').textContent = formatElapsed(elapsed);
}
function renderState(data) {
  const wasLevel = state?.currentLevel;
  const wasCompleted = Boolean(state?.completedAt);
  state = data;
  if (!data.started) {
    $('#workspace').hidden = true;
    $('#joinOverlay').hidden = false;
    return;
  }
  $('#joinOverlay').hidden = true;
  $('#workspace').hidden = false;
  $('#teamName').textContent = data.name;
  anchoredElapsedMs = data.elapsedMs;
  timeAnchor = performance.now();
  const progress = data.solved.length;
  $('#progressText').textContent = `${String(progress).padStart(2, '0')} / 05`;
  $('#progressFill').style.width = `${progress * 20}%`;
  $('#teamStatus').textContent = data.completedAt ? 'MISIÓN COMPLETADA' : `RETO ${data.currentLevel} EN CURSO`;
  $('#timerMeta').textContent = data.completedAt ? 'TIEMPO FINAL / REGISTRADO' : 'CRONÓMETRO ACTIVO';
  $('.timer-box').classList.toggle('timer-finished', Boolean(data.completedAt));
  updateTimer();
  if (data.completedAt) {
    $('#finalTime').textContent = formatElapsed(data.elapsedMs);
    $('#finalPlace').textContent = data.rank ? `PUESTO ACTUAL #${String(data.rank).padStart(2, '0')} POR TIEMPO` : 'RESULTADO REGISTRADO';
    if (!wasCompleted || $('#finishCard').hidden === false) showFinish();
  } else if (viewedLevel === null || (wasLevel && data.currentLevel > wasLevel)) {
    openLevel(data.currentLevel);
  }
  renderNav();
}
function showFinish() {
  $('#iframeWrap').hidden = true;
  $('#finishCard').hidden = false;
  $('#openTab').hidden = true;
  $('#activeLevel').textContent = '05 / 05 COMPLETADOS';
  viewedLevel = null;
  renderNav();
}
async function refreshState() {
  if (pollInFlight) return;
  pollInFlight = true;
  try { renderState(await api('/api/state')); }
  catch (e) { console.warn('Actualización pendiente:', e.message); }
  finally { pollInFlight = false; }
}
$('#joinForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#startBtn');
  button.disabled = true;
  $('#joinError').textContent = '';
  try {
    await api('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('#joinName').value }) });
    await refreshState();
  } catch (error) { $('#joinError').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#reviewBtn').addEventListener('click', () => openLevel(1));
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== $('#challengeFrame').contentWindow) return;
  if (event.data?.type === 'cyberctf-updated') refreshState();
});
setInterval(updateTimer, 60);
setInterval(refreshState, 4500);
refreshState();
