# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth for social login and sign-up in the ERP SaaS platform.

## Overview

The implementation supports:
- **Sign in with Google** on the login page
- **Sign up with Google** on the registration page
- Automatic tenant creation for new OAuth users
- Onboarding flow for OAuth users without a tenant

## Prerequisites

1. A Supabase project
2. A Google Cloud Platform account
3. Access to your Supabase dashboard

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### 1.2 Enable Google+ API

1. Go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application** as the application type
4. Configure the OAuth consent screen if prompted:
   - Add your app name
   - Add your support email
   - Add authorized domains (e.g., `yourdomain.com`)
   - Save

5. Configure OAuth client:
   - **Name**: ERP SaaS (or your preferred name)
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**:
     - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

   Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference.

6. Click **Create**
7. Copy the **Client ID** and **Client Secret** (you'll need these for Supabase)

## Step 2: Configure Supabase

### 2.1 Enable Google Provider in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list
5. Enable the Google provider
6. Enter your **Client ID** and **Client Secret** from Google Cloud Console
7. Click **Save**

### 2.2 Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add the following to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)
3. Click **Save**

## Step 3: Update Environment Variables

No additional environment variables are needed! The OAuth configuration uses the existing Supabase credentials:

```env
# These should already be set in your .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Step 4: Test the OAuth Flow

### 4.1 Development Testing

1. Start your development servers:
   ```bash
   pnpm dev
   ```

2. Navigate to `http://localhost:3000/en/login`

3. Click the **Continue with Google** button

4. You should be redirected to Google's OAuth consent screen

5. After authorizing, you'll be redirected back to your app

### 4.2 Test Scenarios

#### Scenario 1: New User (First-time OAuth Sign-in)

1. Click **Continue with Google** on login or register page
2. Complete Google authentication
3. You'll be redirected to the onboarding page (`/onboarding`)
4. Enter your organization name
5. Click **Continue**
6. You'll be redirected to the dashboard with a new tenant created

#### Scenario 2: Existing User (Return OAuth Sign-in)

1. Click **Continue with Google** on login page
2. Complete Google authentication
3. You'll be redirected directly to the dashboard

#### Scenario 3: Email/Password User Switching to OAuth

If a user already has an account with email/password using the same email:
- Supabase will link the accounts automatically
- The user can sign in with either method

## How It Works

### Authentication Flow

1. **User Clicks "Continue with Google"**
   - Frontend calls `signInWithGoogle()` from auth provider
   - Redirects to Google OAuth consent screen

2. **Google Authorization**
   - User authorizes the app
   - Google redirects to `/auth/callback` with an auth code

3. **Callback Handler** (`/auth/callback/route.ts`)
   - Exchanges code for session
   - Checks if user has a tenant
   - If no tenant: redirects to `/onboarding`
   - If tenant exists: redirects to dashboard

4. **Onboarding** (for new OAuth users)
   - User enters organization name
   - Frontend calls `/api/v1/auth/onboard`
   - Backend creates tenant and user profile
   - Redirects to dashboard

### Backend Implementation

#### `/api/v1/auth/onboard` Endpoint

```typescript
POST /auth/onboard
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "tenant_name": "My Company Inc."
}
```

**Response:**
```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": { ... },
    "tenant": { ... }
  }
}
```

**What it does:**
1. Verifies the user is authenticated
2. Checks if user already has a tenant (prevents duplicates)
3. Creates a new tenant
4. Creates/updates user profile with tenant association
5. Assigns admin role
6. Updates user metadata in Supabase Auth

## Security Considerations

### 1. Tenant Isolation

- Each OAuth user gets their own tenant
- RLS policies ensure data isolation
- Users cannot access other tenants' data

### 2. Role Assignment

- OAuth users are automatically assigned the "admin" role for their tenant
- This is appropriate for new sign-ups where they're creating their own organization

### 3. Email Verification

- Google OAuth provides verified email addresses
- No additional email verification is needed

### 4. Session Management

- Sessions are managed by Supabase
- Tokens are stored securely in HTTP-only cookies
- Refresh tokens are used for session persistence

## Troubleshooting

### Issue: "OAuth callback error"

**Solution:** Check that:
- Redirect URLs are correctly configured in both Google Console and Supabase
- The Supabase project reference in Google redirect URI matches your project

### Issue: "User profile not found" error after OAuth

**Solution:** Check that:
- The `/auth/onboard` endpoint is working
- Database migrations are up to date
- RLS policies allow user insertion

### Issue: OAuth button doesn't redirect

**Solution:** Check:
- Browser console for errors
- Supabase URL and anon key are correct
- Google OAuth credentials are properly configured

### Issue: "Organization already exists" error

**Solution:**
- This means the user already completed onboarding
- They should be able to sign in directly
- Check the callback handler logic

## Production Deployment Checklist

- [ ] Update Google OAuth authorized origins to production URL
- [ ] Update Google OAuth redirect URIs to production callback URL
- [ ] Update Supabase redirect URLs to production
- [ ] Set production environment variables
- [ ] Test OAuth flow in production
- [ ] Configure OAuth consent screen (branding, privacy policy, terms)
- [ ] Submit for Google OAuth verification (if needed for production)

## Multi-Provider Support

This implementation can be easily extended to support other OAuth providers:

1. **Add provider to Supabase**: Enable in Authentication → Providers
2. **Update auth provider**: Add `signInWithProvider()` method
3. **Add UI button**: Copy Google button pattern
4. **Add translations**: Add provider-specific translations
5. **Test flow**: Same onboarding flow works for all providers

Supported providers:
- Google (implemented)
- GitHub (easy to add)
- Azure AD (easy to add)
- Facebook (easy to add)
- Twitter (easy to add)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
