import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { createRefresher } from './scheduler.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4000);

const { client, db } = await connectDb();
const refresher = createRefresher(db);
if (process.env.ENABLE_CRON !== 'false') refresher.start();

const app = createApp({ db, refresher, staticDir: path.join(ROOT, 'dist') });
const server = app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
server.on('error', async (err) => {
  console.error(err.code === 'EADDRINUSE' ? `[api] Port ${port} is already in use — is the API already running?` : err);
  await client.close();
  process.exit(1);
});

// A stray rejected promise (e.g. a failed background pipeline step) must not
// take the API down; Express already handles errors inside requests.
process.on('unhandledRejection', (reason) => console.error('[api] unhandled rejection:', reason));

const shutdown = async () => {
  refresher.stop();
  server.close();
  await client.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
