// Dev runner: starts the API (with safe auto-reload) and Vite together.
//
// Why not `node --watch` + `concurrently -k`?
//  - On Windows, fs.watch also fires when a file is merely *read* (last-access
//    time), so `node --watch` restarted the API whenever an editor, git or a
//    test touched server files — requests during the restart failed.
//  - `concurrently -k` killed the website whenever the API exited, and a
//    second `npm run dev:all` killed the first one's servers.
// This runner restarts the API only when a file's content/mtime really
// changes, restarts it after a crash, and refuses to start twice.
import { spawn } from 'node:child_process';
import { readdirSync, statSync, watch } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = Number(process.env.PORT || 4000);
const WEB_PORT = 3007;
const WATCH_DIRS = ['server', 'pipeline'];
const COLORS = { api: '\x1b[34m', web: '\x1b[35m', dev: '\x1b[32m' };

const log = (name, line) => process.stdout.write(`${COLORS[name]}[${name}]\x1b[0m ${line}\n`);

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function pipe(name, child) {
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) if (l.trim()) log(name, l);
    });
  }
}

// --- API with content-based reload + crash restart -------------------------
let api = null;
let stopping = false;
let crashes = 0;

function startApi() {
  api = spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], { cwd: ROOT, env: process.env });
  pipe('api', api);
  const startedAt = Date.now();
  api.on('exit', (code, signal) => {
    api = null;
    if (stopping || signal === 'SIGTERM') return;
    // Back off if it keeps crashing right after start (e.g. a syntax error).
    crashes = Date.now() - startedAt < 5000 ? crashes + 1 : 1;
    const delay = Math.min(1000 * 2 ** (crashes - 1), 15000);
    log('api', `exited (code ${code}); restarting in ${delay / 1000}s…`);
    setTimeout(() => !stopping && !api && startApi(), delay);
  });
}

function restartApi(reason) {
  log('api', `${reason} — restarting`);
  if (!api) return startApi();
  const old = api;
  old.once('exit', () => !stopping && startApi());
  old.kill('SIGTERM');
}

const fingerprints = new Map();
const fingerprint = (file) => {
  try {
    const s = statSync(file);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return 'missing';
  }
};
function snapshot(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) snapshot(full);
    else if (/\.(js|mjs|json)$/.test(entry.name) && !entry.name.includes('.test.')) fingerprints.set(full, fingerprint(full));
  }
}

let reloadTimer = null;
function watchSources() {
  for (const dir of WATCH_DIRS) {
    const abs = path.join(ROOT, dir);
    snapshot(abs);
    watch(abs, { recursive: true }, (_event, rel) => {
      if (!rel || !/\.(js|mjs|json)$/.test(rel) || rel.includes('.test.')) return;
      const file = path.join(abs, rel);
      const next = fingerprint(file);
      if (fingerprints.get(file) === next) return; // read/attribute-only event
      fingerprints.set(file, next);
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => restartApi(`${dir}/${rel.replace(/\\/g, '/')} changed`), 300);
    });
  }
}

// --- main ---------------------------------------------------------------
const [apiBusy, webBusy] = await Promise.all([portInUse(API_PORT), portInUse(WEB_PORT)]);
if (apiBusy && webBusy) {
  log('dev', `Already running → http://localhost:${WEB_PORT} (API on :${API_PORT}). Nothing to start.`);
  process.exit(0);
}

if (apiBusy) log('dev', `API already running on :${API_PORT} — reusing it.`);
else {
  startApi();
  watchSources();
}

let web = null;
if (webBusy) log('dev', `Web already running on :${WEB_PORT} — reusing it.`);
else {
  web = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js')], { cwd: ROOT, env: process.env });
  pipe('web', web);
  web.on('exit', (code) => !stopping && log('web', `Vite exited (code ${code}). The API keeps running.`));
}

log('dev', `Open http://localhost:${WEB_PORT} — Ctrl+C stops both.`);

const shutdown = () => {
  stopping = true;
  api?.kill('SIGTERM');
  web?.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
