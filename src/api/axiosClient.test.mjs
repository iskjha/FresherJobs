// Bundles the real axios client with esbuild (resolving the @ alias) and runs
// it against a local server, to check that a briefly-restarting API is
// retried instead of surfacing an error.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(ROOT, `node_modules/.cache/axiosClient.test.${process.pid}.mjs`);
let server;
let client;
let failuresLeft = 0;
let hits = 0;

before(async () => {
  server = http
    .createServer((_req, res) => {
      hits++;
      const fail = failuresLeft-- > 0;
      res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(fail ? '{"error":"API is restarting"}' : '{"ok":true}');
    })
    .listen(0);
  await build({
    entryPoints: [path.join(ROOT, 'src/api/axiosClient.js')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    external: ['axios'],
    alias: { '@': path.join(ROOT, 'src') },
    define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: `http://127.0.0.1:${server.address().port}/api` }) },
    logLevel: 'error',
  });
  client = (await import(pathToFileURL(outfile).href)).default;
});

after(() => {
  server?.close();
  rmSync(outfile, { force: true });
});

test('retries 503s while the API restarts, then succeeds', async () => {
  failuresLeft = 2;
  hits = 0;
  const res = await client.post('jobs/board', { filters: {} });
  assert.deepEqual(res.data, { ok: true });
  assert.equal(hits, 3);
});

test('does not retry real client errors', async () => {
  const s = http.createServer((_req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end('{"error":"Invalid cursor"}');
  });
  await new Promise((r) => s.listen(0, r));
  let calls = 0;
  s.on('request', () => calls++);
  await assert.rejects(client.get(`http://127.0.0.1:${s.address().port}/x`), { message: 'Invalid cursor', status: 400 });
  assert.equal(calls, 1);
  s.close();
});
