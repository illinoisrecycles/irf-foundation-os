'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  ChevronRight, X, RefreshCw, Loader2
} from 'lucide-react'

type Insight = {
  id: string
  insight_type: 'trend' | 'warning' | 'opportunity' | 'recommendation'
  category: string
  title: string
  message: string
  data?: Record<string, any>
  action_url?: string
  action_label?: string
  priority: number
  is_dismissed: boolean
  created_at: string
}

const INSIGHT_ICONS = {
  trend: TrendingUp,
  warning: AlertTriangle,
  opportunity: Lightbulb,
  recommendation: Sparkles,
}

const INSIGHT_COLORS = {
  trend: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-orange-50 border-orange-200 text-orange-800',
  opportunity: 'bg-green-50 border-green-200 text-green-800',
  recommendation: 'bg-purple-50 border-purple-200 text-purple-800',
}

export function AIInsightsWidget() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchInsights()
  }, [])

  const fetchInsights = async () => {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('is_dismissed', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error) {
      setInsights(data || [])
    }
    setLoading(false)
  }

  const refreshInsights = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/insights/generate', { method: 'POST' })
      await fetchInsights()
    } catch (err) {
      console.error('Failed to refresh insights:', err)
    }
    setRefreshing(false)
  }

  const dismissInsight = async (id: string) => {
    await supabase
      .from('ai_insights')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', id)
    
    setInsights(insights.filter(i => i.id !== id))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
        </div>
        <button
          onClick={refreshInsights}
          disabled={refreshing}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className={`w-4 h-4 text-purple-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="p-8 text-center">
          <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No new insights right now</p>
          <p className="text-sm text-gray-500 mt-1">Check back later or refresh</p>
        </div>
      ) : (
        <div className="divide-y">
          {insights.map(insight => {
            const Icon = INSIGHT_ICONS[insight.insight_type] || Sparkles
            const colorClass = INSIGHT_COLORS[insight.insight_type] || INSIGHT_COLORS.recommendation

            return (
              <div key={insight.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-gray-900 text-sm">{insight.title}</h4>
                      <button
                        onClick={() => dismissInsight(insight.id)}
                        className="p-1 hover:bg-gray-200 rounded opacity-50 hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                    {insight.action_url && (
                      <Link
                        href={insight.action_url}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      >
                        {insight.action_label || 'Take action'}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/admin/insights"
        className="block p-3 text-center text-sm text-gray-600 hover:text-primary hover:bg-gray-50 border-t"
      >
        View All Insights →
      </Link>
    </div>
  )
}

/**
 * Full page insights view
 */
export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchAllInsights()
  }, [filter])

  const fetchAllInsights = async () => {
    let query = supabase
      .from('ai_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') {
      query = query.eq('insight_type', filter)
    }

    const { data, error } = await query

    if (!error) {
      setInsights(data || [])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-gray-600 mt-1">
            AI-powered recommendations and alerts based on your data
          </p>
        </div>
        <button
          onClick={() => fetch('/api/insights/generate', { method: 'POST' }).then(() => fetchAllInsights())}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Generate New Insights
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'trend', 'warning', 'opportunity', 'recommendation'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === type
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : insights.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No insights found</p>
          <p className="text-sm text-gray-500 mt-1">Generate new insights to see AI recommendations</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {insights.map(insight => {
            const Icon = INSIGHT_ICONS[insight.insight_type as keyof typeof INSIGHT_ICONS] || Sparkles
            const colorClass = INSIGHT_COLORS[insight.insight_type as keyof typeof INSIGHT_COLORS] || INSIGHT_COLORS.recommendation

            return (
              <div
                key={insight.id}
                className={`rounded-xl border p-6 ${
                  insight.is_dismissed ? 'opacity-50' : ''
                } ${colorClass}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/50 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase opacity-75">
                        {insight.category}
                      </span>
                      <span className="text-xs opacity-50">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mt-1">{insight.title}</h3>
                    <p className="text-sm opacity-90 mt-2">{insight.message}</p>
                    
                    {insight.data && (
                      <div className="mt-3 p-3 bg-white/30 rounded-lg">
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(insight.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {insight.action_url && (
                      <Link
                        href={insight.action_url}
                        className="inline-flex items-center gap-1 mt-4 font-medium hover:underline"
                      >
                        {insight.action_label || 'Take Action'} →
                      </Link>
                    )}
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
