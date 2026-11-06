'use strict';
const rows = document.querySelector('#resultRows');
const status = document.querySelector('#resultsStatus');
const display = v => Number(v ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
let running = false;
async function refreshResults() {
  if (running) return;
  running = true;
  try {
    const response = await fetch('/api/scores', { cache:'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Error al consultar Supabase');
    rows.replaceChildren();
    for (const [index, team] of payload.scores.entries()) {
      const tr = document.createElement('tr');
      const cells = [index + 1, `Equipo ${team.equipo}`, team.taller_1, team.taller_2, team.taller_3, team.taller_4, team.batalla_final, team.total];
      for (const [i, cell] of cells.entries()) {
        const td = document.createElement('td');
        td.textContent = i === 1 ? cell : display(cell);
        if (i === 1) td.className = 'table-name';
        if (i === 7) td.className = 'first-place';
        tr.append(td);
      }
      rows.append(tr);
    }
    if (!payload.scores.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'empty-state';
      td.textContent = 'Todavía no hay puntuaciones registradas.';
      tr.append(td); rows.append(tr);
    }
    status.textContent = 'ACTUALIZADO: ' + new Date().toLocaleTimeString('es-MX');
  } catch (error) { status.textContent = 'SIN CONEXIÓN: ' + error.message; }
  finally { running = false; }
}
refreshResults();
setInterval(refreshResults, 10000);
