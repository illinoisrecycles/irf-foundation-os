'use client'

import * as React from 'react'
import { BarChart2, TrendingUp, Users, DollarSign, Calendar, Download, FileText, PieChart } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">View insights and generate reports</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Data
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Members', value: '284', change: '+12%', icon: Users, color: 'blue' },
          { label: 'Revenue YTD', value: '$48,250', change: '+8%', icon: DollarSign, color: 'green' },
          { label: 'Event Attendance', value: '892', change: '+24%', icon: Calendar, color: 'purple' },
          { label: 'Engagement Rate', value: '42%', change: '+5%', icon: TrendingUp, color: 'orange' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-green-600">{stat.change} vs last year</p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-3 gap-6">
        {/* Membership Reports */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold">Membership Reports</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              'Member Growth Report',
              'Retention Analysis',
              'Membership by Type',
              'Geographic Distribution',
              'Expiring Memberships',
            ].map((report) => (
              <button key={report} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-sm flex items-center justify-between">
                <span>{report}</span>
                <FileText className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Financial Reports */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold">Financial Reports</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              'Revenue Summary',
              'Dues Collection',
              'Donation Analysis',
              'Event Revenue',
              'Outstanding Invoices',
            ].map((report) => (
              <button key={report} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-sm flex items-center justify-between">
                <span>{report}</span>
                <FileText className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Engagement Reports */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold">Engagement Reports</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              'Event Attendance',
              'Email Performance',
              'Website Analytics',
              'Resource Downloads',
              'Forum Activity',
            ].map((report) => (
              <button key={report} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-sm flex items-center justify-between">
                <span>{report}</span>
                <FileText className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-4">Membership Growth</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-12 h-12 text-gray-300" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-4">Revenue by Category</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <PieChart className="w-12 h-12 text-gray-300" />
          </div>
        </div>
      </div>
    </div>
  )
}
