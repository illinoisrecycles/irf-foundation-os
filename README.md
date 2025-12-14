# FoundationOS

A comprehensive association management system for nonprofits, built with Next.js, Supabase, and Stripe.

## Features

- **Multi-tenant Architecture**: Manage multiple organizations (IRF, AAfPE, etc.) from one installation
- **Member Management**: Profiles, directories, dues tracking, renewal automation
- **Events & Conferences**: Registration, ticketing, speaker management, check-in
- **Donations**: One-time and recurring donations, campaigns, acknowledgments
- **Grants**: Application workflows, review panels, disbursements
- **CMS**: Pages, blog posts, member-only content
- **Financial Reports**: Dashboards, exports, QuickBooks integration

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (magic links, OAuth)
- **Payments**: Stripe (subscriptions, one-time, recurring)
- **UI**: shadcn/ui components

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- Stripe account

### 1. Clone and Install

```bash
git clone https://github.com/your-org/foundation-os.git
cd foundation-os
pnpm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:
   ```bash
   # Copy contents of supabase/migrations/001_initial_schema.sql
   # Paste into Supabase SQL Editor and run
   ```
3. Copy your project URL and keys from Settings > API

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```
# New Supabase keys (recommended)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Or legacy keys (still work until late 2026)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Set Up Stripe

1. Create products for membership plans in Stripe Dashboard
2. Copy the Price IDs to your membership_plans table
3. Set up webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
foundation-os/
├── docs/                    # Documentation
│   └── ARCHITECTURE.md      # System architecture
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed/                # Seed data
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (admin)/         # Admin dashboard routes
│   │   ├── (auth)/          # Authentication pages
│   │   ├── (portal)/        # Member portal
│   │   ├── (public)/        # Public website
│   │   └── api/             # API routes
│   ├── components/          # React components
│   ├── lib/                 # Utilities and clients
│   │   ├── supabase/        # Supabase client
│   │   └── stripe/          # Stripe integration
│   └── types/               # TypeScript types
└── public/                  # Static assets
```

## Development

### Generate Database Types

After schema changes:

```bash
pnpm db:generate
```

### Add shadcn/ui Components

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
# etc.
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Self-Hosted

```bash
pnpm build
pnpm start
```

## Roadmap

- [x] Database schema
- [x] Admin dashboard shell
- [ ] Authentication flow
- [ ] Member management
- [ ] Stripe integration
- [ ] Event registration
- [ ] Donation forms
- [ ] Grant applications
- [ ] CMS
- [ ] Mobile app (React Native)

## License

MIT
