/**
 * Auth Validation Schemas
 *
 * Zod schemas for authentication-related requests.
 */

import { z } from 'zod';

// ============================================
// COMMON VALIDATORS
// ============================================

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const passwordSimpleSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters');

// ============================================
// LOGIN
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSimpleSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// REGISTER
// ============================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  tenant_name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must be less than 255 characters')
    .trim(),
  full_name: z
    .string()
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================
// PASSWORD RESET
// ============================================

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================
// CHANGE PASSWORD
// ============================================

export const changePasswordSchema = z.object({
  current_password: passwordSimpleSchema,
  new_password: passwordSchema,
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
}).refine((data) => data.current_password !== data.new_password, {
  message: 'New password must be different from current password',
  path: ['new_password'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================
// UPDATE PROFILE
// ============================================

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
  preferences: z.object({
    language: z.enum(['en', 'ar']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    sidebar_collapsed: z.boolean().optional(),
  }).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================
// REFRESH TOKEN
// ============================================

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
