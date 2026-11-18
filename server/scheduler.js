import cron from 'node-cron';
import { runPipeline } from '../pipeline/run.js';

/**
 * Runs the pipeline daily (default 06:30 IST) and on demand. Only one run at
 * a time; status is kept in memory for /api/admin/status.
 */
export function createRefresher(db, { schedule = process.env.CRON_SCHEDULE || '30 6 * * *', timezone = process.env.CRON_TZ || 'Asia/Kolkata' } = {}) {
  let running = null;
  let last = null;

  const trigger = (reason) => {
    if (running) return false;
    const startedAt = new Date();
    running = { reason, startedAt };
    runPipeline({ db, log: (m) => console.log(`[pipeline] ${typeof m === 'string' ? m : JSON.stringify(m)}`) })
      .then((run) => {
        last = { reason, startedAt, finishedAt: new Date(), ok: true, published: run?.counts.published };
      })
      .catch((err) => {
        console.error('[pipeline] failed:', err);
        last = { reason, startedAt, finishedAt: new Date(), ok: false, error: String(err.message || err) };
      })
      .finally(() => {
        running = null;
      });
    return true;
  };

  let task = null;
  return {
    trigger,
    status: () => ({ running, last, schedule, timezone, scheduled: Boolean(task) }),
    start() {
      task = cron.schedule(schedule, () => trigger('cron'), { timezone });
      console.log(`[scheduler] daily refresh "${schedule}" (${timezone})`);
    },
    stop: () => task?.stop(),
  };
}
