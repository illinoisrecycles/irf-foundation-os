'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Users, DollarSign, Calendar, Target, TrendingUp, TrendingDown,
  ArrowRight, Loader2, Sparkles, Clock, Award, FileText
} from 'lucide-react'
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

interface DrillDownCardProps {
  title: string
  value: string | number
  subtitle?: string
  href: string
  icon: React.ComponentType<any>
  color: 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'indigo'
  trend?: number
  trendLabel?: string
}

function DrillDownCard({ title, value, subtitle, href, icon: Icon, color, trend, trendLabel }: DrillDownCardProps) {
  const colorMap = {
    green: { bg: 'bg-green-100', text: 'text-green-600', icon: 'text-green-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'text-blue-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'text-orange-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'text-purple-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600', icon: 'text-red-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', icon: 'text-indigo-600' },
  }

  const colors = colorMap[color]

  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border p-6 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600">{title}</p>
            <p className={`text-3xl font-bold text-gray-900 mt-2`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{trend >= 0 ? '+' : ''}{trend}% {trendLabel || 'vs last period'}</span>
              </div>
            )}
          </div>
          <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${colors.icon}`} />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm text-gray-500 group-hover:text-primary transition-colors">
          View details <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </Link>
  )
}

export default function ExecutiveDashboard() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    // In production, use the get_dashboard_metrics RPC
    // For now, aggregate from multiple queries
    
    const [
      { count: totalMembers },
      { count: activeMembers },
      { data: donations },
      { count: upcomingEvents },
      { data: volunteerHours },
      { count: grantOpportunities },
    ] = await Promise.all([
      supabase.from('member_organizations').select('*', { count: 'exact', head: true }),
      supabase.from('member_organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('donations').select('amount_cents').gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
      supabase.from('events').select('*', { count: 'exact', head: true }).gte('date_start', new Date().toISOString()),
      supabase.from('volunteer_hours').select('hours').eq('status', 'approved'),
      supabase.from('external_grant_opportunities').select('*', { count: 'exact', head: true }).in('status', ['recommended', 'high_priority']),
    ])

    const ytdDonations = donations?.reduce((sum, d) => sum + (d.amount_cents || 0), 0) || 0
    const totalVolunteerHours = volunteerHours?.reduce((sum, h) => sum + (h.hours || 0), 0) || 0

    setMetrics({
      totalMembers: totalMembers || 0,
      activeMembers: activeMembers || 0,
      renewalRate: totalMembers ? Math.round(((activeMembers || 0) / totalMembers) * 100) : 0,
      ytdDonations,
      upcomingEvents: upcomingEvents || 0,
      volunteerHours: totalVolunteerHours,
      grantOpportunities: grantOpportunities || 0,
      // Mock trend data - would come from historical queries
      membershipTrend: [
        { month: 'Jan', new: 12, renewed: 45, lapsed: 3 },
        { month: 'Feb', new: 15, renewed: 52, lapsed: 5 },
        { month: 'Mar', new: 18, renewed: 48, lapsed: 4 },
        { month: 'Apr', new: 22, renewed: 55, lapsed: 2 },
        { month: 'May', new: 25, renewed: 60, lapsed: 6 },
        { month: 'Jun', new: 20, renewed: 58, lapsed: 4 },
      ],
      revenueSources: [
        { name: 'Membership', value: 45, color: '#10b981' },
        { name: 'Donations', value: 30, color: '#3b82f6' },
        { name: 'Events', value: 15, color: '#f59e0b' },
        { name: 'Grants', value: 10, color: '#8b5cf6' },
      ],
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Real-time overview of operations, finances, and impact • {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
          })}
        </p>
      </div>

      {/* AI Grant Alert */}
      {metrics?.grantOpportunities > 0 && (
        <Link href="/portal/grants/opportunities">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <Sparkles className="w-10 h-10" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">
                  {metrics.grantOpportunities} AI-Matched Grant{metrics.grantOpportunities > 1 ? 's' : ''} Found
                </h3>
                <p className="text-purple-100 mt-1">
                  Our AI discovered new funding opportunities that match your mission
                </p>
              </div>
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
        </Link>
      )}

      {/* Key Metrics - Drill Down Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DrillDownCard
          title="Active Members"
          value={metrics?.activeMembers}
          subtitle={`${metrics?.renewalRate}% retention rate`}
          href="/admin/members?status=active"
          icon={Users}
          color="green"
          trend={5}
          trendLabel="vs last year"
        />
        <DrillDownCard
          title="YTD Revenue"
          value={`$${((metrics?.ytdDonations || 0) / 100).toLocaleString()}`}
          subtitle="All sources combined"
          href="/admin/finance/reports"
          icon={DollarSign}
          color="blue"
          trend={12}
        />
        <DrillDownCard
          title="Upcoming Events"
          value={metrics?.upcomingEvents}
          subtitle="Next 90 days"
          href="/admin/events"
          icon={Calendar}
          color="orange"
        />
        <DrillDownCard
          title="Volunteer Hours"
          value={Math.round(metrics?.volunteerHours || 0)}
          subtitle="Year to date"
          href="/admin/volunteers?tab=hours"
          icon={Clock}
          color="purple"
          trend={18}
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Membership Trend */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Membership Trend</h2>
            <Link href="/admin/members/reports" className="text-sm text-primary hover:underline">
              View Report →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics?.membershipTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="new" stroke="#10b981" strokeWidth={2} name="New" />
              <Line type="monotone" dataKey="renewed" stroke="#3b82f6" strokeWidth={2} name="Renewed" />
              <Line type="monotone" dataKey="lapsed" stroke="#ef4444" strokeWidth={2} name="Lapsed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Sources */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Revenue Sources</h2>
            <Link href="/admin/finance/dashboard" className="text-sm text-primary hover:underline">
              View Details →
            </Link>
          </div>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={metrics?.revenueSources}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                >
                  {metrics?.revenueSources.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {metrics?.revenueSources.map((source: any) => (
                <div key={source.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span className="text-gray-700">{source.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{source.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Add Member', href: '/admin/members/new', icon: Users },
          { label: 'Create Event', href: '/admin/events/new', icon: Calendar },
          { label: 'Record Donation', href: '/admin/donations/new', icon: DollarSign },
          { label: 'View Impact', href: '/admin/impact/dashboard', icon: Target },
        ].map(action => (
          <Link
            key={action.label}
            href={action.href}
            className="bg-white rounded-xl border p-4 flex items-center gap-3 hover:shadow-md hover:border-primary transition-all"
          >
            <action.icon className="w-5 h-5 text-primary" />
            <span className="font-medium text-gray-900">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
