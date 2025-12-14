'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Sparkles, Calendar, DollarSign, Building2, ExternalLink, 
  ChevronRight, Loader2, Filter, Star, Clock, CheckCircle
} from 'lucide-react'

type ExternalGrant = {
  id: string
  external_id: string
  title: string
  synopsis: string
  agency: string
  deadline: string
  estimated_funding: number
  min_award: number
  max_award: number
  match_score: number
  status: string
  application_url: string
  application_draft: {
    outline?: string
    generated_at?: string
  } | null
  created_at: string
}

export default function RecommendedGrantsPage() {
  const [opportunities, setOpportunities] = useState<ExternalGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high_priority' | 'recommended'>('all')
  const [generating, setGenerating] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchOpportunities()
  }, [filter])

  const fetchOpportunities = async () => {
    let query = supabase
      .from('external_grant_opportunities')
      .select('*')
      .order('match_score', { ascending: false })
      .order('deadline', { ascending: true })
      .limit(50)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    } else {
      query = query.in('status', ['discovered', 'recommended', 'high_priority'])
    }

    const { data, error } = await query

    if (!error) {
      setOpportunities(data || [])
    }
    setLoading(false)
  }

  const handleGenerateDraft = async (opportunityId: string) => {
    setGenerating(opportunityId)

    try {
      const res = await fetch('/api/grants/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      })

      if (res.ok) {
        fetchOpportunities() // Refresh to get updated draft
      }
    } catch (err) {
      console.error('Draft generation failed:', err)
    } finally {
      setGenerating(null)
    }
  }

  const handleMarkStatus = async (id: string, status: string) => {
    await supabase
      .from('external_grant_opportunities')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    
    fetchOpportunities()
  }

  const getMatchColor = (score: number) => {
    if (score >= 0.85) return 'bg-purple-100 text-purple-800 border-purple-300'
    if (score >= 0.7) return 'bg-blue-100 text-blue-800 border-blue-300'
    return 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getMatchLabel = (score: number) => {
    if (score >= 0.85) return 'Excellent Match'
    if (score >= 0.7) return 'Good Match'
    return 'Possible Match'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const highPriorityCount = opportunities.filter(o => o.match_score >= 0.85).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI-Recommended Grants</h1>
            <p className="text-gray-600 mt-1">
              Our AI scans federal opportunities daily and matches them to your mission
            </p>
          </div>
        </div>
        {highPriorityCount > 0 && (
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-medium">
            {highPriorityCount} High Priority
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Sparkles className="w-8 h-8 text-purple-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-purple-900">How This Works</h3>
            <p className="text-purple-800 mt-1">
              Every day, we scan thousands of federal grants from Grants.gov and use AI to score 
              how well each opportunity matches your organization's mission, focus areas, and capacity.
              High-scoring grants get automatic draft outlines to jumpstart your application.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-gray-400" />
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Matches' },
            { key: 'high_priority', label: 'High Priority' },
            { key: 'recommended', label: 'Recommended' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      {opportunities.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No matching opportunities found</p>
          <p className="text-sm text-gray-500">
            Make sure your organization profile has focus areas defined. 
            New matches are discovered daily.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {opportunities.map(opp => {
            const daysUntilDeadline = Math.ceil(
              (new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
            const isUrgent = daysUntilDeadline <= 14 && daysUntilDeadline > 0

            return (
              <div 
                key={opp.id} 
                className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Header */}
                <div className="p-6 border-b">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                      {opp.title}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                      getMatchColor(opp.match_score)
                    }`}>
                      {Math.round(opp.match_score * 100)}% Match
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span>{opp.agency}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6">
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {opp.synopsis || 'No description available'}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-gray-700">
                        {opp.estimated_funding 
                          ? `Up to $${(opp.estimated_funding / 100).toLocaleString()}`
                          : opp.max_award 
                            ? `$${opp.min_award?.toLocaleString() || '0'} - $${opp.max_award.toLocaleString()}`
                            : 'Amount varies'}
                      </span>
                    </div>
                    <div className={`flex items-center gap-2 ${isUrgent ? 'text-red-600' : ''}`}>
                      <Calendar className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-gray-500'}`} />
                      <span>
                        {isUrgent && <span className="font-medium">⚠️ </span>}
                        {daysUntilDeadline > 0 
                          ? `${daysUntilDeadline} days left`
                          : 'Deadline passed'}
                      </span>
                    </div>
                  </div>

                  {/* AI Draft Preview */}
                  {opp.application_draft?.outline && (
                    <div className="bg-purple-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">AI Draft Ready</span>
                      </div>
                      <p className="text-sm text-purple-800 line-clamp-2">
                        {opp.application_draft.outline.slice(0, 150)}...
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    {!opp.application_draft?.outline && (
                      <button
                        onClick={() => handleGenerateDraft(opp.id)}
                        disabled={generating === opp.id}
                        className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {generating === opp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Generate Draft
                      </button>
                    )}
                    
                    <a
                      href={opp.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`py-3 px-4 border rounded-lg font-medium hover:bg-gray-50 flex items-center gap-2 ${
                        opp.application_draft?.outline ? 'flex-1 justify-center' : ''
                      }`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      {opp.application_draft?.outline ? 'Apply on Grants.gov' : 'View'}
                    </a>

                    <button
                      onClick={() => handleMarkStatus(opp.id, 'applied')}
                      className="p-3 border rounded-lg hover:bg-green-50 hover:border-green-300"
                      title="Mark as Applied"
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
