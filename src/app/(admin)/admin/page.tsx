'use client'

import * as React from 'react'
import Link from 'next/link'
import { 
  Plus, Users, Calendar, DollarSign, Mail, FileText, 
  Sparkles, Zap, ArrowRight, TrendingUp, Activity,
  Award, Heart, Briefcase, BookOpen
} from 'lucide-react'
import RealTimeDashboard from '@/components/dashboard/RealTimeDashboard'
import NaturalLanguageQuery from '@/components/dashboard/NaturalLanguageQuery'

export default function AdminDashboard() {
  const quickActions = [
    { label: 'Add Member', href: '/admin/members/new', icon: Users, color: 'blue' },
    { label: 'Create Event', href: '/admin/events/new', icon: Calendar, color: 'purple' },
    { label: 'Send Email', href: '/admin/email/compose', icon: Mail, color: 'green' },
    { label: 'New Donation', href: '/admin/donations/new', icon: Heart, color: 'pink' },
  ]

  const features = [
    { 
      title: 'Automation Recipes', 
      description: '1-click automations that save 10+ hours/week',
      href: '/admin/automations/recipes',
      icon: Zap,
      badge: 'New',
      color: 'from-orange-500 to-red-500'
    },
    { 
      title: 'AI Insights', 
      description: 'Predictive churn analysis and recommendations',
      href: '/admin/members?view=ai-insights',
      icon: Sparkles,
      badge: 'AI',
      color: 'from-purple-500 to-indigo-500'
    },
    { 
      title: 'Board Reports', 
      description: 'Auto-generated board packets with AI summaries',
      href: '/admin/reports/board',
      icon: FileText,
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      title: 'CEU Tracking', 
      description: 'Automatic certificate generation',
      href: '/admin/events?tab=ceu',
      icon: Award,
      color: 'from-green-500 to-emerald-500'
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          {quickActions.map(action => (
            <Link
              key={action.label}
              href={action.href}
              className={`flex items-center gap-2 px-4 py-2 bg-${action.color}-600 text-white rounded-lg hover:bg-${action.color}-700`}
            >
              <Plus className="w-4 h-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Real-Time Stats */}
      <div className="mb-8">
        <RealTimeDashboard />
      </div>

      {/* AI Query */}
      <div className="mb-8">
        <NaturalLanguageQuery />
      </div>

      {/* Feature Highlights */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Powerful Features</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {features.map(feature => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                {feature.badge && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-medium">
                    {feature.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">{feature.description}</p>
              <span className="text-sm text-blue-600 group-hover:underline flex items-center gap-1">
                Explore <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Members */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Members</h3>
            <Link href="/admin/members" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {/* Placeholder - would be real data */}
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">New Member {i}</p>
                  <p className="text-sm text-gray-500">Joined today</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Upcoming Events</h3>
            <Link href="/admin/events" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Event {i}</p>
                  <p className="text-sm text-gray-500">Next week • 25 registered</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
