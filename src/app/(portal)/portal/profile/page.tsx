'use client'

import * as React from 'react'
import {
  Building2, Globe, Phone, Mail, MapPin, Save, Camera, Plus, Trash2,
  Facebook, Twitter, Linkedin, Instagram, CheckCircle, AlertCircle
} from 'lucide-react'

export default function ProfilePage() {
  const [saved, setSaved] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'organization' | 'directory' | 'services'>('organization')

  // Mock data
  const [profile, setProfile] = React.useState({
    name: 'Green Recycling Co',
    legal_name: 'Green Recycling Company, LLC',
    description: 'Green Recycling Co operates three materials recovery facilities across the Chicago metropolitan area, processing over 500,000 tons of recyclables annually.',
    website: 'https://greenrecycling.com',
    phone: '(312) 555-0100',
    email: 'info@greenrecycling.com',
    address: '123 Industrial Blvd',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    industry: 'MRF Operator',
    employee_count: '51-200',
    founded_year: '2005',
    social: {
      facebook: 'greenrecyclingco',
      twitter: 'greenrecycling',
      linkedin: 'green-recycling-co',
      instagram: '',
    }
  })

  const [directorySettings, setDirectorySettings] = React.useState({
    visible: true,
    description: 'Leading MRF operator serving the Chicago metropolitan area with three state-of-the-art facilities.',
    show_address: true,
    show_phone: true,
    show_email: true,
  })

  const [services, setServices] = React.useState([
    { id: 1, name: 'Single-Stream Recycling Processing', selected: true },
    { id: 2, name: 'Commercial Recycling Collection', selected: true },
    { id: 3, name: 'Residential Recycling Processing', selected: true },
    { id: 4, name: 'Electronics Recycling', selected: false },
    { id: 5, name: 'Organics Processing', selected: false },
    { id: 6, name: 'Consulting Services', selected: false },
  ])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Profile</h1>
          <p className="text-gray-600 mt-1">Manage your organization information and directory listing</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* Save Confirmation */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">Your changes have been saved successfully.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'organization', label: 'Organization Details' },
            { id: 'directory', label: 'Directory Listing' },
            { id: 'services', label: 'Services Offered' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id 
                  ? 'border-green-600 text-green-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Organization Details Tab */}
      {activeTab === 'organization' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Logo */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Organization Logo</h3>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-10 h-10 text-gray-400" />
                </div>
                <div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    <Camera className="w-4 h-4" />
                    Upload Logo
                  </button>
                  <p className="text-xs text-gray-500 mt-2">PNG or JPG, max 2MB, min 200x200px</p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label>
                  <input
                    type="text"
                    value={profile.legal_name}
                    onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry / Sector *</label>
                  <select
                    value={profile.industry}
                    onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option>MRF Operator</option>
                    <option>Hauler</option>
                    <option>Manufacturer</option>
                    <option>Municipality</option>
                    <option>Consultant</option>
                    <option>Nonprofit</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Count</label>
                  <select
                    value={profile.employee_count}
                    onChange={(e) => setProfile({ ...profile, employee_count: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option>1-10</option>
                    <option>11-50</option>
                    <option>51-200</option>
                    <option>201-500</option>
                    <option>500+</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={4}
                    value={profile.description}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year Founded</label>
                  <input
                    type="text"
                    value={profile.founded_year}
                    onChange={(e) => setProfile({ ...profile, founded_year: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={profile.zip}
                      onChange={(e) => setProfile({ ...profile, zip: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Social Links */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Social Media</h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Facebook className="w-4 h-4 text-blue-600" /> Facebook
                  </label>
                  <input
                    type="text"
                    placeholder="username"
                    value={profile.social.facebook}
                    onChange={(e) => setProfile({ ...profile, social: { ...profile.social, facebook: e.target.value } })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Twitter className="w-4 h-4 text-sky-500" /> Twitter / X
                  </label>
                  <input
                    type="text"
                    placeholder="username"
                    value={profile.social.twitter}
                    onChange={(e) => setProfile({ ...profile, social: { ...profile.social, twitter: e.target.value } })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Linkedin className="w-4 h-4 text-blue-700" /> LinkedIn
                  </label>
                  <input
                    type="text"
                    placeholder="company/name"
                    value={profile.social.linkedin}
                    onChange={(e) => setProfile({ ...profile, social: { ...profile.social, linkedin: e.target.value } })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Profile Completion</h3>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <span className="text-sm font-semibold text-green-600">85%</span>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded bg-green-100">
                  <div style={{ width: '85%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500" />
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Basic information
                </li>
                <li className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Contact details
                </li>
                <li className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Address
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <AlertCircle className="w-4 h-4" /> Upload logo
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <AlertCircle className="w-4 h-4" /> Add services
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Directory Listing Tab */}
      {activeTab === 'directory' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-gray-900">Directory Visibility</h3>
                <p className="text-sm text-gray-500">Control whether your organization appears in the public directory</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={directorySettings.visible}
                  onChange={(e) => setDirectorySettings({ ...directorySettings, visible: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Directory Description</label>
                <textarea
                  rows={3}
                  value={directorySettings.description}
                  onChange={(e) => setDirectorySettings({ ...directorySettings, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Brief description for the public directory..."
                />
                <p className="text-xs text-gray-500 mt-1">This appears in search results and your directory listing</p>
              </div>

              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium text-gray-900">Display Options</h4>
                {[
                  { key: 'show_address', label: 'Show address' },
                  { key: 'show_phone', label: 'Show phone number' },
                  { key: 'show_email', label: 'Show email address' },
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={directorySettings[option.key as keyof typeof directorySettings] as boolean}
                      onChange={(e) => setDirectorySettings({ ...directorySettings, [option.key]: e.target.checked })}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Directory Preview</h3>
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-gray-900">{profile.name}</h4>
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full mt-1">
                    {profile.industry}
                  </span>
                  <p className="text-gray-600 text-sm mt-2">{directorySettings.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    {directorySettings.show_address && (
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{profile.city}, {profile.state}</span>
                    )}
                    {directorySettings.show_phone && (
                      <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{profile.phone}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Services & Capabilities</h3>
            <p className="text-sm text-gray-500 mb-6">Select the services your organization provides. This helps members find you in the directory.</p>
            
            <div className="space-y-3">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={service.selected}
                    onChange={(e) => {
                      setServices(services.map(s => s.id === service.id ? { ...s, selected: e.target.checked } : s))
                    }}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-gray-900">{service.name}</span>
                </label>
              ))}
            </div>

            <button className="mt-4 flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Request New Service Category
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
