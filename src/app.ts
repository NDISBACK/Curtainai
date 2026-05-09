import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { requestLogger } from './middleware/logger';
import { notFound, errorHandler } from './middleware/errorHandler';
import { correlationId } from './middleware/correlationId';
import routes from './routes';
import mcpRoutes from './routes/mcpRoutes';

const app = express();

// Security & parsing
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Babel standalone transpiles in-browser JSX using eval/new Function.
      // Allow unsafe-eval so static JSX files in /public can render.
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({
  origin: [
    'https://curtainai.in',
    'https://www.curtainai.in',
    /^http:\/\/localhost(:\d+)?$/,
  ],
  credentials: true,
}));

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Correlation ID — must be before logging so log lines carry the ID
app.use(correlationId);

// Logging
app.use(requestLogger);

// REST API
app.use('/api/v1', routes);

// MCP server — JSON-RPC 2.0 interface for AI agent tool use
// Separate namespace from /api/v1 so MCP clients can point at a clean base URL
app.use('/mcp/v1', mcpRoutes);

// 404 & error handling — must be last
app.use(notFound);
app.use(errorHandler);

export default app;
