'use strict';

const LEVEL_TITLES = ['Comentario HTML', 'Elemento oculto', 'Variable CSS', 'Fragmentos JavaScript', 'Código Base64'];
const $ = (selector) => document.querySelector(selector);
let state = null;
let timeAnchor = performance.now();
let anchoredElapsedMs = 0;
let viewedLevel = null;
let pollInFlight = false;
let expiryRefreshTriggered = false;
const MAX_MISSION_MS = 45 * 60 * 1000;

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
  if (!state || !state.started || state.expiredAt || number < 1 || number > 5 || number > state.currentLevel) return;
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
    const active = viewedLevel === n && !state.ended;
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
  const elapsed = Math.min(MAX_MISSION_MS, state.ended ? anchoredElapsedMs : anchoredElapsedMs + (performance.now() - timeAnchor));
  $('#timer').textContent = formatElapsed(elapsed);
  const remaining = Math.max(0, MAX_MISSION_MS - elapsed);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  $('#remainingTime').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} RESTANTES`;
  if (remaining === 0 && !state.ended && !expiryRefreshTriggered) {
    expiryRefreshTriggered = true;
    refreshState();
  }
}
function setIntroVideoVisible(visible) {
  // Al empezar una misión se detiene el video y no continúa sonando detrás del juego.
  const video = $('#introVideo');
  if (!video) return;
  const desiredSrc = visible ? video.dataset.embed : 'about:blank';
  if (video.getAttribute('src') !== desiredSrc) video.setAttribute('src', desiredSrc);
}
function renderState(data) {
  const wasLevel = state?.currentLevel;
  const wasEnded = Boolean(state?.ended);
  state = data;
  if (!data.started) {
    $('#workspace').hidden = true;
    $('#joinOverlay').hidden = false;
    setIntroVideoVisible(true);
    return;
  }
  $('#joinOverlay').hidden = true;
  setIntroVideoVisible(false);
  $('#workspace').hidden = false;
  expiryRefreshTriggered = false;
  $('#teamName').textContent = data.name;
  anchoredElapsedMs = data.elapsedMs;
  timeAnchor = performance.now();
  const progress = data.solved.length;
  $('#progressText').textContent = `${String(progress).padStart(2, '0')} / 05`;
  $('#progressFill').style.width = `${progress * 20}%`;
  $('#teamStatus').textContent = data.expiredAt ? 'TIEMPO AGOTADO' : data.completedAt ? 'MISIÓN COMPLETADA' : `RETO ${data.currentLevel} EN CURSO`;
  $('#timerMeta').textContent = data.ended ? 'TIEMPO FINAL / REGISTRADO' : 'CRONÓMETRO ACTIVO / MÁXIMO 45 MIN';
  $('.timer-box').classList.toggle('timer-finished', Boolean(data.ended));
  $('#currentScore').textContent = String(data.score).padStart(2, '0');
  $('#syncStatus').textContent = !data.solved.length && !data.ended
    ? 'Se enviará al resolver el primer reto.'
    : data.syncedScore >= data.score
      ? 'Puntuación registrada en Supabase.'
      : data.syncError ? 'Guardado localmente; reintentando envío a Supabase.' : 'Enviando puntuación a Supabase...';
  updateTimer();
  if (data.ended) {
    $('#finalTime').textContent = formatElapsed(data.elapsedMs);
    $('#finalScore').textContent = data.score;
    $('#finishIcon').textContent = data.expiredAt ? '⌛' : '✓';
    $('#finishEyebrow').textContent = data.expiredAt ? `[ TIEMPO AGOTADO // ${progress} / 05 RETOS ]` : '[ PROTOCOLO COMPLETADO // 05 / 05 ]';
    $('#finishTitle').textContent = data.expiredAt ? 'TIEMPO AGOTADO.' : 'ACCESO CONCEDIDO.';
    $('#finishDescription').textContent = data.expiredAt ? 'Llegaron al límite de 45 minutos. Se registraron los retos resueltos:' : 'Superaron todas las barreras. Su tiempo quedó registrado oficialmente:';
    $('#finalPlace').textContent = data.completedAt && data.rank ? `PUESTO ACTUAL #${String(data.rank).padStart(2, '0')} POR TIEMPO` : `EQUIPO ${data.teamNumber} // RESULTADO CALCULADO`;
    $('#matrixPanel').hidden = Boolean(data.expiredAt);
    $('#reviewBtn').hidden = Boolean(data.expiredAt);
    $('#finishFoot').textContent = data.syncedScore >= data.score ? 'Resultado enviado. Supabase conserva siempre la mejor calificación de este equipo.' : 'Resultado guardado localmente. El sistema seguirá intentando enviarlo a Supabase.';
    if (!wasEnded || $('#finishCard').hidden === false) showFinish();
  } else if (viewedLevel === null || (wasLevel && data.currentLevel > wasLevel)) {
    openLevel(data.currentLevel);
  }
  renderNav();
}
function showFinish() {
  $('#iframeWrap').hidden = true;
  $('#finishCard').hidden = false;
  $('#openTab').hidden = true;
  $('#activeLevel').textContent = state.expiredAt ? 'TIEMPO AGOTADO' : '05 / 05 COMPLETADOS';
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
function selectedTeamNumber() {
  const raw = $('#joinTeamNumber').value.trim();
  const n = Number(raw);
  return /^\d{1,2}$/.test(raw) && Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}
function updateSelection() {
  const n = selectedTeamNumber();
  $('#startBtn').disabled = n === null;
  $('#teamSelectStatus').textContent = n === null ? 'NINGÚN EQUIPO VÁLIDO SELECCIONADO' : `EQUIPO ${String(n).padStart(2, '0')} SELECCIONADO`;
}
$('#joinTeamNumber').addEventListener('input', updateSelection);
$('#teamPlus').addEventListener('click', () => {
  const n = selectedTeamNumber();
  $('#joinTeamNumber').value = n === null ? 1 : Math.min(20, n + 1);
  updateSelection();
});
$('#teamMinus').addEventListener('click', () => {
  const n = selectedTeamNumber();
  $('#joinTeamNumber').value = n === null ? 20 : Math.max(1, n - 1);
  updateSelection();
});
updateSelection();
$('#joinForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const teamNumber = selectedTeamNumber();
  if (teamNumber === null) { $('#joinError').textContent = 'Selecciona un equipo del 1 al 20.'; return; }
  const button = $('#startBtn');
  button.disabled = true;
  $('#joinError').textContent = '';
  try {
    await api('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamNumber }) });
    await refreshState();
  } catch (error) { $('#joinError').textContent = error.message; }
  finally { updateSelection(); }
});
$('#reviewBtn').addEventListener('click', () => openLevel(1));
$('#retryBtn').addEventListener('click', async () => {
  $('#retryError').textContent = '';
  $('#retryBtn').disabled = true;
  try {
    await api('/api/retry', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    viewedLevel = null;
    $('#challengeFrame').src = 'about:blank';
    $('#finishCard').hidden = true;
    await refreshState();
  } catch (error) { $('#retryError').textContent = error.message; }
  finally { $('#retryBtn').disabled = false; }
});
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== $('#challengeFrame').contentWindow) return;
  if (event.data?.type === 'cyberctf-updated') refreshState();
});
setInterval(updateTimer, 60);
setInterval(refreshState, 4500);
refreshState();
