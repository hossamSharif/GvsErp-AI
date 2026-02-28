/**
 * Auth Routes
 *
 * Authentication endpoints for login, register, and session management.
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { loginSchema, registerSchema } from '@erp/shared';
import { validateBody, asyncHandler, AppError, authRateLimiter } from '../middleware';
import type { Database } from '@erp/database';

const router: Router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service client for admin operations
function getServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const supabase = getServiceClient();

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Get user details with tenant info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(*),
        tenant:tenants(*)
      `)
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      throw AppError.unauthorized('User not found');
    }

    if (!userData.is_active) {
      throw AppError.forbidden('Account is deactivated');
    }

    res.json({
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          preferences: userData.preferences,
          tenant: userData.tenant,
        },
      },
    });
  })
);

/**
 * POST /auth/register
 * Register new tenant with admin user
 */
router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, tenant_name, full_name } = req.body;

    const supabase = getServiceClient();

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      throw AppError.internal('Failed to create user');
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: tenant_name,
      })
      .select()
      .single();

    if (tenantError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.error('Tenant creation error:', tenantError);
      throw AppError.internal('Failed to create organization');
    }

    // Get admin role for tenant (created by trigger)
    const { data: adminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('name', 'admin')
      .single();

    // Create user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        tenant_id: tenant.id,
        email: email.toLowerCase(),
        full_name: full_name || null,
        role_id: adminRole?.id || null,
      })
      .select(`
        *,
        role:roles(*),
        tenant:tenants(*)
      `)
      .single();

    if (userError) {
      // Rollback
      await supabase.from('tenants').delete().eq('id', tenant.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.error('User creation error:', userError);
      throw AppError.internal('Failed to create user profile');
    }

    // Update auth user metadata with tenant_id
    await supabase.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        tenant_id: tenant.id,
        role: 'admin',
        permissions: ['*'],
      },
    });

    // Sign in the new user
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      throw AppError.internal('Registration successful, please login');
    }

    res.status(201).json({
      data: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          preferences: user.preferences,
          tenant: user.tenant,
        },
      },
    });
  })
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw AppError.badRequest('Refresh token required');
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    res.json({
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  })
);

/**
 * POST /auth/logout
 * Sign out user
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = getServiceClient();
      await supabase.auth.admin.signOut(token);
    }

    res.status(204).send();
  })
);

/**
 * GET /auth/me
 * Get current user profile
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authorization required');
    }

    const token = authHeader.substring(7);
    const supabase = getServiceClient();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw AppError.unauthorized('Invalid token');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(*),
        tenant:tenants(*)
      `)
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw AppError.notFound('User profile not found');
    }

    res.json({
      data: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        preferences: userData.preferences,
        tenant: userData.tenant,
      },
    });
  })
);

export default router;
