-- FoundationOS Database Schema
-- Migration: 001_initial_schema
-- Run this in Supabase SQL Editor or as a migration

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

-- Organization types
CREATE TYPE org_type AS ENUM ('foundation', 'association', 'nonprofit', 'chapter');

-- User roles within an organization
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'staff', 'finance', 'member');

-- Membership statuses
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'expired', 'cancelled', 'suspended');

-- Payment statuses
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled');

-- Event statuses
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- Registration statuses
CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'cancelled', 'checked_in', 'no_show');

-- Grant application statuses
CREATE TYPE grant_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn');

-- Content statuses
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'irf', 'aafpe'
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    org_type org_type DEFAULT 'nonprofit',
    
    -- Contact info
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'US',
    
    -- Branding
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#000000',
    secondary_color VARCHAR(7) DEFAULT '#666666',
    
    -- Settings (JSON for flexibility)
    settings JSONB DEFAULT '{}',
    
    -- Stripe
    stripe_customer_id VARCHAR(255),
    stripe_account_id VARCHAR(255), -- For Connect
    
    -- Tax info
    ein VARCHAR(20), -- Employer ID Number
    tax_exempt BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic info
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    
    -- Contact
    phone VARCHAR(50),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'US',
    
    -- Professional info
    title VARCHAR(100),
    company VARCHAR(255),
    bio TEXT,
    
    -- Social links
    linkedin_url VARCHAR(255),
    twitter_url VARCHAR(255),
    website_url VARCHAR(255),
    
    -- Preferences
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    
    -- Stripe
    stripe_customer_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members (junction table with roles)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role DEFAULT 'member',
    
    -- Member-specific fields
    member_number VARCHAR(50),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Directory visibility
    show_in_directory BOOLEAN DEFAULT true,
    directory_bio TEXT,
    
    -- Tags for segmentation
    tags TEXT[] DEFAULT '{}',
    
    -- Metadata
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, profile_id)
);

-- =============================================================================
-- MEMBERSHIP TABLES
-- =============================================================================

-- Membership Plans
CREATE TABLE membership_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Billing
    billing_interval VARCHAR(20) DEFAULT 'year', -- 'month', 'year', 'lifetime'
    billing_interval_count INTEGER DEFAULT 1,
    
    -- Stripe
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    
    -- Features/benefits (JSON array)
    features JSONB DEFAULT '[]',
    
    -- Limits
    max_members INTEGER, -- NULL = unlimited
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

-- Memberships (actual subscriptions)
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES membership_plans(id),
    
    status membership_status DEFAULT 'pending',
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    cancelled_at TIMESTAMPTZ,
    
    -- Stripe
    stripe_subscription_id VARCHAR(255),
    
    -- Payment tracking
    amount_paid_cents INTEGER,
    last_payment_at TIMESTAMPTZ,
    next_payment_at TIMESTAMPTZ,
    
    -- Auto-renewal
    auto_renew BOOLEAN DEFAULT true,
    
    -- Metadata
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EVENTS TABLES
-- =============================================================================

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    
    -- Type
    event_type VARCHAR(50) DEFAULT 'conference', -- 'conference', 'webinar', 'workshop', 'meetup'
    
    -- Dates
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    
    -- Location
    is_virtual BOOLEAN DEFAULT false,
    venue_name VARCHAR(255),
    venue_address TEXT,
    venue_city VARCHAR(100),
    venue_state VARCHAR(50),
    venue_postal_code VARCHAR(20),
    virtual_url TEXT, -- Zoom link, etc.
    
    -- Media
    cover_image_url TEXT,
    
    -- Registration
    registration_opens_at TIMESTAMPTZ,
    registration_closes_at TIMESTAMPTZ,
    max_attendees INTEGER,
    
    -- Pricing
    is_free BOOLEAN DEFAULT false,
    member_discount_percent INTEGER DEFAULT 0,
    early_bird_discount_percent INTEGER DEFAULT 0,
    early_bird_deadline TIMESTAMPTZ,
    
    -- Status
    status event_status DEFAULT 'draft',
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    UNIQUE(organization_id, slug)
);

-- Event Ticket Types
CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Stripe
    stripe_price_id VARCHAR(255),
    
    -- Availability
    quantity_available INTEGER,
    quantity_sold INTEGER DEFAULT 0,
    max_per_order INTEGER DEFAULT 10,
    
    -- Dates
    sales_start_at TIMESTAMPTZ,
    sales_end_at TIMESTAMPTZ,
    
    -- Restrictions
    members_only BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Sessions (for multi-session events)
CREATE TABLE event_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Schedule
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    -- Location
    room VARCHAR(100),
    
    -- Capacity
    max_attendees INTEGER,
    
    -- Track/category
    track VARCHAR(100),
    
    -- Sort
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Speakers
CREATE TABLE event_speakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id), -- Link to member profile if exists
    
    -- Speaker info (for non-members or overrides)
    name VARCHAR(255) NOT NULL,
    title VARCHAR(100),
    company VARCHAR(255),
    bio TEXT,
    photo_url TEXT,
    
    -- Contact
    email VARCHAR(255),
    
    -- Social
    linkedin_url VARCHAR(255),
    twitter_url VARCHAR(255),
    
    -- Status
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session-Speaker junction
CREATE TABLE session_speakers (
    session_id UUID NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
    speaker_id UUID NOT NULL REFERENCES event_speakers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'speaker', -- 'speaker', 'moderator', 'panelist'
    PRIMARY KEY (session_id, speaker_id)
);

-- Event Registrations
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    
    -- Registrant info (for guests or if no profile)
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    
    -- Status
    status registration_status DEFAULT 'pending',
    
    -- Payment
    amount_cents INTEGER NOT NULL DEFAULT 0,
    payment_id UUID, -- References payments table
    
    -- Check-in
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES profiles(id),
    
    -- Custom fields responses
    custom_fields JSONB DEFAULT '{}',
    
    -- Dietary/accessibility
    dietary_requirements TEXT,
    accessibility_needs TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Sponsors
CREATE TABLE event_sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Sponsor info
    name VARCHAR(255) NOT NULL,
    level VARCHAR(50), -- 'platinum', 'gold', 'silver', 'bronze'
    logo_url TEXT,
    website_url VARCHAR(255),
    description TEXT,
    
    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    
    -- Financials
    amount_cents INTEGER,
    payment_status payment_status DEFAULT 'pending',
    
    -- Display
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FINANCE TABLES
-- =============================================================================

-- Payments (unified payment records)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    
    -- Payment type
    payment_type VARCHAR(50) NOT NULL, -- 'membership', 'donation', 'event', 'sponsorship', 'other'
    
    -- Reference (polymorphic)
    reference_type VARCHAR(50), -- 'membership', 'event_registration', 'donation', etc.
    reference_id UUID,
    
    -- Amount
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Status
    status payment_status DEFAULT 'pending',
    
    -- Stripe
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    
    -- Payer info (if no profile)
    payer_email VARCHAR(255),
    payer_name VARCHAR(255),
    
    -- Refund tracking
    refunded_amount_cents INTEGER DEFAULT 0,
    refunded_at TIMESTAMPTZ,
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donations
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    campaign_id UUID, -- References campaigns table
    
    -- Donor info
    donor_email VARCHAR(255) NOT NULL,
    donor_name VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT false,
    
    -- Amount
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Type
    is_recurring BOOLEAN DEFAULT false,
    recurring_interval VARCHAR(20), -- 'month', 'year'
    
    -- Stripe
    stripe_subscription_id VARCHAR(255),
    
    -- Fund designation
    fund_designation VARCHAR(255), -- 'general', 'scholarship', etc.
    
    -- Status
    status payment_status DEFAULT 'pending',
    payment_id UUID REFERENCES payments(id),
    
    -- Acknowledgment
    receipt_sent_at TIMESTAMPTZ,
    thank_you_sent_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    tribute_type VARCHAR(50), -- 'in_memory', 'in_honor'
    tribute_name VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donation Campaigns
CREATE TABLE donation_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Goal
    goal_cents INTEGER,
    raised_cents INTEGER DEFAULT 0,
    donor_count INTEGER DEFAULT 0,
    
    -- Dates
    start_date DATE,
    end_date DATE,
    
    -- Media
    cover_image_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    
    -- Invoice number
    invoice_number VARCHAR(50) NOT NULL,
    
    -- Dates
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'
    
    -- Amounts
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    amount_paid_cents INTEGER DEFAULT 0,
    
    -- Customer info
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    customer_address TEXT,
    
    -- Stripe
    stripe_invoice_id VARCHAR(255),
    
    -- Notes
    notes TEXT,
    terms TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    UNIQUE(organization_id, invoice_number)
);

-- Invoice Line Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    
    -- Reference
    reference_type VARCHAR(50),
    reference_id UUID,
    
    -- Sort
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GRANTS TABLES
-- =============================================================================

-- Grant Programs
CREATE TABLE grant_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Funding
    total_budget_cents INTEGER,
    max_award_cents INTEGER,
    min_award_cents INTEGER,
    
    -- Dates
    application_opens_at TIMESTAMPTZ,
    application_deadline TIMESTAMPTZ,
    review_deadline TIMESTAMPTZ,
    notification_date DATE,
    
    -- Eligibility
    eligibility_criteria TEXT,
    members_only BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Form configuration
    application_fields JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

-- Grant Applications
CREATE TABLE grant_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES grant_programs(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    organization_id UUID NOT NULL, -- Denormalized for RLS
    
    -- Application
    project_title VARCHAR(255) NOT NULL,
    project_description TEXT,
    amount_requested_cents INTEGER NOT NULL,
    
    -- Form responses
    responses JSONB DEFAULT '{}',
    
    -- Status
    status grant_status DEFAULT 'draft',
    
    -- Review
    average_score DECIMAL(4,2),
    
    -- Award
    amount_awarded_cents INTEGER,
    awarded_at TIMESTAMPTZ,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant Reviewers
CREATE TABLE grant_reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES grant_programs(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(program_id, profile_id)
);

-- Grant Reviews
CREATE TABLE grant_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES grant_applications(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Scores (JSON for flexible criteria)
    scores JSONB DEFAULT '{}',
    overall_score DECIMAL(4,2),
    
    -- Comments
    comments TEXT,
    recommendation VARCHAR(50), -- 'fund', 'fund_partial', 'do_not_fund'
    
    -- Status
    is_complete BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(application_id, reviewer_id)
);

-- =============================================================================
-- CMS TABLES
-- =============================================================================

-- Pages
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    
    -- Content
    content TEXT,
    excerpt TEXT,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    
    -- Media
    featured_image_url TEXT,
    
    -- Access
    is_members_only BOOLEAN DEFAULT false,
    
    -- Status
    status content_status DEFAULT 'draft',
    
    -- Hierarchy
    parent_id UUID REFERENCES pages(id),
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    
    UNIQUE(organization_id, slug)
);

-- Posts (Blog/News)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id),
    
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    
    -- Content
    content TEXT,
    excerpt TEXT,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    
    -- Media
    featured_image_url TEXT,
    
    -- Categorization
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Access
    is_members_only BOOLEAN DEFAULT false,
    
    -- Status
    status content_status DEFAULT 'draft',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    UNIQUE(organization_id, slug)
);

-- =============================================================================
-- AUDIT & ACTIVITY
-- =============================================================================

-- Audit Log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Action
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Feed
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    
    -- Activity type
    activity_type VARCHAR(50) NOT NULL, -- 'joined', 'renewed', 'donated', 'registered', etc.
    
    -- Reference
    reference_type VARCHAR(50),
    reference_id UUID,
    
    -- Description
    description TEXT,
    
    -- Visibility
    is_public BOOLEAN DEFAULT true,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Organization Members
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_profile ON organization_members(profile_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- Memberships
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_memberships_profile ON memberships(profile_id);
CREATE INDEX idx_memberships_status ON memberships(organization_id, status);
CREATE INDEX idx_memberships_dates ON memberships(end_date, status);

-- Events
CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_slug ON events(organization_id, slug);
CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_events_status ON events(organization_id, status);

-- Event Registrations
CREATE INDEX idx_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_registrations_profile ON event_registrations(profile_id);
CREATE INDEX idx_registrations_email ON event_registrations(email);

-- Payments
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_profile ON payments(profile_id);
CREATE INDEX idx_payments_type ON payments(organization_id, payment_type);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

-- Donations
CREATE INDEX idx_donations_org ON donations(organization_id);
CREATE INDEX idx_donations_profile ON donations(profile_id);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);

-- Grant Applications
CREATE INDEX idx_grant_apps_program ON grant_applications(program_id);
CREATE INDEX idx_grant_apps_profile ON grant_applications(profile_id);
CREATE INDEX idx_grant_apps_status ON grant_applications(status);

-- Pages & Posts
CREATE INDEX idx_pages_org_slug ON pages(organization_id, slug);
CREATE INDEX idx_posts_org_slug ON posts(organization_id, slug);
CREATE INDEX idx_posts_status ON posts(organization_id, status);

-- Audit
CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- Activities
CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_profile ON activities(profile_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM organization_members
  WHERE profile_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to check if user is admin of org
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND profile_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Profiles: Users can read their own profile and profiles in their organizations
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Organization Members: Users can see members in their organizations
CREATE POLICY "Users can view org members"
    ON organization_members FOR SELECT
    USING (organization_id = ANY(get_user_org_ids()));

-- Events: Public events are visible, org events to org members
CREATE POLICY "Anyone can view published events"
    ON events FOR SELECT
    USING (status = 'published');

CREATE POLICY "Org admins can manage events"
    ON events FOR ALL
    USING (is_org_admin(organization_id));

-- More policies would be added here...

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON membership_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ticket_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_speakers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_sponsors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON donation_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON grant_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON grant_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON grant_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Profile creation trigger (creates profile when user signs up)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
