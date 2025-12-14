'use client'

import * as React from 'react'
import { 
  Users, DollarSign, Calendar, TrendingUp, TrendingDown,
  Activity, AlertTriangle, CheckCircle, Clock, Zap,
  RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

type DashboardStats = {
  totalMembers: number
  membersTrend: number
  newMembersToday: number
  expiringThisWeek: number
  totalRevenue: number
  revenueTrend: number
  revenueToday: number
  eventsThisMonth: number
  upcomingEvents: number
  avgEngagement: number
  engagementTrend: number
  atRiskMembers: number
  pendingTasks: number
  automationsTriggered: number
}

type Props = {
  organizationId: string
  initialStats?: DashboardStats
}

export default function RealTimeDashboard({ organizationId, initialStats }: Props) {
  const [stats, setStats] = React.useState<DashboardStats | null>(initialStats || null)
  const [loading, setLoading] = React.useState(!initialStats)
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date())

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/dashboard/stats?organization_id=${organizationId}`)
      const data = await response.json()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (!initialStats) fetchStats()
    
    // Poll every 30 seconds for real-time feel
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [organizationId])

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  const formatTrend = (value: number) => {
    const isPositive = value >= 0
    return (
      <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        {Math.abs(value)}%
      </span>
    )
  }

  if (loading || !stats) {
    return (
      <div className="grid md:grid-cols-4 gap-6 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6 h-32" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Last Updated */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Dashboard Overview</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Updated {lastUpdated.toLocaleTimeString()}
          <button onClick={fetchStats} className="p-1 hover:bg-gray-100 rounded">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {/* Members */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            {formatTrend(stats.membersTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalMembers.toLocaleString()}</p>
          <p className="text-gray-500 text-sm">Total Members</p>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="text-green-600">+{stats.newMembersToday} today</span>
            <span className="text-orange-600">{stats.expiringThisWeek} expiring</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            {formatTrend(stats.revenueTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-gray-500 text-sm">Year-to-Date Revenue</p>
          <div className="mt-2 text-xs text-green-600">
            +{formatCurrency(stats.revenueToday)} today
          </div>
        </div>

        {/* Events */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.eventsThisMonth}</p>
          <p className="text-gray-500 text-sm">Events This Month</p>
          <div className="mt-2 text-xs text-purple-600">
            {stats.upcomingEvents} upcoming
          </div>
        </div>

        {/* Engagement */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
            {formatTrend(stats.engagementTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.avgEngagement}</p>
          <p className="text-gray-500 text-sm">Avg Engagement Score</p>
        </div>
      </div>

      {/* Action Items Row */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* At-Risk Members */}
        <div className={`rounded-xl border p-6 ${stats.atRiskMembers > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className={`w-5 h-5 ${stats.atRiskMembers > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <span className="font-medium text-gray-900">At-Risk Members</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.atRiskMembers}</p>
          <p className="text-sm text-gray-500">Members with low engagement</p>
          {stats.atRiskMembers > 0 && (
            <a href="/admin/members?filter=at-risk" className="mt-3 text-sm text-red-600 hover:underline block">
              View and take action →
            </a>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-900">Pending Tasks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pendingTasks}</p>
          <p className="text-sm text-gray-500">Tasks in your inbox</p>
          <a href="/admin/inbox" className="mt-3 text-sm text-blue-600 hover:underline block">
            Go to inbox →
          </a>
        </div>

        {/* Automations */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5" />
            <span className="font-medium">Automations Today</span>
          </div>
          <p className="text-2xl font-bold">{stats.automationsTriggered}</p>
          <p className="text-sm text-indigo-200">Tasks automated for you</p>
          <a href="/admin/automation" className="mt-3 text-sm text-white hover:underline block opacity-80">
            Manage automations →
          </a>
        </div>
      </div>
    </div>
  )
}
