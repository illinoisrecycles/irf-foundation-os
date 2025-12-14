import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// DIGITAL MEMBERSHIP CARD SYSTEM
// Mobile-first, QR-based verification - what members actually want
// ============================================================================

export type MemberCard = {
  memberId: string
  memberName: string
  organizationName: string
  membershipType: string
  memberNumber: string
  joinedDate: string
  expiresDate: string
  status: 'active' | 'expired' | 'pending'
  photoUrl?: string
  qrCodeDataUrl: string
  verificationUrl: string
  engagementTier?: string
  badges: string[]
}

/**
 * Generate a digital membership card with QR code
 */
export async function generateMemberCard(memberOrgId: string): Promise<MemberCard | null> {
  const supabase = createAdminClient()

  // Get member with org details
  const { data: member, error } = await supabase
    .from('member_organizations')
    .select(`
      id,
      name,
      membership_status,
      joined_at,
      expires_at,
      member_number,
      tags,
      organization_id,
      organizations!inner(name),
      membership_plans(name),
      member_engagement_scores(engagement_tier)
    `)
    .eq('id', memberOrgId)
    .single()

  if (error || !member) return null

  // Generate verification URL (short-lived token)
  const verificationToken = Buffer.from(`${member.id}:${Date.now()}`).toString('base64url')
  const verificationUrl = `${process.env.NEXT_PUBLIC_URL}/verify/${verificationToken}`

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#1a365d',
      light: '#ffffff',
    },
  })

  // Determine badges
  const badges: string[] = []
  const tier = member.member_engagement_scores?.[0]?.engagement_tier
  if (tier === 'champion') badges.push('🏆 Champion')
  else if (tier === 'engaged') badges.push('⭐ Engaged')
  if (member.tags?.includes('board-member')) badges.push('👔 Board Member')
  if (member.tags?.includes('major-donor')) badges.push('💎 Major Donor')
  if (member.tags?.includes('volunteer')) badges.push('🤝 Volunteer')

  return {
    memberId: member.id,
    memberName: member.name,
    organizationName: member.organizations?.name || 'Organization',
    membershipType: member.membership_plans?.name || 'Member',
    memberNumber: member.member_number || member.id.slice(0, 8).toUpperCase(),
    joinedDate: member.joined_at,
    expiresDate: member.expires_at,
    status: member.membership_status as any,
    qrCodeDataUrl,
    verificationUrl,
    engagementTier: tier,
    badges,
  }
}

/**
 * Verify a membership card scan
 */
export async function verifyMemberCard(token: string): Promise<{
  valid: boolean
  member?: any
  message: string
}> {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const [memberId, timestamp] = decoded.split(':')

    // Token expires after 24 hours
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return { valid: false, message: 'QR code expired. Please refresh your card.' }
    }

    const supabase = createAdminClient()
    const { data: member, error } = await supabase
      .from('member_organizations')
      .select('id, name, membership_status, expires_at, membership_plans(name)')
      .eq('id', memberId)
      .single()

    if (error || !member) {
      return { valid: false, message: 'Member not found' }
    }

    if (member.membership_status !== 'active') {
      return { valid: false, member, message: `Membership is ${member.membership_status}` }
    }

    if (new Date(member.expires_at) < new Date()) {
      return { valid: false, member, message: 'Membership has expired' }
    }

    return {
      valid: true,
      member,
      message: `✅ Valid member: ${member.name} (${member.membership_plans?.name})`,
    }
  } catch {
    return { valid: false, message: 'Invalid QR code' }
  }
}

/**
 * Generate Apple Wallet pass (PKPass) - placeholder for future
 */
export async function generateWalletPass(memberOrgId: string): Promise<Buffer | null> {
  // Future: Implement PKPass generation using passkit-generator
  // This would create a .pkpass file that can be added to Apple Wallet
  return null
}

/**
 * Generate Google Wallet pass - placeholder for future
 */
export async function generateGoogleWalletPass(memberOrgId: string): Promise<string | null> {
  // Future: Implement Google Wallet JWT
  return null
}
