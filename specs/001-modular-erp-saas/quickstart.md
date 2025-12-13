# Quickstart: Modular ERP SaaS Platform

**Branch**: `001-modular-erp-saas` | **Date**: 2025-12-13

---

## Prerequisites

- Node.js 20.x or later
- pnpm 8.x or later (`npm install -g pnpm`)
- Git
- Supabase account (free tier works)
- Stripe account (test mode)

---

## Project Setup

### 1. Initialize Monorepo

```bash
# Create root directory
mkdir erp-saas && cd erp-saas

# Initialize pnpm workspace
pnpm init

# Create workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Install Turborepo
pnpm add -D turbo

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
EOF
```

### 2. Create Shared Package

```bash
mkdir -p packages/shared/src

# Initialize package
cat > packages/shared/package.json << 'EOF'
{
  "name": "@erp/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest"
  }
}
EOF

# Create types entry
cat > packages/shared/src/index.ts << 'EOF'
export * from './types';
export * from './constants';
export * from './validation';
EOF
```

### 3. Create Next.js Frontend

```bash
cd apps
pnpm create next-app web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd web

# Install dependencies
pnpm add @tanstack/react-query zustand next-intl @supabase/supabase-js @supabase/ssr
pnpm add @tanstack/react-table @tanstack/react-virtual
pnpm add -D @types/node

# Install shadcn/ui
pnpm dlx shadcn@latest init
```

**shadcn/ui configuration** (when prompted):
- Style: Default
- Base color: Slate (we'll customize)
- CSS variables: Yes
- Global CSS: src/styles/globals.css
- Tailwind config: tailwind.config.ts
- Components: @/components
- Utils: @/lib/utils

```bash
# Add core shadcn components
pnpm dlx shadcn@latest add button card input label table dialog dropdown-menu form select tabs toast
```

### 4. Configure Brand Theme

Update `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
      spacing: {
        // 8px baseline grid
        '1': '0.5rem',   // 8px
        '2': '1rem',     // 16px
        '3': '1.5rem',   // 24px
        '4': '2rem',     // 32px
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

Update `src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand palette */
    --primary: 150 56% 24%;           /* #24543A Deep Green */
    --primary-foreground: 40 15% 93%; /* Light text on primary */

    --accent: 43 51% 57%;             /* #C8A55A Muted Gold */
    --accent-foreground: 0 0% 12%;    /* Dark text on accent */

    --background: 40 27% 93%;         /* #F4F0E8 Off-White */
    --foreground: 0 0% 12%;           /* #1E1E1E Charcoal */

    --muted: 35 8% 60%;               /* Warm Grey */
    --muted-foreground: 35 8% 40%;    /* #6F6A61 */

    /* shadcn required variables */
    --card: 40 27% 96%;
    --card-foreground: 0 0% 12%;
    --popover: 40 27% 96%;
    --popover-foreground: 0 0% 12%;
    --secondary: 40 15% 88%;
    --secondary-foreground: 0 0% 12%;
    --border: 40 15% 85%;
    --input: 40 15% 85%;
    --ring: 150 56% 24%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 12%;
    --foreground: 40 27% 93%;
    --card: 0 0% 15%;
    --card-foreground: 40 27% 93%;
    --popover: 0 0% 15%;
    --popover-foreground: 40 27% 93%;
    --muted: 0 0% 20%;
    --muted-foreground: 40 15% 70%;
    --border: 0 0% 25%;
    --input: 0 0% 25%;
  }

  /* RTL support */
  [dir="rtl"] {
    text-align: right;
  }
}
```

### 5. Create Express Backend

```bash
cd apps
mkdir -p api/src

# Initialize package
cat > api/package.json << 'EOF'
{
  "name": "@erp/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
EOF

cd api
pnpm add express cors helmet
pnpm add @supabase/supabase-js stripe zod
pnpm add -D @types/express @types/cors tsx typescript vitest supertest @types/supertest
```

Create `api/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes will be added here
// app.use('/api/v1/items', itemRoutes);
// app.use('/api/v1/invoices', invoiceRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

### 6. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Get your project URL and anon key from Settings > API
3. Create `.env.local` files:

**apps/web/.env.local**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**apps/api/.env**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 7. Run Database Migrations

In Supabase SQL Editor, run initial migration (see `packages/database/migrations/001_initial_schema.sql` for full schema).

Quick test migration:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subscription_plan TEXT DEFAULT 'freemium',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
```

---

## Development Workflow

### Start Development Servers

```bash
# From root directory
pnpm dev
```

This runs:
- Next.js frontend at http://localhost:3000
- Express API at http://localhost:3001

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @erp/api test
pnpm --filter web test
```

### Building for Production

```bash
pnpm build
```

---

## Project Structure Reference

```
erp-saas/
├── apps/
│   ├── web/                # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/        # App Router pages
│   │   │   ├── components/ # React components
│   │   │   ├── hooks/      # Custom hooks
│   │   │   ├── lib/        # Utilities
│   │   │   ├── stores/     # Zustand stores
│   │   │   └── locales/    # i18n translations
│   │   └── package.json
│   │
│   └── api/                # Express backend
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   ├── services/   # Business logic
│       │   ├── middleware/ # Express middleware
│       │   └── index.ts    # Entry point
│       └── package.json
│
├── packages/
│   ├── shared/             # Shared TypeScript types
│   ├── ui/                 # Extended UI components
│   └── database/           # Migrations, Supabase client
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Next Steps

1. **Phase 1**: Implement authentication with Supabase Auth
2. **Phase 2**: Build Items CRUD with DataTable component
3. **Phase 3**: Implement invoice creation with autosave
4. See `plan.md` for complete implementation phases

---

## Useful Commands

```bash
# Add a dependency to a specific package
pnpm --filter web add <package>
pnpm --filter @erp/api add <package>

# Add a shadcn component
pnpm --filter web dlx shadcn@latest add <component>

# Generate Supabase types
pnpm supabase gen types typescript --project-id <project-id> > packages/database/src/types.ts

# Lint all packages
pnpm lint

# Format code
pnpm format
```
