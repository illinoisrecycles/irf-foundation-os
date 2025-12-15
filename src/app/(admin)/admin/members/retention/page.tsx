'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Heart, AlertTriangle, TrendingDown, TrendingUp, Users, 
  Mail, Phone, Calendar, RefreshCw, Loader2, ChevronRight,
  Activity, Eye, DollarSign, Clock
} from 'lucide-react'

type HealthScore = {
  id: string
  profile_id: string
  score: number
  previous_score: number | null
  score_change: number
  engagement_score: number
  financial_score: number
  tenure_score: number
  activity_score: number
  risk_level: string
  positive_signals: string[]
  negative_signals: string[]
  last_calculated_at: string
  profile: {
    full_name: string
    email: string
    avatar_url: string | null
  }
  member_org?: {
    organization_name: string
    membership_type: { name: string }
    expires_at: string
  }
}

export default function RetentionDashboardPage() {
  const [scores, setScores] = useState<HealthScore[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [selectedMember, setSelectedMember] = useState<HealthScore | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchScores()
  }, [filter])

  const fetchScores = async () => {
    let query = supabase
      .from('member_health_scores')
      .select(`
        *,
        profile:profiles(full_name, email, avatar_url)
      `)
      .order('score', { ascending: true })

    if (filter !== 'all') {
      query = query.eq('risk_level', filter)
    }

    const { data, error } = await query.limit(100)
    if (!error) {
      setScores(data || [])
    }
    setLoading(false)
  }

  const recalculateAll = async () => {
    setRecalculating(true)
    try {
      await fetch('/api/analytics/health-scores', { method: 'POST' })
      await fetchScores()
    } catch (err) {
      console.error('Recalculation failed:', err)
    }
    setRecalculating(false)
  }

  // Summary stats
  const stats = {
    total: scores.length,
    healthy: scores.filter(s => s.risk_level === 'healthy').length,
    watch: scores.filter(s => s.risk_level === 'watch').length,
    atRisk: scores.filter(s => s.risk_level === 'at_risk').length,
    critical: scores.filter(s => s.risk_level === 'critical').length,
    avgScore: scores.length > 0 
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0,
    declining: scores.filter(s => s.score_change < -5).length,
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'watch': return 'bg-yellow-100 text-yellow-800'
      case 'at_risk': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    if (score >= 30) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Member Retention</h1>
          <p className="text-gray-600 mt-1">Health scores and churn prediction</p>
        </div>
        <button
          onClick={recalculateAll}
          disabled={recalculating}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
        >
          {recalculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Recalculate Scores
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Tracked</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.healthy}</p>
              <p className="text-xs text-gray-500">Healthy</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.watch}</p>
              <p className="text-xs text-gray-500">Watch</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.atRisk}</p>
              <p className="text-xs text-gray-500">At Risk</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-gray-500">Critical</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgScore}</p>
              <p className="text-xs text-gray-500">Avg Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All Members' },
          { key: 'critical', label: 'Critical' },
          { key: 'at_risk', label: 'At Risk' },
          { key: 'watch', label: 'Watch' },
          { key: 'healthy', label: 'Healthy' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : scores.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No health scores calculated yet</p>
          <button
            onClick={recalculateAll}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Calculate Health Scores
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Member</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Health Score</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Change</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Engagement</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Financial</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Tenure</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Risk Level</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scores.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {member.profile?.avatar_url ? (
                          <img src={member.profile.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-gray-600 font-medium">
                            {member.profile?.full_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.profile?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{member.profile?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-2xl font-bold ${getScoreColor(member.score)}`}>
                      {member.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {member.score_change !== 0 && (
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                        member.score_change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {member.score_change > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {member.score_change > 0 ? '+' : ''}{member.score_change}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-full max-w-[60px] mx-auto">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${member.engagement_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{member.engagement_score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-full max-w-[60px] mx-auto">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${member.financial_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{member.financial_score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-full max-w-[60px] mx-auto">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: `${member.tenure_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{member.tenure_score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(member.risk_level)}`}>
                      {member.risk_level.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedMember(member)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member Detail Sidebar */}
      {selectedMember && (
        <MemberHealthDetail
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

function MemberHealthDetail({ member, onClose }: { member: HealthScore; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-semibold">Member Health Details</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              {member.profile?.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
              ) : (
                <span className="text-2xl text-gray-600 font-medium">
                  {member.profile?.full_name?.[0] || '?'}
                </span>
              )}
            </div>
            <div>
              <p className="text-xl font-semibold">{member.profile?.full_name}</p>
              <p className="text-gray-500">{member.profile?.email}</p>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="text-center mb-6">
              <p className="text-6xl font-bold" style={{ 
                color: member.score >= 70 ? '#16a34a' : member.score >= 50 ? '#ca8a04' : member.score >= 30 ? '#ea580c' : '#dc2626'
              }}>
                {member.score}
              </p>
              <p className="text-gray-500 mt-1">Health Score</p>
              {member.score_change !== 0 && (
                <p className={`text-sm mt-2 ${member.score_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {member.score_change > 0 ? '↑' : '↓'} {Math.abs(member.score_change)} from last calculation
                </p>
              )}
            </div>

            <div className="space-y-4">
              <ScoreBar label="Engagement" score={member.engagement_score} icon={<Activity className="w-4 h-4" />} color="blue" />
              <ScoreBar label="Financial" score={member.financial_score} icon={<DollarSign className="w-4 h-4" />} color="green" />
              <ScoreBar label="Tenure" score={member.tenure_score} icon={<Clock className="w-4 h-4" />} color="purple" />
              <ScoreBar label="Activity" score={member.activity_score} icon={<Eye className="w-4 h-4" />} color="orange" />
            </div>
          </div>

          {/* Signals */}
          {(member.negative_signals?.length > 0 || member.positive_signals?.length > 0) && (
            <div className="space-y-4">
              {member.negative_signals?.length > 0 && (
                <div>
                  <p className="font-medium text-red-800 mb-2">⚠️ Warning Signals</p>
                  <div className="space-y-2">
                    {member.negative_signals.map((signal, i) => (
                      <div key={i} className="bg-red-50 text-red-800 px-3 py-2 rounded-lg text-sm">
                        {signal.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {member.positive_signals?.length > 0 && (
                <div>
                  <p className="font-medium text-green-800 mb-2">✓ Positive Signals</p>
                  <div className="space-y-2">
                    {member.positive_signals.map((signal, i) => (
                      <div key={i} className="bg-green-50 text-green-800 px-3 py-2 rounded-lg text-sm">
                        {signal.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <p className="font-medium text-gray-700">Retention Actions</p>
            <button className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 flex items-center gap-3">
              <Mail className="w-5 h-5" />
              Send Re-engagement Email
            </button>
            <button className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 flex items-center gap-3">
              <Phone className="w-5 h-5" />
              Schedule Personal Call
            </button>
            <button className="w-full px-4 py-3 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              Invite to Upcoming Event
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Last calculated: {new Date(member.last_calculated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, score, icon, color }: { label: string; score: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-2 text-gray-600">
          {icon} {label}
        </span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="bg-gray-200 rounded-full h-2">
        <div 
          className={`${colors[color]} h-2 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
