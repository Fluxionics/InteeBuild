'use strict';

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { builds } = require('./store');
const { clipText } = require('./actions-error');

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_SECURE', 'SMTP_STARTTLS', 'NOTIFY_EMAIL', 'PUBLIC_URL'];

function env(name, def) {
  const v = process.env[name];
  return v !== undefined && v !== '' ? v : (def || '');
}

function splitRecipients(v) {
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

function cleanAddr(s) {
  return String(s || '').replace(/[<>\r\n]/g, '').replace(/\s+/g, '').trim();
}

function smtpConfigured() {
  return !!(env('SMTP_HOST') && splitRecipients(env('NOTIFY_EMAIL')).length);
}

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

function mimeWord(s) {
  return '=?UTF-8?B?' + b64(s) + '?=';
}

function wrap76(s) {
  return (s.match(/.{1,76}/g) || []).join('\r\n');
}

class SmtpSession {
  constructor(socket) {
    this.sock = socket;
    this.buf = '';
    this.queue = [];
    this.pending = null;
    this.closed = false;
    this.onData = (d) => this._data(d);
    this.onError = () => this._fail(new Error('conexion SMTP interrumpida'));
    this.onClose = () => this._fail(new Error('conexion SMTP cerrada'));
    socket.on('data', this.onData);
    socket.on('error', this.onError);
    socket.on('close', this.onClose);
  }
  _data(d) {
    this.buf += d.toString('utf8');
    let i;
    while ((i = this.buf.search(/\r?\n/)) !== -1) {
      const nl = this.buf[i] === '\r' ? 2 : 1;
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + nl);
      if (/^\d{3} /.test(line)) this._settle(line);
      else if (this.pending) this.pending.lines.push(line);
    }
  }
  _settle(line) {
    const code = parseInt(line.slice(0, 3), 10);
    const lines = this.pending ? this.pending.lines.concat(line) : [line];
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      const resp = { code, lines };
      if (p.expect.indexOf(code) !== -1) p.resolve(resp);
      else p.reject(new Error('SMTP ' + line));
    } else {
      this.queue.push({ code, lines });
    }
  }
  _fail(err) {
    this.closed = true;
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.reject(err);
    }
  }
  read(expect) {
    if (this.queue.length) {
      const resp = this.queue.shift();
      if (expect.indexOf(resp.code) !== -1) return Promise.resolve(resp);
      return Promise.reject(new Error('SMTP ' + resp.lines[resp.lines.length - 1]));
    }
    if (this.closed) return Promise.reject(new Error('conexion SMTP cerrada'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending && this.pending.timer === timer) this.pending = null;
        reject(new Error('SMTP sin respuesta'));
      }, 12000);
      this.pending = { resolve, reject, expect, lines: [], timer };
    });
  }
  cmd(str, expect) {
    this.sock.write(str + '\r\n');
    return this.read(expect);
  }
  detach() {
    this.sock.removeListener('data', this.onData);
    this.sock.removeListener('error', this.onError);
    this.sock.removeListener('close', this.onClose);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.reject(new Error('SMTP interrumpido'));
    }
    this.queue = [];
    this.closed = true;
  }
}

function connectSocket(port, secure, host) {
  return new Promise((resolve, reject) => {
    let sock;
    const timer = setTimeout(() => {
      try { sock.destroy(); } catch (_) {}
      reject(new Error('timeout al conectar con SMTP'));
    }, 15000);
    const ok = () => { clearTimeout(timer); resolve(sock); };
    const bad = (e) => { clearTimeout(timer); reject(e); };
    if (secure) sock = tls.connect({ port, host, servername: host }, ok);
    else sock = net.connect({ port, host }, ok);
    sock.once('error', bad);
  });
}

function upgradeTls(socket, host) {
  return new Promise((resolve, reject) => {
    const t = tls.connect({ socket, servername: host }, () => resolve(t));
    t.once('error', reject);
  });
}

function capsOf(resp) {
  return resp.lines.map(l => l.replace(/^\d{3}[- ]/, '')).join(' ');
}

function buildMessage(from, recipients, subject, body, host, html) {
  const headers = [
    'From: InteeBuild <' + from + '>',
    'To: ' + recipients.join(', '),
    'Subject: ' + mimeWord(subject),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + (host || 'inteebuild') + '>',
    'MIME-Version: 1.0'
  ];
  if (html) {
    const boundary = 'ib-' + crypto.randomBytes(8).toString('hex');
    headers.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
    headers.push('');
    headers.push('--' + boundary);
    headers.push('Content-Type: text/plain; charset=utf-8');
    headers.push('Content-Transfer-Encoding: base64');
    headers.push('');
    headers.push(wrap76(b64(body)));
    headers.push('--' + boundary);
    headers.push('Content-Type: text/html; charset=utf-8');
    headers.push('Content-Transfer-Encoding: base64');
    headers.push('');
    headers.push(wrap76(b64(html)));
    headers.push('--' + boundary + '--');
    return headers.join('\r\n') + '\r\n.\r\n';
  }
  headers.push('Content-Type: text/plain; charset=utf-8');
  headers.push('Content-Transfer-Encoding: base64');
  headers.push('');
  headers.push(wrap76(b64(body)));
  return headers.join('\r\n') + '\r\n.\r\n';
}

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHtml(o) {
  const ok = o.tone === 'ok';
  const badge = ok ? ['Build listo', '#dcfce7', '#15803d'] : ['Build fallido', '#fee2e2', '#b91c1c'];
  const rows = (o.rows || []).map(([k, v]) =>
    '<tr><td style="padding:5px 16px 5px 0;color:#64748b;font-size:13px;font-family:Arial,Helvetica,sans-serif;vertical-align:top">' + esc(k) + ':</td>' +
    '<td style="padding:5px 0;color:#0f172a;font-size:13px;font-family:Arial,Helvetica,sans-serif;word-break:break-all">' + esc(v) + '</td></tr>'
  ).join('');
  const buttons = (o.buttons || []).filter(b => b.url).map(b =>
    '<a href="' + esc(b.url) + '" style="display:inline-block;margin:6px 8px 0 0;padding:11px 20px;border-radius:8px;background:#22d3a7;color:#052018;font-size:14px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;text-decoration:none">' + esc(b.label) + '</a>'
  ).join('');
  const detail = o.detail ?
    '<div style="margin:16px 0 0;padding:12px 14px;background:#0f172a;border-radius:8px;color:#e2e8f0;font-size:12px;font-family:Consolas,Menlo,monospace;white-space:pre-wrap;word-break:break-word">' + esc(o.detail) + '</div>' : '';
  const base = esc(o.base || 'https://inteebuild.com');
  return [
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">',
    '<tr><td style="background:#0b1220;padding:18px 24px"><span style="color:#22d3a7;font-size:20px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">InteeBuild</span><span style="color:#64748b;font-size:12px;font-family:Arial,Helvetica,sans-serif"> &middot; avisos de compilacion</span></td></tr>',
    '<tr><td style="padding:22px 24px 8px">',
    '<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:' + badge[1] + ';color:' + badge[2] + ';font-size:12px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">' + badge[0] + '</span>',
    '<div style="padding:14px 0 4px;color:#0f172a;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">' + esc(o.headline || '') + '</div>',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">' + rows + '</table>',
    buttons,
    detail,
    '</td></tr>',
    '<tr><td style="padding:16px 24px 22px;border-top:1px solid #e2e8f0;margin-top:18px;color:#94a3b8;font-size:12px;font-family:Arial,Helvetica,sans-serif">Aviso automatico de <a href="' + base + '" style="color:#22d3a7;text-decoration:none">InteeBuild</a></td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}

async function sendMail(opts) {
  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT') || '587');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const secure = /^(1|true|yes|on)$/i.test(env('SMTP_SECURE')) || port === 465;
  const starttls = !/^(0|false|no|off)$/i.test(env('SMTP_STARTTLS'));
  const from = cleanAddr(env('SMTP_FROM') || user || ('inteebuild@' + host));
  const recipients = (Array.isArray(opts.to) ? opts.to : splitRecipients(opts.to)).map(cleanAddr).filter(Boolean);
  if (!host) throw new Error('SMTP_HOST no configurado');
  if (!from) throw new Error('SMTP_FROM o SMTP_USER vacios');
  if (!recipients.length) throw new Error('sin destinatarios en NOTIFY_EMAIL');

  const subject = String(opts.subject || 'Aviso de InteeBuild').replace(/[\r\n]/g, ' ');
  const message = buildMessage(from, recipients, subject, String(opts.text || ''), host, opts.html ? String(opts.html) : '');

  let socket = null;
  let sess = null;
  try {
    socket = await connectSocket(port, secure, host);
    sess = new SmtpSession(socket);
    await sess.read([220]);
    let r = await sess.cmd('EHLO inteebuild', [250]);
    if (!secure && starttls && /STARTTLS/i.test(capsOf(r))) {
      await sess.cmd('STARTTLS', [220]);
      sess.detach();
      socket = await upgradeTls(socket, host);
      sess = new SmtpSession(socket);
      r = await sess.cmd('EHLO inteebuild', [250]);
    }
    if (user) {
      const caps = capsOf(r);
      if (/AUTH PLAIN/i.test(caps)) {
        await sess.cmd('AUTH PLAIN ' + b64('\0' + user + '\0' + pass), [235]);
      } else if (/AUTH LOGIN/i.test(caps)) {
        await sess.cmd('AUTH LOGIN', [334]);
        await sess.cmd(b64(user), [334]);
        await sess.cmd(b64(pass), [235]);
      } else {
        throw new Error('el servidor SMTP no anuncia AUTH');
      }
    }
    await sess.cmd('MAIL FROM:<' + from + '>', [250]);
    for (const rcpt of recipients) {
      await sess.cmd('RCPT TO:<' + rcpt + '>', [250, 251]);
    }
    await sess.cmd('DATA', [354]);
    await new Promise((resolve, reject) => {
      socket.write(message, (err) => err ? reject(err) : resolve());
      socket.once('error', reject);
    });
    await sess.read([250]);
    try { await sess.cmd('QUIT', [221]); } catch (_) {}
    return true;
  } finally {
    try { if (socket) socket.destroy(); } catch (_) {}
  }
}

const recentlyEmailed = new Map();

function takeDedup(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [k, t] of recentlyEmailed) if (now - t > 600000) recentlyEmailed.delete(k);
  if (recentlyEmailed.has(id)) return false;
  recentlyEmailed.set(id, now);
  return true;
}

function notifyBuildFailure(payload) {
  return (async () => {
    try {
      if (!smtpConfigured()) return false;
      const id = payload && payload.buildId;
      if (!takeDedup(id)) return false;
      const st = builds.get(id);
      const appName = (st && st.appName) || payload.appName || 'Aplicacion';
      const runUrl = payload.runUrl || (st && st.runUrl) || '';
      const base = env('PUBLIC_URL').replace(/\/$/, '');
      const linkBase = base || 'https://inteebuild.com';
      const detail = String(payload.detail || (st && st.errorDetail) || '').trim();
      const lines = [
        'Un build de InteeBuild fallo.',
        '',
        'App: ' + appName,
        'ID: ' + id,
        'Motivo: ' + (payload.error || 'sin detalle'),
        runUrl ? 'Log: ' + runUrl : null,
        'Detalle: ' + linkBase + '/api/build/' + id
      ].filter(Boolean);
      if (detail) lines.push('', 'Motivo real del fallo:', clipText(detail, 2000));
      const text = lines.join('\r\n');
      const html = renderHtml({
        tone: 'fail',
        headline: 'El build de "' + appName + '" fallo',
        rows: [
          ['App', appName],
          ['ID', id],
          ['Motivo', payload.error || 'sin detalle'],
          runUrl ? ['Log', runUrl] : null,
          ['Detalle', linkBase + '/api/build/' + id]
        ].filter(Boolean),
        buttons: [
          runUrl ? { label: 'Ver log en GitHub', url: runUrl } : null,
          base ? { label: 'Ver detalle', url: base + '/api/build/' + id } : { label: 'Ver detalle', url: linkBase + '/api/build/' + id }
        ].filter(Boolean),
        detail: detail ? clipText(detail, 2000) : '',
        base: linkBase
      });
      try {
        await sendMail({ to: splitRecipients(env('NOTIFY_EMAIL')), subject: 'Build fallido: ' + appName, text, html });
        console.log('[mailer] aviso de build fallido enviado (' + id + ')');
        return true;
      } catch (e) {
        console.log('[mailer] no se pudo enviar el aviso (' + id + '): ' + e.message);
        return false;
      }
    } catch (e) {
      console.log('[mailer] ' + e.message);
      return false;
    }
  })();
}

function notifyBuildSuccess(payload) {
  return (async () => {
    try {
      if (!smtpConfigured()) return false;
      const id = payload && payload.buildId;
      if (!takeDedup(id)) return false;
      const st = builds.get(id);
      const appName = (st && st.appName) || payload.appName || 'Aplicacion';
      const runUrl = payload.runUrl || (st && st.runUrl) || '';
      const base = env('PUBLIC_URL').replace(/\/$/, '');
      const linkBase = base || 'https://inteebuild.com';
      const apkUrl = payload.apkUrl || '';
      const aabUrl = payload.aabUrl || '';
      const duration = payload.duration ? String(payload.duration) + ' s' : '';
      const lines = [
        'El build de InteeBuild termino bien.',
        '',
        'App: ' + appName,
        'ID: ' + id,
        duration ? 'Duracion: ' + duration : null,
        runUrl ? 'Log: ' + runUrl : null,
        apkUrl ? 'APK: ' + (base || '') + apkUrl : null,
        aabUrl ? 'AAB: ' + (base || '') + aabUrl : null
      ].filter(Boolean);
      const text = lines.join('\r\n');
      const html = renderHtml({
        tone: 'ok',
        headline: 'El build de "' + appName + '" esta listo',
        rows: [
          ['App', appName],
          ['ID', id],
          duration ? ['Duracion', duration] : null,
          runUrl ? ['Log', runUrl] : null
        ].filter(Boolean),
        buttons: [
          apkUrl ? { label: 'Descargar APK', url: linkBase + apkUrl } : null,
          aabUrl ? { label: 'Descargar AAB', url: linkBase + aabUrl } : null,
          runUrl ? { label: 'Ver log en GitHub', url: runUrl } : null
        ].filter(Boolean),
        base: linkBase
      });
      try {
        await sendMail({ to: splitRecipients(env('NOTIFY_EMAIL')), subject: 'Build listo: ' + appName, text, html });
        console.log('[mailer] aviso de build listo enviado (' + id + ')');
        return true;
      } catch (e) {
        console.log('[mailer] no se pudo enviar el aviso (' + id + '): ' + e.message);
        return false;
      }
    } catch (e) {
      console.log('[mailer] ' + e.message);
      return false;
    }
  })();
}

module.exports = { sendMail, notifyBuildFailure, notifyBuildSuccess, smtpConfigured, ENV_KEYS };
