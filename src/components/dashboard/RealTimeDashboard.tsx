'use client'

import * as React from 'react'
import { 
  Users, DollarSign, Calendar, TrendingUp, 
  ArrowUpRight, ArrowDownRight, RefreshCw 
} from 'lucide-react'

// ============================================================================
// REAL-TIME DASHBOARD
// Live-updating stats and metrics
// ============================================================================

type Stat = {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  color: string
}

export default function RealTimeDashboard() {
  const [stats, setStats] = React.useState<Stat[]>([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      
      const data = await res.json()
      
      setStats([
        {
          label: 'Total Members',
          value: data.totalMembers?.toLocaleString() || '0',
          change: data.memberGrowth,
          changeLabel: 'vs last month',
          icon: <Users className="w-6 h-6" />,
          color: 'blue',
        },
        {
          label: 'Monthly Revenue',
          value: `$${((data.monthlyRevenue || 0) / 100).toLocaleString()}`,
          change: data.revenueGrowth,
          changeLabel: 'vs last month',
          icon: <DollarSign className="w-6 h-6" />,
          color: 'green',
        },
        {
          label: 'Upcoming Events',
          value: data.upcomingEvents || '0',
          icon: <Calendar className="w-6 h-6" />,
          color: 'purple',
        },
        {
          label: 'Engagement Rate',
          value: `${data.engagementRate || 0}%`,
          change: data.engagementChange,
          changeLabel: 'vs last month',
          icon: <TrendingUp className="w-6 h-6" />,
          color: 'orange',
        },
      ])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Dashboard stats error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStats()
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
    green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500' },
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const colors = colorClasses[stat.color] || colorClasses.blue

          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <span className={colors.icon}>{stat.icon}</span>
                </div>
              </div>
              
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                
                {stat.change !== undefined && (
                  <div className={`flex items-center text-sm ${
                    stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>{Math.abs(stat.change)}%</span>
                  </div>
                )}
              </div>
              
              {stat.changeLabel && (
                <p className="text-xs text-gray-400 mt-1">{stat.changeLabel}</p>
              )}
            </div>
          )
        })}
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-4 text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
