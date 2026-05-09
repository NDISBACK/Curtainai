import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();

  if (env.isDev) {
    const prefix = level === 'error' ? '✗' : level === 'warn' ? '▲' : '→';
    const extra = data ? ' ' + JSON.stringify(data) : '';
    console.log(`[${timestamp}] ${prefix} ${event}${extra}`);
  } else {
    console.log(JSON.stringify({ level, event, timestamp, ...data }));
  }
}

export const logger = {
  info:  (event: string, data?: Record<string, unknown>) => log('info',  event, data),
  warn:  (event: string, data?: Record<string, unknown>) => log('warn',  event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
};
