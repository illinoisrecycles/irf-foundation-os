'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Plus, Target, Users, Calendar, ChevronRight, Loader2,
  Edit, Trash2, BarChart3, CheckCircle
} from 'lucide-react'

type Program = {
  id: string
  title: string
  description: string
  status: string
  start_date: string
  end_date: string
  budget_cents: number
  program_type: string
  beneficiaries: { count: number }[]
  indicators: { id: string; name: string; target_value: number }[]
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchPrograms()
  }, [])

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        beneficiaries:beneficiaries(count),
        indicators:outcome_indicators(id, name, target_value)
      `)
      .order('created_at', { ascending: false })

    if (!error) {
      setPrograms(data || [])
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return
    
    await supabase.from('programs').delete().eq('id', id)
    fetchPrograms()
  }

  const statusColors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    suspended: 'bg-red-100 text-red-800',
  }

  const programTypes: Record<string, string> = {
    direct_service: 'Direct Service',
    education: 'Education',
    advocacy: 'Advocacy',
    research: 'Research',
    grant_funded: 'Grant Funded',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
          <p className="text-gray-600 mt-1">Manage programs and track outcomes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Program
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-600">Total Programs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{programs.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {programs.filter(p => p.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-600">Total Beneficiaries</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {programs.reduce((sum, p) => sum + (p.beneficiaries?.[0]?.count || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-600">Outcome Indicators</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">
            {programs.reduce((sum, p) => sum + (p.indicators?.length || 0), 0)}
          </p>
        </div>
      </div>

      {/* Programs Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No programs created yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Create Your First Program
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map(program => (
            <div key={program.id} className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-2 bg-primary" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{program.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[program.status]}`}>
                    {program.status}
                  </span>
                </div>

                {program.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{program.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{program.beneficiaries?.[0]?.count || 0} beneficiaries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span>{program.indicators?.length || 0} outcome indicators</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {program.start_date 
                        ? new Date(program.start_date).toLocaleDateString() 
                        : 'No start date'}
                      {program.end_date && ` - ${new Date(program.end_date).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>

                {program.program_type && (
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs mb-4">
                    {programTypes[program.program_type] || program.program_type}
                  </span>
                )}

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Link
                    href={`/admin/impact/programs/${program.id}`}
                    className="flex-1 py-2 bg-primary text-white rounded-lg text-center text-sm font-medium hover:bg-primary/90"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleDelete(program.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <CreateProgramModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            fetchPrograms()
          }}
        />
      )}
    </div>
  )
}

function CreateProgramModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    
    const { error } = await supabase.from('programs').insert({
      title: formData.get('title'),
      description: formData.get('description'),
      program_type: formData.get('program_type'),
      start_date: formData.get('start_date') || null,
      end_date: formData.get('end_date') || null,
      goal: formData.get('goal'),
      status: 'planning',
    })

    if (!error) {
      onCreated()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Create Program</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Program Name *
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="e.g., Community Recycling Education"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Program overview and purpose..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Program Type
            </label>
            <select name="program_type" className="w-full px-4 py-2 border rounded-lg">
              <option value="direct_service">Direct Service</option>
              <option value="education">Education</option>
              <option value="advocacy">Advocacy</option>
              <option value="research">Research</option>
              <option value="grant_funded">Grant Funded</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Program Goal
            </label>
            <textarea
              name="goal"
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="What does success look like?"
            />
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
              {saving ? 'Creating...' : 'Create Program'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
