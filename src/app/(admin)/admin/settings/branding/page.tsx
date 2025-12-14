'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Palette, Image, Globe, Mail, Save, Loader2, Eye, RefreshCw
} from 'lucide-react'

type BrandingSettings = {
  logo_url: string
  favicon_url: string
  primary_color: string
  secondary_color: string
  accent_color: string
  custom_domain: string
  email_from_name: string
  email_reply_to: string
  footer_text: string
  social_links: {
    facebook?: string
    twitter?: string
    linkedin?: string
    instagram?: string
  }
  custom_css: string
}

const DEFAULT_SETTINGS: BrandingSettings = {
  logo_url: '',
  favicon_url: '',
  primary_color: '#166534',
  secondary_color: '#3b82f6',
  accent_color: '#f59e0b',
  custom_domain: '',
  email_from_name: '',
  email_reply_to: '',
  footer_text: '',
  social_links: {},
  custom_css: '',
}

export default function BrandingSettingsPage() {
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get org settings
    const { data: org } = await supabase
      .from('organization_members')
      .select('organization:organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (org?.organization) {
      setSettings({
        logo_url: org.organization.logo_url || '',
        favicon_url: org.organization.favicon_url || '',
        primary_color: org.organization.primary_color || '#166534',
        secondary_color: org.organization.secondary_color || '#3b82f6',
        accent_color: org.organization.accent_color || '#f59e0b',
        custom_domain: org.organization.custom_domain || '',
        email_from_name: org.organization.email_from_name || '',
        email_reply_to: org.organization.email_reply_to || '',
        footer_text: org.organization.footer_text || '',
        social_links: org.organization.social_links || {},
        custom_css: org.organization.custom_css || '',
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (member) {
      await supabase
        .from('organizations')
        .update({
          logo_url: settings.logo_url || null,
          favicon_url: settings.favicon_url || null,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color,
          custom_domain: settings.custom_domain || null,
          email_from_name: settings.email_from_name || null,
          email_reply_to: settings.email_reply_to || null,
          footer_text: settings.footer_text || null,
          social_links: settings.social_links,
          custom_css: settings.custom_css || null,
        })
        .eq('id', member.organization_id)
    }

    setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileExt = file.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('branding')
      .upload(fileName, file, { upsert: true })

    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(fileName)
      
      setSettings({ ...settings, logo_url: publicUrl })
    }
  }

  const applyPreview = () => {
    document.documentElement.style.setProperty('--primary', settings.primary_color)
    document.documentElement.style.setProperty('--secondary', settings.secondary_color)
    setPreviewMode(true)
  }

  const resetPreview = () => {
    document.documentElement.style.setProperty('--primary', '#166534')
    document.documentElement.style.setProperty('--secondary', '#3b82f6')
    setPreviewMode(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branding & Customization</h1>
          <p className="text-gray-600 mt-1">
            Customize the look and feel of your organization's portal
          </p>
        </div>
        <div className="flex gap-3">
          {previewMode ? (
            <button
              onClick={resetPreview}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Preview
            </button>
          ) : (
            <button
              onClick={applyPreview}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview Changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Logo & Identity */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Image className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Logo & Identity</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Logo
            </label>
            <div className="flex items-center gap-4">
              {settings.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  className="w-20 h-20 object-contain border rounded-lg"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 border rounded-lg flex items-center justify-center">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 inline-block"
                >
                  Upload Logo
                </label>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 2MB. Recommended: 200x200px</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo URL (alternative)
            </label>
            <input
              type="url"
              value={settings.logo_url}
              onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Brand Colors</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primary_color}
                onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.primary_color}
                onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Used for buttons, links, headers</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.secondary_color}
                onChange={e => setSettings({ ...settings, secondary_color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondary_color}
                onChange={e => setSettings({ ...settings, secondary_color: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Used for accents, badges</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accent_color}
                onChange={e => setSettings({ ...settings, accent_color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.accent_color}
                onChange={e => setSettings({ ...settings, accent_color: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Used for highlights, alerts</p>
          </div>
        </div>

        {/* Color Preview */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-3">Preview</p>
          <div className="flex gap-4">
            <button 
              className="px-4 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: settings.primary_color }}
            >
              Primary Button
            </button>
            <button 
              className="px-4 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: settings.secondary_color }}
            >
              Secondary Button
            </button>
            <span 
              className="px-3 py-1 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: settings.accent_color }}
            >
              Accent Badge
            </span>
          </div>
        </div>
      </div>

      {/* Domain & Email */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Domain & Email</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Domain
            </label>
            <input
              type="text"
              value={settings.custom_domain}
              onChange={e => setSettings({ ...settings, custom_domain: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="portal.yourorg.org"
            />
            <p className="text-xs text-gray-500 mt-2">
              Contact support to configure DNS settings
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email From Name
            </label>
            <input
              type="text"
              value={settings.email_from_name}
              onChange={e => setSettings({ ...settings, email_from_name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Illinois Recycling Foundation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reply-To Email
            </label>
            <input
              type="email"
              value={settings.email_reply_to}
              onChange={e => setSettings({ ...settings, email_reply_to: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="info@yourorg.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Footer Text
            </label>
            <input
              type="text"
              value={settings.footer_text}
              onChange={e => setSettings({ ...settings, footer_text: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="© 2025 Your Organization. All rights reserved."
            />
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Social Media Links</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {['facebook', 'twitter', 'linkedin', 'instagram'].map(platform => (
            <div key={platform}>
              <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                {platform}
              </label>
              <input
                type="url"
                value={settings.social_links[platform as keyof typeof settings.social_links] || ''}
                onChange={e => setSettings({ 
                  ...settings, 
                  social_links: { ...settings.social_links, [platform]: e.target.value }
                })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder={`https://${platform}.com/yourorg`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Custom CSS */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Custom CSS (Advanced)</h2>
        </div>

        <textarea
          value={settings.custom_css}
          onChange={e => setSettings({ ...settings, custom_css: e.target.value })}
          className="w-full h-40 px-4 py-3 border rounded-lg font-mono text-sm"
          placeholder={`/* Add custom CSS here */
.custom-header {
  background: linear-gradient(to right, #166534, #3b82f6);
}`}
        />
        <p className="text-xs text-gray-500 mt-2">
          Caution: Invalid CSS may break the interface. Test thoroughly.
        </p>
      </div>
    </div>
  )
}
