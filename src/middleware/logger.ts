import morgan from 'morgan';
import { env } from '../config/env';

const format = env.isDev ? 'dev' : ':remote-addr :method :url :status :res[content-length] - :response-time ms';

export const requestLogger = morgan(format);
