import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  errorHandler,
  notFoundHandler,
  apiRateLimiter,
} from './middleware';
import apiRoutes from './routes';

const app: Express = express();
const port = process.env.PORT || 3001;

// Request ID middleware
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
  next();
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API routes
app.use('/api', apiRateLimiter);

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info endpoint
app.get('/api', (_req, res) => {
  res.json({
    message: 'ERP SaaS API',
    version: '1.0.0',
    docs: '/api/docs',
  });
});

// API Routes
app.use('/api/v1', apiRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
