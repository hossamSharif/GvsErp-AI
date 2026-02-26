import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import accountRoutes from './routes/accounts.routes';
import journalEntryRoutes from './routes/journal-entries.routes';
import accountingRoutes from './routes/accounting.routes';
import currencyRoutes from './routes/currencies.routes';
import exchangeRateRoutes from './routes/exchange-rates.routes';
import employeeRoutes from './routes/employees.routes';
import attendanceRoutes from './routes/attendance.routes';
import payrollRoutes from './routes/payroll.routes';
import roleRoutes from './routes/roles.routes';
import userRoutes from './routes/users.routes';
import settingsRoutes from './routes/settings.routes';
import auditRoutes from './routes/audit.routes';

const app = express();
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
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/journal-entries', journalEntryRoutes);
app.use('/api/v1/accounting', accountingRoutes);
app.use('/api/v1/currencies', currencyRoutes);
app.use('/api/v1/exchange-rates', exchangeRateRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/audit', auditRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
