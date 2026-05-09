import { env } from '../config/env';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  environment: string;
  uptime: number;
}

export const healthService = {
  check(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
    };
  },
};
