'use client'

import { useState, useEffect } from 'react'
import { 
  MapPin, Users, Plus, Edit2, Trash2, 
  User, Mail, Globe, ChevronRight
} from 'lucide-react'

type Chapter = {
  id: string
  name: string
  code: string | null
  region: string | null
  states: string[]
  zip_prefixes: string[]
  president: { id: string; full_name: string; email: string } | null
  contact_email: string | null
  is_active: boolean
  member_count: number
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    region: '',
    states: [] as string[],
    zip_prefixes: '',
    contact_email: '',
  })

  useEffect(() => {
    fetchChapters()
  }, [])

  const fetchChapters = async () => {
    setLoading(true)
    const res = await fetch('/api/chapters?organization_id=ORG_ID')
    const data = await res.json()
    setChapters(data.chapters || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    await fetch('/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'ORG_ID',
        name: formData.name,
        code: formData.code || null,
        region: formData.region || null,
        states: formData.states,
        zip_prefixes: formData.zip_prefixes.split(',').map(z => z.trim()).filter(Boolean),
        contact_email: formData.contact_email || null,
      }),
    })

    setShowNewChapter(false)
    setFormData({ name: '', code: '', region: '', states: [], zip_prefixes: '', contact_email: '' })
    fetchChapters()
  }

  const toggleState = (state: string) => {
    setFormData(prev => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter(s => s !== state)
        : [...prev.states, state]
    }))
  }

  const totalMembers = chapters.reduce((sum, c) => sum + c.member_count, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chapters</h1>
          <p className="text-gray-600 mt-1">
            Regional chapters for member routing and local engagement
          </p>
        </div>
        <button
          onClick={() => setShowNewChapter(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Chapter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{chapters.length}</p>
              <p className="text-sm text-gray-600">Chapters</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMembers}</p>
              <p className="text-sm text-gray-600">Total Members</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(chapters.flatMap(c => c.states)).size}
              </p>
              <p className="text-sm text-gray-600">States Covered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chapters.map(chapter => (
          <div key={chapter.id} className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{chapter.name}</h3>
                {chapter.code && (
                  <span className="text-sm text-gray-500">{chapter.code}</span>
                )}
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                chapter.is_active 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {chapter.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {chapter.region && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {chapter.region}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                {chapter.member_count} members
              </div>

              {chapter.states?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {chapter.states.map(state => (
                    <span key={state} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                      {state}
                    </span>
                  ))}
                </div>
              )}

              {chapter.president && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>President: {chapter.president.full_name}</span>
                </div>
              )}

              {chapter.contact_email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {chapter.contact_email}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex justify-end gap-2">
              <button className="p-2 hover:bg-gray-100 rounded">
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {chapters.length === 0 && !loading && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No chapters yet</h3>
          <p className="text-gray-500 mb-4">
            Create chapters to automatically route members based on location
          </p>
          <button
            onClick={() => setShowNewChapter(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Chapter
          </button>
        </div>
      )}

      {/* New Chapter Modal */}
      {showNewChapter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Create Chapter</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chapter Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., Northeast Chapter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., NE"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Region
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Northeast United States"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  States Covered
                </label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                  {US_STATES.map(state => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => toggleState(state)}
                      className={`px-3 py-1 rounded text-sm ${
                        formData.states.includes(state)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formData.states.length} states selected
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code Prefixes
                </label>
                <input
                  type="text"
                  value={formData.zip_prefixes}
                  onChange={(e) => setFormData({ ...formData, zip_prefixes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., 100, 101, 102 (comma separated)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Members with these ZIP prefixes will be routed here
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="chapter@example.org"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewChapter(false)
                  setFormData({ name: '', code: '', region: '', states: [], zip_prefixes: '', contact_email: '' })
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create Chapter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
