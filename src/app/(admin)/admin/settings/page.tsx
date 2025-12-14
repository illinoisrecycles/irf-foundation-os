'use client'

import { useState, useEffect } from 'react'
import { 
  Settings, Building2, Users, CreditCard, Bell, Link2, Shield, Palette,
  Upload, Loader2, Check, AlertCircle, Plus, Trash2, Mail, X
} from 'lucide-react'

type OrgSettings = {
  id: string
  name: string
  logo_url: string | null
  brand_color: string
  secondary_color: string
  tax_id: string | null
  fiscal_year_start: number
  timezone: string
  address: Record<string, string>
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  features_enabled: Record<string, boolean>
}

type TeamMember = {
  id: string
  user_id: string
  role: string
  user: { email: string; raw_user_meta_data: { name?: string } }
}

type TeamInvite = {
  id: string
  email: string
  role: string
  expires_at: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General & Branding', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your organization settings</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'team' && <TeamSettings />}
          {activeTab === 'billing' && <BillingSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'integrations' && <IntegrationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data.settings)
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    
    const formData = new FormData(e.currentTarget)
    const updates = {
      name: formData.get('name'),
      brand_color: formData.get('brand_color'),
      secondary_color: formData.get('secondary_color'),
      tax_id: formData.get('tax_id'),
      fiscal_year_start: parseInt(formData.get('fiscal_year_start') as string),
      timezone: formData.get('timezone'),
      contact_email: formData.get('contact_email'),
      contact_phone: formData.get('contact_phone'),
      website_url: formData.get('website_url'),
      address: {
        street: formData.get('address_street'),
        city: formData.get('address_city'),
        state: formData.get('address_state'),
        zip: formData.get('address_zip'),
        country: formData.get('address_country') || 'US'
      }
    }

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Organization Info */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Organization Profile</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              name="name"
              defaultValue={settings?.name}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              name="contact_email"
              defaultValue={settings?.contact_email || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone
            </label>
            <input
              type="tel"
              name="contact_phone"
              defaultValue={settings?.contact_phone || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              name="website_url"
              defaultValue={settings?.website_url || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax ID (EIN)
            </label>
            <input
              type="text"
              name="tax_id"
              defaultValue={settings?.tax_id || ''}
              placeholder="XX-XXXXXXX"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Address</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address
            </label>
            <input
              type="text"
              name="address_street"
              defaultValue={settings?.address?.street || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              name="address_city"
              defaultValue={settings?.address?.city || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                name="address_state"
                defaultValue={settings?.address?.state || ''}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                name="address_zip"
                defaultValue={settings?.address?.zip || ''}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Branding
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 cursor-pointer">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-16 mx-auto" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to upload logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Brand Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  name="brand_color"
                  defaultValue={settings?.brand_color || '#166534'}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  defaultValue={settings?.brand_color || '#166534'}
                  className="flex-1 px-4 py-2 border rounded-lg font-mono"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  name="secondary_color"
                  defaultValue={settings?.secondary_color || '#1e40af'}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  defaultValue={settings?.secondary_color || '#1e40af'}
                  className="flex-1 px-4 py-2 border rounded-lg font-mono"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fiscal Settings */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Fiscal Settings</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiscal Year Start Month
            </label>
            <select
              name="fiscal_year_start"
              defaultValue={settings?.fiscal_year_start || 1}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value={1}>January</option>
              <option value={4}>April</option>
              <option value={7}>July</option>
              <option value={10}>October</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              name="timezone"
              defaultValue={settings?.timezone || 'America/Chicago'}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : saved ? (
            <Check className="w-5 h-5" />
          ) : null}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function TeamSettings() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchTeam()
  }, [])

  const fetchTeam = async () => {
    const res = await fetch('/api/team')
    const data = await res.json()
    setMembers(data.members || [])
    setInvites(data.invites || [])
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })

    if (res.ok) {
      setShowInviteModal(false)
      setInviteEmail('')
      fetchTeam()
    }

    setInviting(false)
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return

    await fetch(`/api/team?member_id=${memberId}`, { method: 'DELETE' })
    fetchTeam()
  }

  const handleCancelInvite = async (inviteId: string) => {
    await fetch(`/api/team?invite_id=${inviteId}`, { method: 'DELETE' })
    fetchTeam()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500 mt-1">Manage who has access to your organization</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        <div className="divide-y">
          {members.map(member => (
            <div key={member.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user?.raw_user_meta_data?.name || member.user?.email}
                  </p>
                  <p className="text-sm text-gray-500">{member.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={member.role}
                  onChange={async (e) => {
                    await fetch('/api/team', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ member_id: member.id, role: e.target.value })
                    })
                    fetchTeam()
                  }}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                  <option value="finance">Finance</option>
                </select>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Pending Invitations</h2>
          </div>
          <div className="divide-y">
            {invites.map(invite => (
              <div key={invite.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invite.email}</p>
                    <p className="text-sm text-gray-500">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    {invite.role}
                  </span>
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Invite Team Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="admin">Admin - Full access</option>
                  <option value="editor">Editor - Can edit content</option>
                  <option value="viewer">Viewer - Read only</option>
                  <option value="finance">Finance - Financial access</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function BillingSettings() {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Billing & Payments</h2>
      <div className="space-y-6">
        <div className="p-6 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Stripe Connect</h3>
          <p className="text-sm text-gray-600 mb-4">
            Connect your Stripe account to accept payments for memberships, events, and donations.
          </p>
          <button className="px-4 py-2 bg-[#635BFF] text-white rounded-lg hover:bg-[#5851db] flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Connect Stripe Account
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationSettings() {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>
      <div className="space-y-6">
        {[
          { id: 'new_member', label: 'New member registration', description: 'Get notified when someone joins' },
          { id: 'new_donation', label: 'New donation', description: 'Get notified for donations over $100' },
          { id: 'event_registration', label: 'Event registration', description: 'Get notified for event sign-ups' },
          { id: 'expiring_membership', label: 'Expiring memberships', description: 'Daily digest of expiring memberships' },
        ].map(item => (
          <div key={item.id} className="flex items-center justify-between py-4 border-b last:border-0">
            <div>
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntegrationSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Integrations</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { name: 'QuickBooks', description: 'Sync financial data', connected: false, icon: '📊' },
            { name: 'Mailchimp', description: 'Email marketing sync', connected: false, icon: '📧' },
            { name: 'Google Calendar', description: 'Event sync', connected: false, icon: '📅' },
            { name: 'Slack', description: 'Notifications', connected: false, icon: '💬' },
          ].map(integration => (
            <div key={integration.name} className="p-4 border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{integration.icon}</span>
                <div>
                  <p className="font-medium text-gray-900">{integration.name}</p>
                  <p className="text-sm text-gray-500">{integration.description}</p>
                </div>
              </div>
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between py-4 border-b">
            <div>
              <p className="font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
              Enable 2FA
            </button>
          </div>

          <div className="flex items-center justify-between py-4 border-b">
            <div>
              <p className="font-medium text-gray-900">Session Management</p>
              <p className="text-sm text-gray-500">View and manage active sessions</p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
              View Sessions
            </button>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">Audit Log</p>
              <p className="text-sm text-gray-500">View recent account activity</p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
              View Log
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
