# FoundationOS: Path to Best-in-Class

## Executive Summary

After analyzing the codebase, FoundationOS has a solid foundation with 44,000+ lines of code covering core membership, events, donations, grants, and governance. However, to be truly **best-in-class** and compete with platforms like MemberClicks, Wild Apricot, Fonteva, and Bloomerang, we need to address gaps in **self-service, financial operations, integrations, and UX polish**.

---

## Current State Assessment

### ✅ What We Have (Strong Foundation)
| Area | Status | Completeness |
|------|--------|--------------|
| Multi-tenant architecture | ✅ Complete | 95% |
| Member management | ✅ Complete | 85% |
| Events & check-in | ✅ Complete | 80% |
| Donations & Stripe | ✅ Complete | 85% |
| Grants lifecycle | ✅ Complete | 90% |
| AI bookkeeping | ✅ Complete | 75% |
| Automation engine | ✅ Complete | 85% |
| Approvals/governance | ✅ Complete | 80% |
| Board meetings | ✅ Complete | 70% |
| Work items inbox | ✅ Complete | 80% |

### ❌ Critical Gaps (Blocking Production Use)
| Gap | Impact | Effort |
|-----|--------|--------|
| No settings/org config page | Can't customize org | Medium |
| No password reset flow | Users get locked out | Low |
| No invoice generation | Can't bill members | High |
| No payment history in portal | Members can't see receipts | Medium |
| No email verification | Security risk | Low |
| No user invitation system | Can't add team members | Medium |

---

## Priority 1: Production Essentials (Week 1-2)

These must be completed before any real organization can use the platform.

### 1.1 Settings & Organization Profile
```
/admin/settings
├── /general          # Org name, logo, timezone, fiscal year
├── /billing          # Stripe connect, payment settings
├── /team             # User management, roles, invitations
├── /notifications    # Email preferences, digest settings
├── /integrations     # Connected apps, API keys
└── /security         # 2FA settings, session management
```

**Key Features:**
- Upload organization logo
- Configure fiscal year (Jan-Dec vs Jul-Jun)
- Set default timezone for events
- Enable/disable features (grants, events, etc.)
- Configure email sender name/reply-to

### 1.2 Authentication Completion
```
/login              ✅ Exists
/signup             ❌ Missing - Member self-registration
/forgot-password    ❌ Missing - Password reset flow
/reset-password     ❌ Missing - Token-based reset
/verify-email       ❌ Missing - Email verification
/accept-invite      ❌ Missing - Team member onboarding
```

### 1.3 Invoice System
```sql
-- New table: invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  member_organization_id UUID REFERENCES member_organizations(id),
  invoice_number TEXT UNIQUE,
  status TEXT DEFAULT 'draft', -- draft, sent, paid, overdue, void
  due_date TIMESTAMPTZ,
  line_items JSONB, -- [{description, quantity, unit_price_cents, total_cents}]
  subtotal_cents INTEGER,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER,
  paid_cents INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  notes TEXT
);
```

**Features:**
- Auto-generate for membership renewals
- Manual invoice creation
- PDF generation with org branding
- Email invoice with pay link
- Partial payments support
- Overdue reminders automation

### 1.4 Portal Payment History
```
/portal/billing
├── Current membership status
├── Upcoming renewal date & amount
├── Payment history table
├── Download receipts (PDF)
├── Update payment method
└── Cancel/modify membership
```

---

## Priority 2: Self-Service & Engagement (Week 3-4)

### 2.1 Member Self-Service Portal Enhancements

**Profile Completion:**
- Profile completeness score
- Prompt to add missing info
- Public/private field toggles

**Directory Opt-in:**
- Choose what to display publicly
- Preview directory listing
- Claim enhanced listing

**Communication Preferences:**
- Email frequency (immediate/daily digest/weekly)
- Topic preferences (events, news, grants, etc.)
- SMS opt-in for urgent alerts

### 2.2 Document Library
```
/portal/documents
├── Membership certificate (auto-generated)
├── Tax receipts by year
├── Event certificates/CEUs
├── Organization bylaws/policies
└── Meeting minutes (board-approved)
```

**Admin Features:**
- Upload documents with visibility settings
- Auto-file donation receipts
- Version control for policies

### 2.3 Community Features (Simple)
```
/portal/community
├── Announcements (admin posts, members comment)
├── Member directory search
├── Discussion threads (optional per org)
└── Resource sharing
```

---

## Priority 3: Financial Operations (Week 5-6)

### 3.1 Fund Accounting
For nonprofits, this is critical - money is often restricted.

```sql
-- Funds table
CREATE TABLE funds (
  id UUID PRIMARY KEY,
  organization_id UUID,
  name TEXT, -- "General Operating", "Building Fund", "Scholarship Fund"
  fund_type TEXT, -- 'unrestricted', 'temporarily_restricted', 'permanently_restricted'
  is_default BOOLEAN DEFAULT false
);

-- Add fund_id to donations and expenses
ALTER TABLE donations ADD COLUMN fund_id UUID REFERENCES funds(id);
ALTER TABLE ledger_entries ADD COLUMN fund_id UUID REFERENCES funds(id);
```

### 3.2 Budget Management
```
/admin/finances/budget
├── Create annual budget by account
├── Budget vs Actuals report
├── Variance alerts (>10% over budget)
├── Department/program budgets
└── Board-approved budget tracking
```

### 3.3 Financial Reports
| Report | Description | Priority |
|--------|-------------|----------|
| Statement of Financial Position | Balance sheet for nonprofits | High |
| Statement of Activities | Income statement by fund | High |
| Statement of Functional Expenses | Program vs Admin vs Fundraising | High |
| Cash Flow Statement | Operating/Investing/Financing | Medium |
| Donor Giving History | Individual donor report | High |
| Grant Financial Report | Spending by grant/program | High |
| Aging Report | Receivables by age bucket | Medium |
| Audit Trail Export | All transactions for auditors | High |

### 3.4 990 Preparation Helper
```
/admin/finances/990-prep
├── Auto-categorize expenses (Program/Admin/Fundraising)
├── Calculate ratios (Program efficiency)
├── Export data in 990 format
├── Board compensation summary
├── Top vendor list
└── In-kind donation tracking
```

---

## Priority 4: Event System Maturity (Week 7-8)

### 4.1 Conference Management
```
/admin/events/[id]/program
├── Sessions/tracks management
├── Speaker profiles
├── Room assignments
├── Schedule builder (drag-drop)
├── Attendee schedule builder
└── Mobile app schedule sync
```

### 4.2 Sponsor Management
```sql
CREATE TABLE event_sponsors (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  sponsor_name TEXT,
  sponsor_tier TEXT, -- 'platinum', 'gold', 'silver', 'bronze'
  logo_url TEXT,
  website_url TEXT,
  amount_cents INTEGER,
  benefits JSONB, -- booth, banner, speaking slot, etc.
  contact_name TEXT,
  contact_email TEXT,
  invoice_id UUID REFERENCES invoices(id)
);
```

### 4.3 Advanced Registration
- **Waitlist** with auto-promotion when spots open
- **Group registration** (register multiple people)
- **Promo codes** with limits and expiration
- **Tiered pricing** (early bird, member, non-member, student)
- **Add-ons** (workshop, dinner, parking)
- **Dietary/accessibility** collection
- **Session selection** at registration

### 4.4 Post-Event
- **Survey integration** (embedded or link to Typeform/SurveyMonkey)
- **Certificate generation** with attendance verification
- **Photo gallery**
- **Recording access** (for hybrid/virtual)
- **ROI report** for sponsors

---

## Priority 5: Communication Platform (Week 9-10)

### 5.1 Email Template Builder
```
/admin/email/templates
├── Drag-drop editor (React Email + MJML)
├── Brand presets (colors, logo, footer)
├── Reusable content blocks
├── Personalization tokens
├── Mobile preview
└── Template library (welcome, renewal, receipt, etc.)
```

### 5.2 Email Analytics
```
/admin/email/analytics
├── Open rates by campaign
├── Click heatmaps
├── Bounce/complaint tracking
├── Unsubscribe trends
├── Best send time analysis
└── A/B test results
```

### 5.3 Transactional Email Management
```
/admin/settings/emails
├── Welcome email (new member)
├── Receipt email (donation/payment)
├── Renewal reminder sequence (30/14/7/1 day)
├── Event confirmation
├── Event reminder sequence
├── Password reset
├── Invoice email
└── Custom triggered emails
```

### 5.4 SMS Integration (Twilio)
- Opt-in management with compliance
- Event reminders (day before, morning of)
- Urgent announcements
- 2FA codes
- Delivery reports

---

## Priority 6: Integrations Hub (Week 11-12)

### 6.1 QuickBooks Sync
```
/admin/integrations/quickbooks
├── OAuth connection flow
├── Account mapping UI
├── Sync settings (auto/manual)
├── Sync history log
├── Error resolution queue
└── Two-way sync toggle
```

**Sync Logic:**
- Donations → QB Sales Receipts/Deposits
- Membership payments → QB Invoices/Payments
- Expenses → QB Bills/Expenses
- Members → QB Customers
- Vendors → QB Vendors

### 6.2 Calendar Sync
- **Google Calendar** - Push events to shared calendar
- **Outlook/Microsoft 365** - Same
- **.ics export** - Universal calendar feed
- **Add to calendar** buttons on event pages

### 6.3 Communication Platform Sync
- **Mailchimp** - Sync member lists, tags
- **Constant Contact** - Same
- **HubSpot** - CRM sync for major donors

### 6.4 Zapier/Make Triggers
Expose webhooks for:
- Member joined/renewed/expired
- Donation received
- Event registration
- Grant application submitted
- Invoice paid
- Any custom automation trigger

---

## Priority 7: Analytics & Reporting (Week 13-14)

### 7.1 Dashboard Builder
```
/admin/dashboards
├── Pre-built dashboards (Membership, Finance, Events, Fundraising)
├── Custom dashboard builder
├── Widget library (charts, KPIs, tables, lists)
├── Date range selector
├── Export to PDF
└── Scheduled email delivery
```

### 7.2 Report Builder
```
/admin/reports/builder
├── Select data source (members, donations, events, etc.)
├── Choose fields
├── Add filters
├── Group/aggregate
├── Sort order
├── Save & schedule
└── Export (CSV, Excel, PDF)
```

### 7.3 KPI Tracking
| KPI | Calculation | Goal Setting |
|-----|-------------|--------------|
| Member retention rate | (End - New) / Start | Target: 85% |
| Member acquisition cost | Marketing spend / New members | Target: <$50 |
| Donor retention rate | Repeat donors / Prior year donors | Target: 60% |
| Event attendance rate | Attended / Registered | Target: 80% |
| Grant success rate | Funded / Applications | Target: 30% |
| Revenue per member | Total revenue / Members | Track trend |

---

## Priority 8: Developer Experience (Week 15-16)

### 8.1 API Documentation
```
/admin/developers/docs
├── Interactive API explorer (Swagger/OpenAPI)
├── Authentication guide
├── Webhooks documentation
├── Rate limits explanation
├── Code examples (JS, Python, cURL)
└── Changelog
```

### 8.2 Webhook Management
```
/admin/developers/webhooks
├── Create webhook endpoint
├── Select events to subscribe
├── Secret key management
├── Delivery logs with payloads
├── Retry failed deliveries
└── Test webhook button
```

### 8.3 API Key Management
```
/admin/developers/api-keys
├── Create/revoke keys
├── Scope restrictions (read-only, specific resources)
├── Usage analytics
├── Rate limit configuration
└── IP allowlist (optional)
```

---

## Technical Improvements

### Architecture Enhancements

1. **Background Jobs Queue**
   - Replace cron with proper queue (Inngest, Trigger.dev, or Bull)
   - Reliable email sending
   - PDF generation
   - Sync operations

2. **Caching Layer**
   - Redis for session storage
   - Cache dashboard queries
   - Rate limiting

3. **Search Infrastructure**
   - Full-text search (Supabase pg_trgm or external)
   - Member directory search
   - Global search improvements

4. **File Storage**
   - Supabase Storage for uploads
   - Image optimization
   - Document preview generation

### Performance Optimizations

1. **Database**
   - Add missing indexes
   - Materialized views for reports
   - Query optimization

2. **Frontend**
   - React Query for caching
   - Optimistic updates
   - Virtual scrolling for large lists
   - Image lazy loading

3. **Bundle Size**
   - Code splitting
   - Dynamic imports
   - Tree shaking audit

### Security Hardening

1. **Authentication**
   - 2FA (TOTP) support
   - Session management UI
   - Login history/alerts
   - Password requirements

2. **Authorization**
   - Field-level permissions
   - Custom roles builder
   - Permission audit log

3. **Data Protection**
   - PII encryption at rest
   - Data export (GDPR)
   - Data deletion workflow
   - Audit logging

### Testing & Quality

1. **Testing Suite**
   - Unit tests for lib functions
   - Integration tests for APIs
   - E2E tests for critical flows
   - Visual regression tests

2. **CI/CD**
   - GitHub Actions workflow
   - Preview deployments
   - Database migrations CI
   - Automated security scanning

---

## Implementation Roadmap

### Phase 1: Production Ready (Weeks 1-4)
- [ ] Settings page & org profile
- [ ] Password reset flow
- [ ] Email verification
- [ ] Team invitations
- [ ] Invoice generation
- [ ] Portal billing page
- [ ] Member self-service renewal

### Phase 2: Financial Maturity (Weeks 5-8)
- [ ] Fund accounting
- [ ] Budget management
- [ ] Financial reports suite
- [ ] Audit trail export
- [ ] QuickBooks integration

### Phase 3: Engagement (Weeks 9-12)
- [ ] Email template builder
- [ ] Communication preferences
- [ ] Document library
- [ ] Event enhancements (waitlist, sessions)
- [ ] Sponsor management

### Phase 4: Scale (Weeks 13-16)
- [ ] Dashboard builder
- [ ] Report builder
- [ ] API documentation
- [ ] Webhook management
- [ ] Performance optimization

---

## Competitive Analysis

| Feature | FoundationOS | Wild Apricot | MemberClicks | Fonteva |
|---------|--------------|--------------|--------------|---------|
| Member management | ✅ | ✅ | ✅ | ✅ |
| Event registration | ✅ | ✅ | ✅ | ✅ |
| Online payments | ✅ | ✅ | ✅ | ✅ |
| Email marketing | 🟡 Basic | ✅ | ✅ | ✅ |
| Website builder | ❌ | ✅ | ✅ | ❌ |
| Grants management | ✅ | ❌ | 🟡 | 🟡 |
| AI bookkeeping | ✅ | ❌ | ❌ | ❌ |
| Board governance | ✅ | ❌ | 🟡 | ❌ |
| Approval workflows | ✅ | ❌ | ❌ | 🟡 |
| Multi-org/chapters | ✅ | ❌ | ✅ | ✅ |
| QuickBooks sync | 🟡 Partial | ✅ | ✅ | ✅ |
| Mobile app | ❌ | 🟡 | ✅ | ✅ |
| Self-service portal | 🟡 Basic | ✅ | ✅ | ✅ |
| Custom reporting | 🟡 Basic | ✅ | ✅ | ✅ |

**Our Differentiators:**
1. AI-powered bookkeeping (unique)
2. Full grants lifecycle (rare)
3. Board governance tools (rare)
4. Modern tech stack (faster development)
5. Multi-tenant from day 1 (enterprise-ready)

---

## Resource Estimate

| Phase | Scope | Effort | Cost (Solo Dev) |
|-------|-------|--------|-----------------|
| Phase 1 | Production Essentials | 4 weeks | $8,000 |
| Phase 2 | Financial Maturity | 4 weeks | $8,000 |
| Phase 3 | Engagement | 4 weeks | $8,000 |
| Phase 4 | Scale | 4 weeks | $8,000 |
| **Total** | **Full Platform** | **16 weeks** | **$32,000** |

---

## Next Immediate Steps

1. **Create Settings Page** - Unblocks customization
2. **Add Password Reset** - Unblocks user management
3. **Build Invoice System** - Unblocks revenue
4. **Enhance Portal Billing** - Improves member experience
5. **Add Email Templates UI** - Improves communication

Would you like me to start implementing Phase 1?
