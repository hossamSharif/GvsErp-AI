import 'dotenv/config';
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
import accountRoutes from './routes/accounts.routes';
import journalEntryRoutes from './routes/journal-entries.routes';
import accountingRoutes from './routes/accounting.routes';
import expenseRoutes from './routes/expenses.routes';
import expenseCategoryRoutes from './routes/expense-categories.routes';
import subscriptionRoutes from './routes/subscription.routes';
import webhookRoutes from './routes/webhooks.routes';
import settingsRoutes from './routes/settings.routes';
import userRoutes from './routes/users.routes';
import roleRoutes from './routes/roles.routes';
import currencyRoutes from './routes/currencies.routes';
import exchangeRateRoutes from './routes/exchange-rates.routes';
import auditRoutes from './routes/audit.routes';
import employeeRoutes from './routes/employees.routes';
import attendanceRoutes from './routes/attendance.routes';
import payrollRoutes from './routes/payroll.routes';
import aiConversationsRoutes from './routes/ai-conversations.routes';

const app = express();
const port = process.env.PORT || 3001;

// Request ID middleware
app.use((req, _res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Security middleware
app.use(helmet());

// Stripe webhook endpoint needs raw body BEFORE json parsing
// This must be registered before express.json() middleware
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/api/v1/webhooks', webhookRoutes);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3100',
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
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
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/expense-categories', expenseCategoryRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/currencies', currencyRoutes);
app.use('/api/v1/exchange-rates', exchangeRateRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/ai/conversations', aiConversationsRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
