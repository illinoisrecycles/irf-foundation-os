'use client'

import { useState, useEffect } from 'react'
import { 
  Users, Plus, Calendar, MapPin, Clock, Award,
  Loader2, Check, X, ChevronRight, Search, Filter
} from 'lucide-react'

type Opportunity = {
  id: string
  title: string
  description: string
  date_start: string
  date_end?: string
  location: string
  is_virtual: boolean
  required_volunteers: number
  signed_up_count: number
  skills_needed: string[]
  status: string
}

type Signup = {
  id: string
  volunteer_name: string
  volunteer_email: string
  status: string
  hours_logged: number
  hours_approved: boolean
  signed_up_at: string
}

export default function VolunteersPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'opportunities' | 'signups' | 'hours'>('opportunities')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(null)

  useEffect(() => {
    fetchOpportunities()
  }, [])

  const fetchOpportunities = async () => {
    const res = await fetch('/api/volunteers/opportunities')
    const data = await res.json()
    setOpportunities(data.opportunities || [])
    setLoading(false)
  }

  // Calculate stats
  const stats = {
    total_opportunities: opportunities.length,
    upcoming: opportunities.filter(o => new Date(o.date_start) > new Date()).length,
    total_volunteers: opportunities.reduce((sum, o) => sum + o.signed_up_count, 0),
    total_spots: opportunities.reduce((sum, o) => sum + o.required_volunteers, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Volunteer Management</h1>
          <p className="text-gray-600 mt-1">Manage opportunities, sign-ups, and track hours</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Opportunity
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_opportunities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Volunteers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_volunteers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Fill Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total_spots > 0 
                  ? Math.round((stats.total_volunteers / stats.total_spots) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'opportunities', label: 'Opportunities' },
            { id: 'signups', label: 'Sign-ups' },
            { id: 'hours', label: 'Hours & Recognition' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {/* Search/Filter */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search opportunities..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select className="px-4 py-2 border rounded-lg">
                <option value="">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Opportunities List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : opportunities.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No volunteer opportunities yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg"
              >
                Create Your First Opportunity
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {opportunities.map(opp => (
                <div
                  key={opp.id}
                  className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedOpportunity(opp.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{opp.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      opp.status === 'published' ? 'bg-green-100 text-green-700' :
                      opp.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {opp.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(opp.date_start).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {opp.is_virtual ? 'Virtual' : opp.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {opp.signed_up_count} / {opp.required_volunteers} volunteers
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((opp.signed_up_count / opp.required_volunteers) * 100, 100)}%`
                      }}
                    />
                  </div>

                  {/* Skills */}
                  {opp.skills_needed.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {opp.skills_needed.slice(0, 3).map(skill => (
                        <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                      {opp.skills_needed.length > 3 && (
                        <span className="px-2 py-1 text-gray-500 text-xs">
                          +{opp.skills_needed.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'signups' && (
        <SignupsTab />
      )}

      {activeTab === 'hours' && (
        <HoursTab />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateOpportunityModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchOpportunities()
          }}
        />
      )}
    </div>
  )
}

function SignupsTab() {
  const [signups, setSignups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSignups()
  }, [])

  const fetchSignups = async () => {
    const res = await fetch('/api/volunteers/signups')
    const data = await res.json()
    setSignups(data.signups || [])
    setLoading(false)
  }

  const handleApproveHours = async (id: string, hours: number) => {
    await fetch('/api/volunteers/signups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hours_logged: hours, hours_approved: true, status: 'completed' })
    })
    fetchSignups()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volunteer</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {signups.map(signup => (
            <tr key={signup.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="font-medium text-gray-900">{signup.volunteer_name || 'Member'}</p>
                <p className="text-sm text-gray-500">{signup.volunteer_email}</p>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {signup.opportunity?.title}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  signup.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                  signup.status === 'completed' ? 'bg-green-100 text-green-700' :
                  signup.status === 'no_show' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {signup.status}
                </span>
              </td>
              <td className="px-6 py-4">
                {signup.hours_logged > 0 ? (
                  <span className={signup.hours_approved ? 'text-green-600' : 'text-yellow-600'}>
                    {signup.hours_logged}h {signup.hours_approved ? '✓' : '(pending)'}
                  </span>
                ) : '-'}
              </td>
              <td className="px-6 py-4 text-right">
                {signup.status === 'confirmed' && (
                  <div className="flex items-center justify-end gap-2">
                    <input
                      type="number"
                      placeholder="Hours"
                      className="w-20 px-2 py-1 border rounded text-sm"
                      step="0.5"
                      min="0"
                      id={`hours-${signup.id}`}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`hours-${signup.id}`) as HTMLInputElement
                        if (input?.value) {
                          handleApproveHours(signup.id, parseFloat(input.value))
                        }
                      }}
                      className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HoursTab() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Volunteers</h3>
        <div className="space-y-4">
          {[
            { name: 'Jane Smith', hours: 48, badge: '🥇' },
            { name: 'John Doe', hours: 32, badge: '🥈' },
            { name: 'Alice Johnson', hours: 24, badge: '🥉' },
          ].map((vol, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{vol.badge}</span>
                <span className="font-medium text-gray-900">{vol.name}</span>
              </div>
              <span className="text-gray-600">{vol.hours} hours</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Badges</h3>
        <div className="space-y-4">
          {[
            { name: 'Rising Star', criteria: '10+ hours', awarded: 12, icon: '⭐' },
            { name: 'Dedicated Volunteer', criteria: '50+ hours', awarded: 5, icon: '🏆' },
            { name: 'Century Club', criteria: '100+ hours', awarded: 2, icon: '💎' },
          ].map((badge, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="font-medium text-gray-900">{badge.name}</p>
                  <p className="text-sm text-gray-500">{badge.criteria}</p>
                </div>
              </div>
              <span className="text-gray-600">{badge.awarded} awarded</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreateOpportunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      date_start: formData.get('date_start'),
      date_end: formData.get('date_end') || null,
      location: formData.get('location'),
      is_virtual: formData.get('is_virtual') === 'on',
      required_volunteers: parseInt(formData.get('required_volunteers') as string) || 1,
      skills_needed: skills,
      status: 'published'
    }

    const res = await fetch('/api/volunteers/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (res.ok) {
      onCreated()
    }
    setSaving(false)
  }

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Create Volunteer Opportunity</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              name="title"
              required
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="E.g., Earth Day Cleanup"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="What will volunteers be doing?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date/Time *</label>
              <input
                type="datetime-local"
                name="date_start"
                required
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date/Time</label>
              <input
                type="datetime-local"
                name="date_end"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <input
              type="text"
              name="location"
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Address or location name"
            />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_virtual" className="rounded" />
            <span className="text-sm text-gray-700">This is a virtual opportunity</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Volunteers Needed</label>
            <input
              type="number"
              name="required_volunteers"
              defaultValue={5}
              min={1}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Skills Needed</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                className="flex-1 px-4 py-2 border rounded-lg"
                placeholder="Add a skill"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-2"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter(s => s !== skill))}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
