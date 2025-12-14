'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Building2, Search, Plus, Filter, Download, Upload, Mail, Phone, Globe, MapPin,
  MoreVertical, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, AlertCircle, X
} from 'lucide-react'

type MemberOrganization = {
  id: string
  name: string
  org_type: string
  industry: string | null
  website: string | null
  phone: string | null
  email: string | null
  city: string | null
  state: string | null
  membership_status: string
  member_since: string | null
  membership_expires_at: string | null
  logo_url: string | null
  membership_plan: { id: string; name: string } | null
  contacts: { id: string; first_name: string; last_name: string; email: string; is_primary_contact: boolean }[]
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' },
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  expired: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Expired' },
  cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' },
}

const orgTypeLabels: Record<string, string> = {
  business: 'Business', nonprofit: 'Nonprofit', government: 'Government',
  municipality: 'Municipality', educational: 'Educational', individual: 'Individual',
}

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [selectedMember, setSelectedMember] = React.useState<MemberOrganization | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['member-organizations', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      const res = await fetch(`/api/member-organizations?${params}`)
      return res.json()
    },
  })

  const members: MemberOrganization[] = data?.members ?? []
  const stats = {
    total: members.length,
    active: members.filter(m => m.membership_status === 'active').length,
    pending: members.filter(m => m.membership_status === 'pending').length,
    expired: members.filter(m => m.membership_status === 'expired').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Member Organizations</h1>
          <p className="text-gray-600 mt-1">Manage your membership directory</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Members', value: stats.total, color: 'blue', icon: Building2 },
          { label: 'Active', value: stats.active, color: 'green', icon: CheckCircle },
          { label: 'Pending', value: stats.pending, color: 'yellow', icon: Clock },
          { label: 'Expired', value: stats.expired, color: 'red', icon: XCircle },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search members..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No members yet</h3>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg">
              <Plus className="w-4 h-4" /> Add Member
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => {
                const status = statusConfig[member.membership_status] || statusConfig.pending
                const StatusIcon = status.icon
                const contact = member.contacts?.find(c => c.is_primary_contact) || member.contacts?.[0]
                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          {member.website && <a href={member.website} className="text-sm text-blue-600">Website</a>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {contact ? (
                        <div>
                          <div className="text-sm">{contact.first_name} {contact.last_name}</div>
                          <div className="text-sm text-gray-500">{contact.email}</div>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-sm">{orgTypeLabels[member.org_type] || member.org_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {member.city && member.state ? `${member.city}, ${member.state}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedMember(member)} className="p-2 hover:bg-gray-100 rounded">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
      {selectedMember && <MemberSidebar member={selectedMember} onClose={() => setSelectedMember(null)} />}
    </div>
  )
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = React.useState({ name: '', org_type: 'business', email: '', phone: '', city: '', state: '',
    primary_contact: { first_name: '', last_name: '', email: '' } })
  const [saving, setSaving] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/member-organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Add Member Organization</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Organization Name *</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={form.org_type} onChange={e => setForm({...form, org_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="business">Business</option>
                <option value="nonprofit">Nonprofit</option>
                <option value="government">Government</option>
                <option value="municipality">Municipality</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <h3 className="font-medium pt-2">Primary Contact</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="First Name *" required value={form.primary_contact.first_name}
              onChange={e => setForm({...form, primary_contact: {...form.primary_contact, first_name: e.target.value}})}
              className="px-3 py-2 border rounded-lg" />
            <input placeholder="Last Name *" required value={form.primary_contact.last_name}
              onChange={e => setForm({...form, primary_contact: {...form.primary_contact, last_name: e.target.value}})}
              className="px-3 py-2 border rounded-lg" />
          </div>
          <input type="email" placeholder="Contact Email *" required value={form.primary_contact.email}
            onChange={e => setForm({...form, primary_contact: {...form.primary_contact, email: e.target.value}})}
            className="w-full px-3 py-2 border rounded-lg" />
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {saving ? 'Saving...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MemberSidebar({ member, onClose }: { member: MemberOrganization; onClose: () => void }) {
  const status = statusConfig[member.membership_status] || statusConfig.pending
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex justify-between">
        <h2 className="font-bold">Member Details</h2>
        <button onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <h3 className="font-bold">{member.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {member.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-gray-400" />{member.email}</div>}
          {member.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-gray-400" />{member.phone}</div>}
          {member.website && <div className="flex gap-2"><Globe className="w-4 h-4 text-gray-400" /><a href={member.website} className="text-blue-600">{member.website}</a></div>}
          {member.city && <div className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400" />{member.city}, {member.state}</div>}
        </div>
        {member.contacts?.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Contacts</h4>
            {member.contacts.map(c => (
              <div key={c.id} className="p-2 bg-gray-50 rounded mb-2">
                <div className="font-medium">{c.first_name} {c.last_name}</div>
                <div className="text-sm text-gray-500">{c.email}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
