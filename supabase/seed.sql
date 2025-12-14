-- FoundationOS Seed Data
-- Run this AFTER the migrations to create required initial data
-- Replace the UUIDs with your actual values

-- 1. Create the Default Organization
-- Use the same UUID as NEXT_PUBLIC_DEFAULT_ORG_ID in your .env
INSERT INTO organizations (id, name, slug, org_type, email, website, country, tax_exempt, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Replace with your UUID
  'My Foundation',
  'my-foundation',
  'nonprofit',
  'admin@example.org',
  'https://example.org',
  'US',
  true,
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Create a System Admin Profile
-- Use the same UUID as NEXT_PUBLIC_DEV_PROFILE_ID in your .env
-- Note: This profile should be linked to a real auth.users entry for login
INSERT INTO profiles (id, email, first_name, last_name, display_name, country)
VALUES (
  '00000000-0000-0000-0000-000000000002',  -- Replace with your UUID
  'admin@example.org',
  'System',
  'Admin',
  'System Admin',
  'US'
) ON CONFLICT (id) DO NOTHING;

-- 3. Link the admin to the organization
INSERT INTO organization_members (organization_id, profile_id, role, member_number)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Must match org ID above
  '00000000-0000-0000-0000-000000000002',  -- Must match profile ID above
  'owner',
  'ADMIN-001'
) ON CONFLICT DO NOTHING;

-- 4. Create a sample membership plan
INSERT INTO membership_plans (
  id, organization_id, name, slug, description, 
  price_cents, currency, billing_interval, billing_interval_count,
  is_active, is_default, features
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Individual Membership',
  'individual',
  'Basic membership for individuals',
  15000,  -- $150.00
  'USD',
  'year',
  1,
  true,
  true,
  '["Access to member resources", "Newsletter subscription", "Event discounts"]'::jsonb
) ON CONFLICT DO NOTHING;
