'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const fs = require('fs');
const path = require('path');

const mailer = require('../server/mailer');

function clearEnv() {
  for (const k of mailer.ENV_KEYS) delete process.env[k];
}

function setSmtp(port, extra) {
  clearEnv();
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_FROM = 'build@inteebuild.test';
  process.env.NOTIFY_EMAIL = 'dest@correo.test';
  Object.assign(process.env, extra || {});
}

function startFakeSmtp() {
  const inbox = { cmds: [], data: [], waiters: [] };
  const server = net.createServer((sock) => {
    let inData = false;
    let buf = '';
    sock.write('220 fake ESMTP listo\r\n');
    sock.on('error', () => {});
    sock.on('data', (d) => {
      const s = d.toString('utf8');
      if (inData) {
        buf += s;
        const end = buf.indexOf('\r\n.\r\n');
        if (end !== -1) {
          inData = false;
          inbox.data.push(buf.slice(0, end + 2));
          buf = buf.slice(end + 5);
          sock.write('250 2.0.0 Ok: queued\r\n');
          inbox.waiters.splice(0).forEach((w) => w());
        }
        return;
      }
      for (const line of s.split(/\r?\n/)) {
        if (!line) continue;
        inbox.cmds.push(line);
        const u = line.toUpperCase();
        if (u.startsWith('EHLO')) sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250-SIZE 10485760\r\n250 OK\r\n');
        else if (u.startsWith('AUTH ')) sock.write('235 2.7.0 Autenticado\r\n');
        else if (u.startsWith('MAIL FROM')) sock.write('250 2.1.0 Ok\r\n');
        else if (u.startsWith('RCPT TO')) sock.write('250 2.1.5 Ok\r\n');
        else if (u.startsWith('DATA')) { inData = true; sock.write('354 Fin con punto\r\n'); }
        else if (u.startsWith('QUIT')) { sock.write('221 2.0.0 Bye\r\n'); sock.end(); }
        else sock.write('250 2.0.0 Ok\r\n');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, inbox }));
  });
}

function waitData(inbox, ms) {
  if (inbox.data.length) return Promise.resolve(inbox.data[inbox.data.length - 1]);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout esperando el correo')), ms || 8000);
    inbox.waiters.push(() => { clearTimeout(t); resolve(inbox.data[inbox.data.length - 1]); });
  });
}

function decodeBody(raw) {
  const idx = raw.indexOf('\r\n\r\n');
  assert.ok(idx !== -1, 'el mensaje tiene encabezados y cuerpo');
  return Buffer.from(raw.slice(idx + 4).replace(/\r?\n/g, ''), 'base64').toString('utf8');
}

test('mailer: sin SMTP configurado no hace nada ni lanza', async () => {
  clearEnv();
  assert.equal(mailer.smtpConfigured(), false);
  const r = await mailer.notifyBuildFailure({ buildId: 'x1', error: 'boom' });
  assert.equal(r, false);
});

test('mailer: envio completo con AUTH, destinatarios y UTF-8', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port, { SMTP_USER: 'user', SMTP_PASS: 'pass' });
    const ok = await mailer.sendMail({ to: 'a@b.com, c@d.com', subject: 'Build fallido: MiApp áé', text: 'Motivo: fallo\r\nLinea2' });
    assert.equal(ok, true);
    const data = await waitData(inbox);
    assert.match(data, /Subject: =\?UTF-8\?B\?/);
    assert.match(data, /Content-Transfer-Encoding: base64/);
    assert.equal(decodeBody(data), 'Motivo: fallo\r\nLinea2');
    assert.ok(inbox.cmds.some(c => c.startsWith('EHLO ')), 'EHLO enviado');
    assert.ok(inbox.cmds.some(c => c.startsWith('AUTH PLAIN ')), 'AUTH PLAIN enviado');
    assert.ok(inbox.cmds.some(c => c.startsWith('MAIL FROM:<build@inteebuild.test>')), 'remitente');
    assert.ok(inbox.cmds.some(c => c.startsWith('RCPT TO:<a@b.com>')), 'destinatario 1');
    assert.ok(inbox.cmds.some(c => c.startsWith('RCPT TO:<c@d.com>')), 'destinatario 2');
    assert.ok(inbox.cmds.some(c => c.startsWith('QUIT')), 'despedida limpia');
  } finally { server.close(); clearEnv(); }
});

test('mailer: notifyBuildFailure arma el correo con appName y motivo', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port);
    const { builds } = require('../server/store');
    builds.set('ml1', { appName: 'Mi App', runUrl: 'https://github.com/x/y/runs/1' });
    const sent = await mailer.notifyBuildFailure({ event: 'build.failed', buildId: 'ml1', error: 'GitHub Actions concluyo: failure' });
    assert.equal(sent, true);
    const data = await waitData(inbox);
    const body = decodeBody(data);
    assert.match(body, /App: Mi App/);
    assert.match(body, /ID: ml1/);
    assert.match(body, /GitHub Actions concluyo: failure/);
    assert.match(body, /Log: https:\/\/github\.com\/x\/y\/runs\/1/);
    builds.delete('ml1');
  } finally { server.close(); clearEnv(); }
});

test('mailer: notifyBuildFailure incluye el detalle real del fallo', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port);
    const { builds } = require('../server/store');
    builds.set('mdet', { appName: 'Mi App' });
    const sent = await mailer.notifyBuildFailure({
      event: 'build.failed',
      buildId: 'mdet',
      error: 'GitHub Actions concluyo: failure',
      detail: 'error: cannot find symbol\n1 error'
    });
    assert.equal(sent, true);
    const body = decodeBody(await waitData(inbox));
    assert.match(body, /Motivo real del fallo:/);
    assert.match(body, /error: cannot find symbol/);
    assert.match(body, /GitHub Actions concluyo: failure/);
    builds.delete('mdet');
  } finally { server.close(); clearEnv(); }
});

test('mailer: el detalle del fallo se recorta a 2000 caracteres', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port);
    const sent = await mailer.notifyBuildFailure({
      event: 'build.failed',
      buildId: 'mlong',
      error: 'boom',
      detail: 'x'.repeat(5000)
    });
    assert.equal(sent, true);
    const body = decodeBody(await waitData(inbox));
    assert.ok(body.includes('x'.repeat(2000) + '...'), 'recorte con sufijo');
    assert.ok(!body.includes('x'.repeat(2001)), 'sin exceso de caracteres');
  } finally { server.close(); clearEnv(); }
});

test('mailer: un mismo build solo avisa una vez', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port);
    const a = await mailer.notifyBuildFailure({ event: 'build.failed', buildId: 'mdup', error: 'x' });
    const b = await mailer.notifyBuildFailure({ event: 'build.failed', buildId: 'mdup', error: 'x' });
    assert.equal(a, true, 'primer aviso enviado');
    assert.equal(b, false, 'segundo aviso deduplicado');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(inbox.data.length, 1, 'un solo correo en la bandeja');
  } finally { server.close(); clearEnv(); }
});

test('mailer: fireWebhook dispara correo solo en fallo y sin url', async () => {
  const { server, port, inbox } = await startFakeSmtp();
  try {
    setSmtp(port);
    const { fireWebhook } = require('../server/build-engine');
    await fireWebhook('', { event: 'build.completed', buildId: 'mok', status: 'success' });
    await new Promise(r => setTimeout(r, 150));
    assert.equal(inbox.data.length, 0, 'build.completed no genera correo');
    const p = fireWebhook('', { event: 'build.failed', buildId: 'mf1', status: 'failed', error: 'boom' });
    const data = await waitData(inbox);
    await p;
    assert.match(decodeBody(data), /ID: mf1/);
    assert.match(decodeBody(data), /boom/);
  } finally { server.close(); clearEnv(); }
});

test('mailer: sin servidor SMTP rechaza rapido, no se cuelga', async () => {
  const probe = net.createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  setSmtp(port);
  try {
    await assert.rejects(() => mailer.sendMail({ to: 'a@b.com', subject: 'x', text: 'y' }));
  } finally { clearEnv(); }
});

test('avisos: build-engine esta enganchado al mailer', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'build-engine.js'), 'utf8');
  assert.match(src, /notifyBuildFailure\(payload\)/);
  assert.match(src, /build\.failed/);
});

test('avisos: build.js integra toast, notificacion del navegador y sonido', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'build.js'), 'utf8');
  assert.match(src, /notifyTerminal\(true/);
  assert.match(src, /notifyTerminal\(false/);
  assert.match(src, /new Notification\(/);
  assert.match(src, /AudioContext/);
});
