import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { logger } from './utils/logger';
import app from './app';

const server = app.listen(env.PORT, () => {
  console.log(`[server] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

// ─── Analytics refresh ────────────────────────────────────────────────────────
// Keeps workspace_daily_stats and skill_daily_stats materialized views fresh.
// For multi-instance deployments, replace with a Supabase cron job or pg_cron.
const ANALYTICS_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const analyticsRefreshTimer = setInterval(async () => {
  try {
    await supabaseAdmin.rpc('refresh_analytics');
  } catch (err) {
    logger.error('analytics.refresh_failed', { error: String(err) });
  }
}, ANALYTICS_REFRESH_MS);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const shutdown = (signal: string) => {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  clearInterval(analyticsRefreshTimer);
  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  clearInterval(analyticsRefreshTimer);
  server.close(() => process.exit(1));
});
