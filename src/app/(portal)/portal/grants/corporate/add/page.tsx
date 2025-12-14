'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, DollarSign, Calendar, Link as LinkIcon, Save, Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

const CORPORATE_FUNDERS = [
  { name: 'Coca-Cola Foundation', focus: 'Water stewardship, recycling, circular economy' },
  { name: 'Patagonia Environmental Grants', focus: 'Environmental activism, biodiversity' },
  { name: 'Bank of America Charitable Foundation', focus: 'Sustainability, community resilience' },
  { name: 'Walmart Foundation/Spark Good', focus: 'Sustainability, local waste reduction' },
  { name: 'Google.org', focus: 'Climate innovation, environmental education' },
  { name: 'Disney Conservation Fund', focus: 'Habitat protection, conservation education' },
  { name: 'Microsoft Philanthropies', focus: 'Climate innovation, circular economy' },
  { name: 'Wells Fargo Foundation', focus: 'Environmental sustainability' },
  { name: 'Starbucks Foundation', focus: 'Sustainability, waste reduction' },
  { name: 'Toyota USA Foundation', focus: 'Environment, education' },
  { name: 'Other', focus: '' },
]

export default function AddCorporateGrantPage() {
  const [form, setForm] = useState({
    title: '',
    funder: '',
    custom_funder: '',
    synopsis: '',
    amount_min: '',
    amount_max: '',
    deadline: '',
    portal_url: '',
    eligibility_notes: '',
    focus_areas: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFunderSelect = (funderName: string) => {
    const funder = CORPORATE_FUNDERS.find(f => f.name === funderName)
    setForm({ 
      ...form, 
      funder: funderName,
      synopsis: funder?.focus || form.synopsis,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const funderName = form.funder === 'Other' ? form.custom_funder : form.funder

    // Get current org
    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user?.id)
      .single()

    if (!member) {
      setSaving(false)
      return
    }

    // Insert opportunity
    const { data: opp, error } = await supabase.from('external_grant_opportunities').insert({
      organization_id: member.organization_id,
      title: form.title,
      agency: funderName,
      synopsis: form.synopsis,
      min_award: form.amount_min ? parseInt(form.amount_min) * 100 : null,
      max_award: form.amount_max ? parseInt(form.amount_max) * 100 : null,
      deadline: form.deadline || null,
      application_url: form.portal_url,
      source_type: 'private',
      status: 'discovered',
      raw_data: {
        eligibility_notes: form.eligibility_notes,
        focus_areas: form.focus_areas,
        added_manually: true,
        funder_type: 'corporate',
      },
    }).select().single()

    if (!error && opp) {
      // Trigger AI matching
      try {
        const res = await fetch('/api/grants/match-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: opp.id }),
        })
        const result = await res.json()
        setMatchScore(result.score)
      } catch (err) {
        console.error('Match scoring failed:', err)
      }
    }

    setSaving(false)
    if (!error) {
      router.push('/portal/grants/opportunities')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add Corporate Grant Opportunity</h1>
        <p className="text-gray-600 mt-2">
          Track corporate foundation grants manually. AI will score alignment with your mission.
        </p>
      </div>

      {/* Quick Select Popular Funders */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-4">Quick Select Popular Corporate Funders</h3>
        <div className="flex flex-wrap gap-2">
          {CORPORATE_FUNDERS.slice(0, -1).map(funder => (
            <button
              key={funder.name}
              type="button"
              onClick={() => handleFunderSelect(funder.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.funder === funder.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-100'
              }`}
            >
              {funder.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grant Program Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="e.g., Community Recycling Innovation Grant"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Corporate Funder *
            </label>
            <select
              value={form.funder}
              onChange={e => handleFunderSelect(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              required
            >
              <option value="">Select a funder...</option>
              {CORPORATE_FUNDERS.map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          {form.funder === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Funder Name *
              </label>
              <input
                type="text"
                value={form.custom_funder}
                onChange={e => setForm({ ...form, custom_funder: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="Enter funder name"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount Range
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={form.amount_min}
                onChange={e => setForm({ ...form, amount_min: e.target.value })}
                className="flex-1 px-4 py-3 border rounded-lg"
                placeholder="Min ($)"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={form.amount_max}
                onChange={e => setForm({ ...form, amount_max: e.target.value })}
                className="flex-1 px-4 py-3 border rounded-lg"
                placeholder="Max ($)"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Deadline
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank if rolling/ongoing</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <LinkIcon className="w-4 h-4 inline mr-1" />
              Application Portal URL *
            </label>
            <input
              type="url"
              value={form.portal_url}
              onChange={e => setForm({ ...form, portal_url: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="https://..."
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description / Focus Areas
            </label>
            <textarea
              value={form.synopsis}
              onChange={e => setForm({ ...form, synopsis: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
              rows={3}
              placeholder="What does this grant fund? Key priorities?"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eligibility Notes
            </label>
            <textarea
              value={form.eligibility_notes}
              onChange={e => setForm({ ...form, eligibility_notes: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
              rows={3}
              placeholder="Geographic restrictions, org type requirements, etc."
            />
          </div>
        </div>

        {matchScore !== null && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <div>
              <p className="font-semibold text-purple-900">
                AI Match Score: {Math.round(matchScore * 100)}%
              </p>
              <p className="text-sm text-purple-700">
                {matchScore >= 0.8 ? 'Excellent match with your mission!' : 
                 matchScore >= 0.6 ? 'Good potential alignment' : 
                 'Consider reviewing fit with your programs'}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving & Matching...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save & Run AI Match
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
