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

// Protected routes (added in later phases)
// app.use('/api/v1/items', authMiddleware, tenantMiddleware, itemRoutes);
// app.use('/api/v1/invoices', authMiddleware, tenantMiddleware, invoiceRoutes);
// app.use('/api/v1/parties', authMiddleware, tenantMiddleware, partyRoutes);
// app.use('/api/v1/warehouses', authMiddleware, tenantMiddleware, warehouseRoutes);
// app.use('/api/v1/payments', authMiddleware, tenantMiddleware, paymentRoutes);
// app.use('/api/v1/expenses', authMiddleware, tenantMiddleware, expenseRoutes);
// app.use('/api/v1/reports', authMiddleware, tenantMiddleware, reportRoutes);
// app.use('/api/v1/settings', authMiddleware, tenantMiddleware, settingsRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
