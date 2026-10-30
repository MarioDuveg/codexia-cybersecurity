'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberctf-test-'));
process.env.CTF_DATA_DIR = temp;
process.env.ADMIN_PASSWORD = 'ClaveDocente_Prueba#2026';
const app = require('../app');

function browser(host) {
  const cookies = new Map();
  return async (pathname, body) => {
    const headers = {};
    if (cookies.size) headers.cookie = [...cookies].map(([key, val]) => key + '=' + val).join('; ');
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(host + pathname, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const newCookie = response.headers.get('set-cookie');
    if (newCookie) {
      const [key, ...parts] = newCookie.split(';')[0].split('=');
      if (parts.join('=')) cookies.set(key, parts.join('=')); else cookies.delete(key);
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  };
}

test('Flujo completo de dos equipos y clasificación docente', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const host = 'http://127.0.0.1:' + server.address().port;
  const a = browser(host);
  const b = browser(host);
  const admin = browser(host);
  const passwords = ['Orion#73!n','V3l0c1dad@24','F1rewall-9X!','R3d-S3gura_86!','R00t_Access#26'];
  try {
    // Comprobar que la portada y los recursos visuales se sirven sin exponer otros archivos.
    const home = await fetch(host + '/');
    assert.equal(home.status, 200);
    const markup = await home.text();
    assert.match(markup, /CODEXIA \/\/ Cyber CTF/);
    assert.match(markup, /youtube-nocookie\.com\/embed\/5z5KkYpFvO4/);
    assert.match(markup, /MATRIZ DE/);
    for (const color of ['AMARILLO', 'ROJO', 'VERDE', 'AZUL']) assert.match(markup, new RegExp(color));
    assert.doesNotMatch(markup, /ultron-sd-dim/);
    const art = await fetch(host + '/public/ultron-sd-dim.webp');
    assert.equal(art.status, 404);
    const style = await fetch(host + '/public/styles.css');
    assert.equal(style.status, 200);
    assert.match(await style.text(), /--red:#ff1638/);
    assert.equal((await a('/api/start', { name: 'Primer Equipo' })).status, 201);
    assert.equal((await a('/reto/5')).status, 403);
    assert.equal((await a('/api/answer', { level: 1, answer: 'incorrecto' })).status, 400);
    for (let i = 1; i <= 5; i++) {
      assert.equal((await a('/reto/' + i)).status, 200);
      assert.equal((await a('/api/answer', { level: i, answer: passwords[i - 1] })).status, 200);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const stateA = (await a('/api/state')).data;
    assert.ok(stateA.completedAt);
    assert.equal(stateA.solved.length, 5);
    assert.equal((await a('/api/answer', { level: 5, answer: passwords[4] })).status, 409);
    assert.equal((await b('/api/start', { name: 'Segundo Equipo' })).status, 201);
    for (let i = 1; i <= 5; i++) assert.equal((await b('/api/answer', { level: i, answer: passwords[i - 1] })).status, 200);
    assert.equal((await admin('/api/admin/teams')).status, 401);
    assert.equal((await admin('/api/admin/login', { password: 'incorrecta' })).status, 401);
    assert.equal((await admin('/api/admin/login', { password: 'ClaveDocente_Prueba#2026' })).status, 200);
    const leaderboard = (await admin('/api/admin/teams')).data;
    assert.equal(leaderboard.finished, 2);
    assert.equal(leaderboard.total, 2);
    assert.equal(leaderboard.teams[0].name, 'Segundo Equipo');
    assert.equal(leaderboard.teams[0].rank, 1);
    assert.equal(leaderboard.teams[0].arrival, 2);
    assert.equal(leaderboard.teams[1].arrival, 1);
    assert.equal((await a('/api/state')).data.elapsedMs, stateA.elapsedMs);
    assert.equal((await admin('/api/admin/reset', { confirm:'REINICIAR' })).status, 200);
    assert.equal((await a('/api/state')).data.started, false);
    assert.equal((await admin('/api/admin/teams')).data.total, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, {recursive:true,force:true});
  }
});
