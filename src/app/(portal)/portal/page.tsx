'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Building2, Calendar, Users, FileText, Award, TrendingUp, DollarSign,
  Download, MessageSquare, Star, CheckCircle, ArrowRight, Gift, Zap,
  BarChart2, Clock, ExternalLink, Settings, LogOut, Bell
} from 'lucide-react'

export default function MemberPortalPage() {
  const member = {
    name: 'Green Recycling Co',
    memberSince: '2019',
    plan: 'Business Premium',
    expiresAt: '2025-03-15',
    daysUntilRenewal: 92,
    primaryContact: 'John Smith',
  }

  // ROI Calculation
  const roi = {
    duesPaid: 500,
    valueReceived: 2850,
    roiMultiple: 5.7,
    breakdown: [
      { category: 'Event Discounts', value: 600, description: '2 conference registrations at member rate' },
      { category: 'Training Access', value: 400, description: '4 webinars attended ($100 value each)' },
      { category: 'Resources', value: 350, description: '12 premium downloads' },
      { category: 'Directory Listing', value: 500, description: 'Estimated lead value from 8 inquiries' },
      { category: 'Job Board', value: 500, description: '2 job postings ($250 each)' },
      { category: 'Networking', value: 500, description: 'Connection value estimate' },
    ]
  }

  const upcomingEvents = [
    { name: '2025 Illinois Circularity Conference', date: 'Oct 14-15, 2025', registered: true, location: 'East Peoria, IL' },
    { name: 'MRF Operations Webinar', date: 'Apr 8, 2025', registered: false, location: 'Virtual' },
    { name: 'Northern IL Networking', date: 'May 15, 2025', registered: false, location: 'Chicago, IL' },
  ]

  const recentActivity = [
    { action: 'Downloaded "2024 Recycling Guidelines"', date: '2 days ago', icon: Download },
    { action: 'Registered for Circularity Conference', date: '1 week ago', icon: Calendar },
    { action: 'Updated company profile', date: '2 weeks ago', icon: Building2 },
    { action: 'Posted in MRF Operations forum', date: '3 weeks ago', icon: MessageSquare },
  ]

  const benefits = [
    { name: 'Event Discounts', used: true, description: 'Save 30% on all events' },
    { name: 'Member Directory', used: true, description: 'Listed in public directory' },
    { name: 'Job Board', used: true, description: 'Post unlimited jobs' },
    { name: 'Resource Library', used: true, description: 'Access 50+ resources' },
    { name: 'Forum Access', used: true, description: 'Join community discussions' },
    { name: 'Advocacy Updates', used: false, description: 'Policy briefings and alerts' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl text-green-700">IRF</Link>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-900">Member Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-green-700">GR</span>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-xs text-gray-500">{member.primaryContact}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome & Renewal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back, {member.primaryContact}!</h1>
            <p className="text-gray-600 mt-1">Member since {member.memberSince} · {member.plan}</p>
          </div>
          <div className="flex items-center gap-4">
            {member.daysUntilRenewal <= 90 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">{member.daysUntilRenewal} days until renewal</span>
              </div>
            )}
            <Link href="/portal/renew" className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">
              Renew Now
            </Link>
          </div>
        </div>

        {/* ROI Card - THE KEY FEATURE */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Your Membership Value</span>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-green-200 text-sm">Annual Dues Paid</div>
              <div className="text-4xl font-bold">${roi.duesPaid}</div>
            </div>
            <div>
              <div className="text-green-200 text-sm">Value Received</div>
              <div className="text-4xl font-bold">${roi.valueReceived.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-green-200 text-sm">Return on Investment</div>
              <div className="text-4xl font-bold">{roi.roiMultiple}x</div>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Value Breakdown</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {roi.breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.category}</div>
                    <div className="text-sm text-green-200">{item.description}</div>
                  </div>
                  <div className="text-xl font-bold">${item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Building2, label: 'Edit Profile', href: '/portal/profile' },
                { icon: Calendar, label: 'Browse Events', href: '/events' },
                { icon: FileText, label: 'Resources', href: '/resources' },
                { icon: Users, label: 'Directory', href: '/directory' },
              ].map((action) => (
                <Link key={action.label} href={action.href}
                  className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow flex flex-col items-center text-center gap-2">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <action.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-900">{action.label}</span>
                </Link>
              ))}
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Upcoming Events</h2>
                <Link href="/events" className="text-sm text-green-600 hover:text-green-700">View All</Link>
              </div>
              <div className="divide-y">
                {upcomingEvents.map((event, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Calendar className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{event.name}</div>
                        <div className="text-sm text-gray-500">{event.date} · {event.location}</div>
                      </div>
                    </div>
                    {event.registered ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Registered
                      </span>
                    ) : (
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                        Register
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">Your Recent Activity</h2>
              </div>
              <div className="divide-y">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <activity.icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-900">{activity.action}</div>
                      <div className="text-sm text-gray-500">{activity.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Membership Benefits */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Your Benefits</h2>
              <div className="space-y-3">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      benefit.used ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <CheckCircle className={`w-3 h-3 ${benefit.used ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className={`font-medium ${benefit.used ? 'text-gray-900' : 'text-gray-500'}`}>{benefit.name}</div>
                      <div className="text-xs text-gray-500">{benefit.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement Score */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Your Engagement</h2>
              <div className="relative pt-4">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                      <circle cx="64" cy="64" r="56" stroke="#22c55e" strokeWidth="12" fill="none"
                        strokeDasharray={`${(78 / 100) * 352} 352`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">78</span>
                      <span className="text-sm text-gray-500">Score</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Engaged Member</span>
                  <p className="text-sm text-gray-500 mt-2">You're in the top 30% of active members!</p>
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Your Achievements</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: Award, label: '5 Year Member', color: 'yellow' },
                  { icon: Star, label: 'Conference Champion', color: 'purple' },
                  { icon: Zap, label: 'Active Contributor', color: 'blue' },
                ].map((badge, idx) => (
                  <div key={idx} className={`flex items-center gap-2 px-3 py-2 bg-${badge.color}-50 rounded-lg`}>
                    <badge.icon className={`w-4 h-4 text-${badge.color}-600`} />
                    <span className={`text-sm font-medium text-${badge.color}-800`}>{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
