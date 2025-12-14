# FoundationOS - Architecture & Implementation Plan

## Overview

**FoundationOS** is a multi-tenant association management system designed to serve IRF (Illinois Recycling Foundation) and AAfPE (American Association for Paralegal Education) from a single codebase.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14+ (App Router) | Full-stack React with SSR |
| Database | Supabase (PostgreSQL) | Data, auth, storage, realtime |
| Auth | Supabase Auth | SSO-ready, magic links, OAuth |
| Payments | Stripe | Dues, donations, tickets |
| Email | Sendy / Resend | Transactional + marketing |
| Hosting | Vercel / AWS Lightsail | Your choice |
| UI | Tailwind CSS + shadcn/ui | Rapid, accessible components |
| Version Control | GitHub | CI/CD integration |

## Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FoundationOS                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     IRF      │  │    AAfPE     │  │   Future     │      │
│  │   Tenant     │  │   Tenant     │  │   Tenants    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                    Shared Core Services                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  Auth   │ │ Members │ │ Events  │ │ Finance │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Grants  │ │   CMS   │ │  Email  │ │ Reports │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
├─────────────────────────────────────────────────────────────┤
│              Supabase (Postgres + Auth + Storage)           │
└─────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### Phase 1: Core Foundation (Weeks 1-4)
- [x] Database schema design
- [ ] Supabase project setup
- [ ] Authentication (magic link, Google OAuth)
- [ ] Organization/tenant management
- [ ] User profiles & roles
- [ ] Admin dashboard shell

### Phase 2: Membership (Weeks 5-8)
- [ ] Membership plans & tiers
- [ ] Join/renewal workflows
- [ ] Stripe subscription integration
- [ ] Member directory (public + private)
- [ ] Member portal (self-service)
- [ ] Automated renewal reminders

### Phase 3: Events & Conferences (Weeks 9-12)
- [ ] Event creation & management
- [ ] Ticket types & pricing tiers
- [ ] Registration with custom fields
- [ ] Stripe checkout for tickets
- [ ] Attendee management & check-in
- [ ] Speaker/session management
- [ ] Sponsor/exhibitor tracking

### Phase 4: Finance & Donations (Weeks 13-16)
- [ ] Donation forms (one-time + recurring)
- [ ] Campaign management
- [ ] Financial dashboard & reports
- [ ] Invoice generation
- [ ] QuickBooks/Xero export
- [ ] Receipt automation

### Phase 5: Grants (Weeks 17-20)
- [ ] Grant program setup
- [ ] Application forms & workflows
- [ ] Review panel & scoring
- [ ] Award tracking & disbursements
- [ ] Compliance reporting

### Phase 6: CMS & Communications (Weeks 21-24)
- [ ] Page builder (basic)
- [ ] Blog/news management
- [ ] Member-only content gating
- [ ] Email template builder
- [ ] Automated email workflows
- [ ] Social media scheduling

### Phase 7: Mobile App (Weeks 25-30)
- [ ] React Native (Expo) setup
- [ ] Member directory mobile
- [ ] Event registration mobile
- [ ] Push notifications
- [ ] Digital membership cards

## Directory Structure

```
foundation-os/
├── docs/                    # Documentation
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed/                # Seed data
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth pages (login, signup)
│   │   ├── (public)/        # Public pages
│   │   ├── (portal)/        # Member portal
│   │   ├── (admin)/         # Admin dashboard
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── forms/           # Form components
│   │   ├── layouts/         # Layout components
│   │   └── modules/         # Feature-specific components
│   ├── lib/
│   │   ├── supabase/        # Supabase client & helpers
│   │   ├── stripe/          # Stripe integration
│   │   ├── email/           # Email utilities
│   │   └── utils/           # General utilities
│   └── types/               # TypeScript types
├── public/                  # Static assets
└── package.json
```

## Security Model

### Row-Level Security (RLS)
All tables use Supabase RLS policies:
- Users can only access data within their organization(s)
- Role-based access: `owner` > `admin` > `staff` > `member`
- Financial data restricted to `admin` and `finance` roles
- Audit logs are append-only

### Roles & Permissions

| Role | Members | Events | Finance | Grants | CMS | Settings |
|------|---------|--------|---------|--------|-----|----------|
| Owner | Full | Full | Full | Full | Full | Full |
| Admin | Full | Full | View | Full | Full | View |
| Staff | Edit | Edit | None | Edit | Edit | None |
| Finance | View | View | Full | View | None | None |
| Member | Self | Register | None | Apply | None | None |

## Integration Points

### Stripe
- Customer sync with member records
- Subscription management for dues
- One-time payments for donations/tickets
- Webhook handling for payment events
- Connect accounts for chapter splits (future)

### Email (Sendy/Resend)
- Transactional: receipts, confirmations, password resets
- Marketing: newsletters, renewal reminders
- Event: registration confirmations, reminders
- List sync with member segments

### Calendar
- iCal feed generation for events
- Google Calendar integration (optional)

### Accounting
- QuickBooks Online API (future)
- CSV export for manual import

## Performance Considerations

- Edge caching for public pages
- Incremental Static Regeneration for directories
- Database indexes on common queries
- Connection pooling via Supabase
- Image optimization via Next.js

## Deployment Strategy

### Development
```bash
# Local development
pnpm dev

# Database migrations
supabase db push

# Type generation
supabase gen types typescript --local > src/types/database.ts
```

### Production
- Vercel for Next.js hosting (recommended)
- Supabase Cloud for database
- GitHub Actions for CI/CD
- Preview deployments for PRs

## Cost Estimates (Monthly)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Stripe | Transaction fees | ~2.9% + $0.30 |
| Sendy | Self-hosted | $0 (SES costs) |
| Domain | Annual | ~$15/year |
| **Total** | | **~$50/month + transaction fees** |

---

## Next Steps

1. Create Supabase project
2. Run initial migration
3. Set up GitHub repo
4. Deploy to Vercel
5. Configure Stripe test mode
6. Build first module (Auth + Members)
