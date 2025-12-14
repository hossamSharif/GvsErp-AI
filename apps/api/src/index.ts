import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import {
  errorHandler,
  notFoundHandler,
  apiRateLimiter,
} from './middleware';
import authRoutes from './routes/auth.routes';
import itemRoutes from './routes/items.routes';
import categoryRoutes from './routes/categories.routes';
import invoiceRoutes from './routes/invoices.routes';
import reportRoutes from './routes/reports.routes';
import warehouseRoutes from './routes/warehouses.routes';
import transferRoutes from './routes/transfers.routes';
import posRoutes from './routes/pos.routes';
import partyRoutes from './routes/parties.routes';
import paymentRoutes from './routes/payments.routes';

const app = express();
const port = process.env.PORT || 3001;

// Request ID middleware
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/warehouses', warehouseRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/parties', partyRoutes);
app.use('/api/v1/payments', paymentRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(\`API server running on http://localhost:\${port}\`);
});

export default app;
