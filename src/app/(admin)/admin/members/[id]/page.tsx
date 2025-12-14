'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Building2, ArrowLeft, Mail, Phone, Globe, MapPin, Calendar, Users,
  DollarSign, TrendingUp, TrendingDown, Star, Award, Clock, CheckCircle,
  AlertCircle, Edit, Trash2, Plus, FileText, MessageSquare, CreditCard,
  BarChart2, Activity, Target, Zap, Send, Download, ExternalLink
} from 'lucide-react'

export default function MemberDetailPage() {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'contacts' | 'activity' | 'invoices' | 'communications'>('overview')
  
  const member = {
    id: '1',
    name: 'Green Recycling Co',
    legal_name: 'Green Recycling Company, LLC',
    org_type: 'business',
    industry: 'MRF Operator',
    website: 'https://greenrecycling.com',
    phone: '(312) 555-0100',
    email: 'info@greenrecycling.com',
    address: '123 Industrial Blvd, Chicago, IL 60601',
    member_since: '2019-03-15',
    membership_status: 'active',
    membership_plan: 'Business Premium',
    membership_expires: '2025-03-15',
    logo_url: null,
    employee_count: '51-200',
    annual_revenue: '$10M-$50M',
    service_area: 'Regional (IL, IN, WI)',
    description: 'Green Recycling Co operates three materials recovery facilities across the Chicago metropolitan area, processing over 500,000 tons of recyclables annually.',
  }

  const engagement = {
    score: 78,
    tier: 'engaged',
    trend: 'up',
    change: 12,
    last_activity: '2 days ago',
    events_attended_ytd: 4,
    resources_downloaded_ytd: 12,
    emails_opened_rate: 68,
    forum_posts_ytd: 3,
    renewal_likelihood: 92,
  }

  const milestones = [
    { icon: Award, label: '5 Year Member', achieved: '2024-03-15', color: 'yellow' },
    { icon: Star, label: 'Conference Champion', achieved: '2024-10-15', color: 'purple' },
    { icon: Users, label: 'Active Contributor', achieved: '2024-06-01', color: 'blue' },
  ]

  const contacts = [
    { id: 1, name: 'John Smith', title: 'Director of Operations', email: 'jsmith@greenrecycling.com', phone: '(312) 555-0101', is_primary: true, is_billing: true },
    { id: 2, name: 'Sarah Johnson', title: 'Sustainability Manager', email: 'sjohnson@greenrecycling.com', phone: '(312) 555-0102', is_primary: false, is_billing: false },
    { id: 3, name: 'Mike Chen', title: 'CFO', email: 'mchen@greenrecycling.com', phone: '(312) 555-0103', is_primary: false, is_billing: true },
  ]

  const recentActivity = [
    { type: 'event', description: 'Registered for 2025 Illinois Circularity Conference', date: '2 days ago', icon: Calendar },
    { type: 'resource', description: 'Downloaded "2024 Recycling Guidelines"', date: '1 week ago', icon: FileText },
    { type: 'email', description: 'Opened March Newsletter', date: '2 weeks ago', icon: Mail },
    { type: 'forum', description: 'Posted in "MRF Operations" forum', date: '3 weeks ago', icon: MessageSquare },
    { type: 'payment', description: 'Membership renewal payment received', date: '1 month ago', icon: CreditCard },
  ]

  const invoices = [
    { id: 'INV-2024-001', date: '2024-03-15', description: 'Annual Membership - Business Premium', amount: 500, status: 'paid' },
    { id: 'INV-2024-015', date: '2024-10-01', description: 'Conference Registration (2 attendees)', amount: 700, status: 'paid' },
    { id: 'INV-2025-001', date: '2025-02-15', description: 'Annual Membership - Business Premium', amount: 500, status: 'pending' },
  ]

  const tierConfig: Record<string, { color: string; label: string; description: string }> = {
    champion: { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Champion', description: 'Highly engaged, top 10% of members' },
    engaged: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Engaged', description: 'Actively participating' },
    passive: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Passive', description: 'Moderate engagement' },
    at_risk: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'At Risk', description: 'Declining engagement' },
    dormant: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Dormant', description: 'No recent activity' },
  }

  const tier = tierConfig[engagement.tier] || tierConfig.passive

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/members" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Members
          </Link>
          <div className="flex items-center gap-4">
            {member.logo_url ? (
              <img src={member.logo_url} alt={member.name} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-green-600" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-600">{member.industry}</span>
                <span className="text-gray-300">•</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Mail className="w-4 h-4" /> Email
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Edit className="w-4 h-4" /> Edit
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <CreditCard className="w-4 h-4" /> Process Renewal
          </button>
        </div>
      </div>

      {/* Engagement Score Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Score Circle */}
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke="white" 
                  strokeWidth="12" 
                  fill="none"
                  strokeDasharray={`${(engagement.score / 100) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{engagement.score}</span>
                <span className="text-sm text-blue-200">Engagement</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${tier.color}`}>
                    {tier.label}
                  </span>
                  <span className={`flex items-center gap-1 text-sm ${engagement.trend === 'up' ? 'text-green-300' : 'text-red-300'}`}>
                    {engagement.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {engagement.change}% vs last quarter
                  </span>
                </div>
                <p className="text-blue-200 text-sm mt-1">{tier.description}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <Activity className="w-4 h-4" />
                Last activity: {engagement.last_activity}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            <div>
              <div className="text-2xl font-bold">{engagement.events_attended_ytd}</div>
              <div className="text-blue-200 text-sm">Events YTD</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{engagement.resources_downloaded_ytd}</div>
              <div className="text-blue-200 text-sm">Downloads YTD</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{engagement.emails_opened_rate}%</div>
              <div className="text-blue-200 text-sm">Email Open Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-300">{engagement.renewal_likelihood}%</div>
              <div className="text-blue-200 text-sm">Renewal Likelihood</div>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="flex items-center gap-4 mt-6 pt-6 border-t border-blue-500">
          <span className="text-blue-200 text-sm">Achievements:</span>
          {milestones.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <m.icon className="w-4 h-4" />
              <span className="text-sm">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'contacts', label: 'Contacts', count: contacts.length },
            { id: 'activity', label: 'Activity' },
            { id: 'invoices', label: 'Invoices', count: invoices.length },
            { id: 'communications', label: 'Communications' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Organization Details */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Organization Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Legal Name</label>
                    <p className="text-gray-900">{member.legal_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Industry</label>
                    <p className="text-gray-900">{member.industry}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Employee Count</label>
                    <p className="text-gray-900">{member.employee_count}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Service Area</label>
                    <p className="text-gray-900">{member.service_area}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Annual Revenue</label>
                    <p className="text-gray-900">{member.annual_revenue}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Website</label>
                    <a href={member.website} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      {member.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
                <p className="text-gray-700 mt-1">{member.description}</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                <button className="text-sm text-blue-600">View All</button>
              </div>
              <div className="divide-y">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <activity.icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${member.email}`} className="text-blue-600 hover:text-blue-700">{member.email}</a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{member.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{member.address}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a href={member.website} className="text-blue-600 hover:text-blue-700">Website</a>
                </div>
              </div>
            </div>

            {/* Membership Info */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Membership</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium">{member.membership_plan}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Member Since</span>
                  <span className="font-medium">{new Date(member.member_since).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Expires</span>
                  <span className="font-medium">{new Date(member.membership_expires).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Process Renewal
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 p-2 text-left text-sm hover:bg-gray-50 rounded-lg">
                  <Send className="w-4 h-4 text-gray-400" /> Send Email
                </button>
                <button className="w-full flex items-center gap-3 p-2 text-left text-sm hover:bg-gray-50 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400" /> Create Invoice
                </button>
                <button className="w-full flex items-center gap-3 p-2 text-left text-sm hover:bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-400" /> Add to Event
                </button>
                <button className="w-full flex items-center gap-3 p-2 text-left text-sm hover:bg-gray-50 rounded-lg">
                  <Download className="w-4 h-4 text-gray-400" /> Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Organization Contacts</h3>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-lg font-medium">
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{contact.name}</h4>
                      <p className="text-sm text-gray-600">{contact.title}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {contact.is_primary && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Primary</span>
                    )}
                    {contact.is_billing && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">Billing</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${contact.email}`} className="hover:text-blue-600">{contact.email}</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{contact.phone}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center gap-2">
                  <button className="text-sm text-blue-600 hover:text-blue-700">Edit</button>
                  <span className="text-gray-300">•</span>
                  <button className="text-sm text-blue-600 hover:text-blue-700">Email</button>
                  <span className="text-gray-300">•</span>
                  <button className="text-sm text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Invoices & Payments</h3>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          </div>
          
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{invoice.id}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-900">{invoice.description}</td>
                    <td className="px-4 py-3 font-medium">${invoice.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-sm text-blue-600 hover:text-blue-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
