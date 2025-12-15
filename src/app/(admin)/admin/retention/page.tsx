'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Heart, AlertTriangle, TrendingUp, TrendingDown, Users,
  Activity, DollarSign, Calendar, Filter, Download, RefreshCw,
  ChevronRight, Mail, Phone, Loader2
} from 'lucide-react'

type MemberHealth = {
  id: string
  profile_id: string
  member_org_id: string
  score: number
  previous_score: number
  score_change: number
  engagement_score: number
  financial_score: number
  tenure_score: number
  activity_score: number
  positive_signals: string[]
  negative_signals: string[]
  risk_level: string
  last_calculated_at: string
  last_engagement_at: string | null
  profile?: {
    full_name: string
    email: string
    phone: string
    avatar_url: string
  }
  member_org?: {
    organization_name: string
    membership_type_id: string
    joined_at: string
    expires_at: string
  }
}

export default function RetentionDashboardPage() {
  const [healthData, setHealthData] = useState<MemberHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    let query = supabase
      .from('member_health_scores')
      .select(`
        *,
        profile:profiles(full_name, email, phone, avatar_url),
        member_org:member_organizations(organization_name, membership_type_id, joined_at, expires_at)
      `)
      .order('score', { ascending: true })

    if (filter !== 'all') {
      query = query.eq('risk_level', filter)
    }

    const { data, error } = await query.limit(100)
    if (!error) {
      setHealthData(data || [])
    }
    setLoading(false)
  }

  const runHealthCheck = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/cron/health-scores', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'manual'}` }
      })
      await fetchData()
    } catch (err) {
      console.error('Health check failed:', err)
    }
    setRefreshing(false)
  }

  // Calculate summary stats
  const stats = {
    total: healthData.length,
    healthy: healthData.filter(m => m.risk_level === 'healthy').length,
    watch: healthData.filter(m => m.risk_level === 'watch').length,
    atRisk: healthData.filter(m => m.risk_level === 'at_risk').length,
    critical: healthData.filter(m => m.risk_level === 'critical').length,
    avgScore: healthData.length 
      ? Math.round(healthData.reduce((sum, m) => sum + m.score, 0) / healthData.length)
      : 0,
    droppedSignificantly: healthData.filter(m => m.score_change <= -10).length,
    improved: healthData.filter(m => m.score_change >= 10).length,
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200'
      case 'watch': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'at_risk': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    if (score >= 30) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Member Retention</h1>
          <p className="text-gray-600 mt-1">Health scores and churn risk analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runHealthCheck}
            disabled={refreshing}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Recalculate Scores
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total Tracked</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Heart className="w-4 h-4" />
            <span className="text-sm">Healthy</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.healthy}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Watch</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.watch}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">At Risk</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.atRisk}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Critical</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Declining</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.droppedSignificantly}</p>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden">
          {stats.total > 0 && (
            <>
              <div 
                className="bg-green-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.healthy / stats.total) * 100}%` }}
              >
                {Math.round((stats.healthy / stats.total) * 100)}%
              </div>
              <div 
                className="bg-yellow-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.watch / stats.total) * 100}%` }}
              >
                {stats.watch > 0 ? Math.round((stats.watch / stats.total) * 100) + '%' : ''}
              </div>
              <div 
                className="bg-orange-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.atRisk / stats.total) * 100}%` }}
              >
                {stats.atRisk > 0 ? Math.round((stats.atRisk / stats.total) * 100) + '%' : ''}
              </div>
              <div 
                className="bg-red-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(stats.critical / stats.total) * 100}%` }}
              >
                {stats.critical > 0 ? Math.round((stats.critical / stats.total) * 100) + '%' : ''}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-6 mt-3 text-sm">
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded"></span> Healthy (70+)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 rounded"></span> Watch (50-69)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-500 rounded"></span> At Risk (30-49)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded"></span> Critical (&lt;30)</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'All Members' },
          { key: 'critical', label: 'Critical', color: 'text-red-600' },
          { key: 'at_risk', label: 'At Risk', color: 'text-orange-600' },
          { key: 'watch', label: 'Watch', color: 'text-yellow-600' },
          { key: 'healthy', label: 'Healthy', color: 'text-green-600' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === tab.key
                ? 'bg-gray-900 text-white'
                : `bg-white border hover:bg-gray-50 ${tab.color || ''}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : healthData.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No health data available</p>
          <button
            onClick={runHealthCheck}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Run Health Check
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {healthData.map(member => (
            <div key={member.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                  {member.profile?.full_name?.charAt(0) || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">
                      {member.profile?.full_name || 'Unknown'}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(member.risk_level)}`}>
                      {member.risk_level}
                    </span>
                    {member.score_change !== 0 && (
                      <span className={`flex items-center text-xs ${member.score_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {member.score_change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(member.score_change)} pts
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {member.profile?.email}
                    {member.member_org?.organization_name && ` • ${member.member_org.organization_name}`}
                  </p>
                </div>

                {/* Score Breakdown */}
                <div className="hidden lg:flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-500">Engagement</p>
                    <p className="font-medium">{member.engagement_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Financial</p>
                    <p className="font-medium">{member.financial_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Tenure</p>
                    <p className="font-medium">{member.tenure_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Activity</p>
                    <p className="font-medium">{member.activity_score}</p>
                  </div>
                </div>

                {/* Overall Score */}
                <div className="w-24 text-center">
                  <div className="relative w-16 h-16 mx-auto">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-200"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${member.score * 1.76} 176`}
                        className={member.score >= 70 ? 'text-green-500' : member.score >= 50 ? 'text-yellow-500' : member.score >= 30 ? 'text-orange-500' : 'text-red-500'}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                      {member.score}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {member.profile?.email && (
                    <a
                      href={`mailto:${member.profile.email}`}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Send email"
                    >
                      <Mail className="w-4 h-4 text-gray-500" />
                    </a>
                  )}
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Signals */}
              {(member.negative_signals?.length > 0 || member.positive_signals?.length > 0) && (
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                  {member.negative_signals?.map((signal, i) => (
                    <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                      {signal.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {member.positive_signals?.map((signal, i) => (
                    <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                      {signal.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
