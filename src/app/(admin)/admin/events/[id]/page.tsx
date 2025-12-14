'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Calendar, Users, MapPin, DollarSign, Settings, ArrowLeft,
  Plus, Edit, Trash2, CheckCircle, Clock, Mail, Download,
  BarChart2, Mic, Building2, FileText, Eye, Search
} from 'lucide-react'

type Tab = 'overview' | 'sessions' | 'registrations' | 'speakers' | 'sponsors' | 'check-in' | 'emails'

export default function EventDetailPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>('overview')
  
  const event = {
    name: '2025 Illinois Circularity Conference',
    tagline: 'Building Tomorrow\'s Circular Economy Today',
    start_date: '2025-10-14',
    end_date: '2025-10-15',
    location: 'Par-A-Dice Hotel & Casino',
    address: 'East Peoria, IL',
    status: 'published',
    capacity: 300,
    registered: 156,
    revenue: 23400,
    tracks: ['Policy & Legislation', 'Operations & Technology', 'Markets & Economics', 'Education & Outreach'],
  }

  const stats = [
    { label: 'Registered', value: event.registered, max: event.capacity, icon: Users, color: 'blue' },
    { label: 'Revenue', value: `$${event.revenue.toLocaleString()}`, icon: DollarSign, color: 'green' },
    { label: 'Sessions', value: 24, icon: Calendar, color: 'purple' },
    { label: 'Speakers', value: 32, icon: Mic, color: 'orange' },
    { label: 'Sponsors', value: 12, icon: Building2, color: 'pink' },
  ]

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'sessions', label: 'Sessions', icon: Calendar, count: 24 },
    { id: 'registrations', label: 'Registrations', icon: Users, count: 156 },
    { id: 'speakers', label: 'Speakers', icon: Mic, count: 32 },
    { id: 'sponsors', label: 'Sponsors', icon: Building2, count: 12 },
    { id: 'check-in', label: 'Check-In', icon: CheckCircle },
    { id: 'emails', label: 'Emails', icon: Mail },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {event.status}
            </span>
          </div>
          <p className="text-gray-600 mt-1">{event.tagline}</p>
          <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />Oct 14-15, 2025</span>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Registration
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                {stat.max && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${((stat.value as number) / stat.max) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{Math.round(((stat.value as number) / stat.max) * 100)}% capacity</p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <stat.icon className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
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
      {activeTab === 'overview' && <OverviewTab event={event} />}
      {activeTab === 'sessions' && <SessionsTab event={event} />}
      {activeTab === 'registrations' && <RegistrationsTab />}
      {activeTab === 'speakers' && <SpeakersTab />}
      {activeTab === 'sponsors' && <SponsorsTab />}
      {activeTab === 'check-in' && <CheckInTab />}
      {activeTab === 'emails' && <EmailsTab />}
    </div>
  )
}

function OverviewTab({ event }: { event: any }) {
  const timeline = [
    { date: 'Jun 1', label: 'Registration Opens', status: 'completed' },
    { date: 'Aug 31', label: 'Early Bird Deadline', status: 'upcoming' },
    { date: 'Oct 10', label: 'Registration Closes', status: 'upcoming' },
    { date: 'Oct 14-15', label: 'Conference Days', status: 'upcoming' },
  ]

  const recentRegs = [
    { name: 'Green Recycling Co', contact: 'John Smith', amount: 350, time: '2 hours ago' },
    { name: 'City of Springfield', contact: 'Jane Doe', amount: 250, time: '5 hours ago' },
    { name: 'EcoMaterials LLC', contact: 'Bob Wilson', amount: 350, time: '1 day ago' },
  ]

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        {/* Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Registration Trend</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-12 h-12 text-gray-300" />
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Registrations</h3>
            <button className="text-sm text-blue-600">View All</button>
          </div>
          <div className="divide-y">
            {recentRegs.map((reg, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{reg.name}</div>
                    <div className="text-sm text-gray-500">{reg.contact}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">${reg.amount}</div>
                  <div className="text-sm text-gray-500">{reg.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Timeline */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Event Timeline</h3>
          <div className="space-y-4">
            {timeline.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${item.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.date}</div>
                </div>
                {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { icon: Mail, label: 'Email all registrants' },
              { icon: Download, label: 'Export registration list' },
              { icon: FileText, label: 'Generate name badges' },
            ].map((action, idx) => (
              <button key={idx} className="w-full flex items-center gap-3 p-3 text-left text-sm hover:bg-gray-50 rounded-lg">
                <action.icon className="w-4 h-4 text-gray-400" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionsTab({ event }: { event: any }) {
  const [selectedDay, setSelectedDay] = React.useState(0)
  const days = ['Day 1 - Tuesday', 'Day 2 - Wednesday']
  
  const sessions = [
    { time: '8:00 AM', title: 'Registration & Breakfast', type: 'break', room: 'Lobby' },
    { time: '9:00 AM', title: 'Opening Keynote: The Future of Circular Economy', type: 'keynote', room: 'Grand Ballroom', speaker: 'Dr. Sarah Chen' },
    { time: '10:15 AM', title: 'Extended Producer Responsibility: Illinois Update', type: 'session', room: 'Room A', track: 'Policy', speaker: 'Mike Johnson' },
    { time: '10:15 AM', title: 'MRF Optimization Strategies', type: 'session', room: 'Room B', track: 'Operations', speaker: 'Lisa Park' },
    { time: '11:30 AM', title: 'Community Recycling Education', type: 'session', room: 'Room A', track: 'Education', speaker: 'Jane Smith' },
    { time: '12:30 PM', title: 'Networking Lunch', type: 'meal', room: 'Grand Ballroom' },
  ]

  const trackColors: Record<string, string> = {
    'Policy': 'bg-blue-100 text-blue-800',
    'Operations': 'bg-green-100 text-green-800',
    'Markets': 'bg-purple-100 text-purple-800',
    'Education': 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDay(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedDay === idx ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
            >
              {day}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Session
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Speaker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Track</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sessions.map((session, idx) => (
              <tr key={idx} className={`hover:bg-gray-50 ${session.type === 'break' || session.type === 'meal' ? 'bg-gray-50' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{session.time}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{session.title}</div>
                  <div className="text-xs text-gray-500 capitalize">{session.type}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{session.speaker || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{session.room}</td>
                <td className="px-4 py-3">
                  {session.track ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${trackColors[session.track] || 'bg-gray-100'}`}>
                      {session.track}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RegistrationsTab() {
  const registrations = [
    { org: 'Green Recycling Co', contact: 'John Smith', email: 'john@greenrecycling.com', type: 'Business', amount: 350, status: 'confirmed', sessions: 8 },
    { org: 'City of Springfield', contact: 'Jane Doe', email: 'jdoe@springfield.gov', type: 'Municipality', amount: 250, status: 'confirmed', sessions: 6 },
    { org: 'EcoMaterials LLC', contact: 'Bob Wilson', email: 'bob@ecomaterials.com', type: 'Business', amount: 350, status: 'pending', sessions: 0 },
    { org: 'IEPA', contact: 'Mike Johnson', email: 'mjohnson@illinois.gov', type: 'Government', amount: 0, status: 'confirmed', sessions: 12 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search registrations..." className="pl-10 pr-4 py-2 border rounded-lg w-64" />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Registration
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left"><input type="checkbox" className="rounded" /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {registrations.map((reg, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                <td className="px-4 py-3 font-medium text-gray-900">{reg.org}</td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{reg.contact}</div>
                  <div className="text-xs text-gray-500">{reg.email}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{reg.type}</td>
                <td className="px-4 py-3 font-medium">{reg.amount > 0 ? `$${reg.amount}` : 'Comp'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    reg.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {reg.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-1 hover:bg-gray-100 rounded"><Mail className="w-4 h-4 text-gray-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SpeakersTab() {
  const speakers = [
    { name: 'Dr. Sarah Chen', title: 'Director of Sustainability', company: 'CircularTech', sessions: 1, status: 'confirmed' },
    { name: 'Mike Johnson', title: 'Policy Director', company: 'IEPA', sessions: 2, status: 'confirmed' },
    { name: 'Lisa Park', title: 'VP Operations', company: 'Green Recycling Co', sessions: 1, status: 'pending' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search speakers..." className="pl-10 pr-4 py-2 border rounded-lg w-64" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Speaker
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {speakers.map((speaker, idx) => (
          <div key={idx} className="bg-white rounded-xl border p-4 flex items-start gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <Mic className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{speaker.name}</h3>
                  <p className="text-sm text-gray-600">{speaker.title}</p>
                  <p className="text-sm text-gray-500">{speaker.company}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  speaker.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {speaker.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-gray-500">{speaker.sessions} session(s)</span>
                <button className="text-blue-600 hover:text-blue-700">Edit</button>
                <button className="text-blue-600 hover:text-blue-700">Email</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SponsorsTab() {
  const levels = [
    { level: 'Platinum', price: 5000, sponsors: 2, max: 3 },
    { level: 'Gold', price: 3000, sponsors: 4, max: 5 },
    { level: 'Silver', price: 1500, sponsors: 4, max: 10 },
  ]

  const sponsors = [
    { name: 'Republic Services', level: 'Platinum', paid: true },
    { name: 'Waste Management', level: 'Platinum', paid: true },
    { name: 'GFL Environmental', level: 'Gold', paid: true },
    { name: 'Groot Industries', level: 'Gold', paid: false },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Sponsorship Levels</h3>
        <div className="grid grid-cols-3 gap-4">
          {levels.map((l) => (
            <div key={l.level} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{l.level}</h4>
                <span className="text-lg font-bold text-green-600">${l.price.toLocaleString()}</span>
              </div>
              <div className="text-sm text-gray-500">{l.sponsors} / {l.max} sold</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Current Sponsors</h3>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Sponsor
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sponsor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sponsors.map((s, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    s.level === 'Platinum' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>{s.level}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 text-sm ${s.paid ? 'text-green-600' : 'text-yellow-600'}`}>
                    {s.paid ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    {s.paid ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-sm text-blue-600">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CheckInTab() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const attendees = [
    { name: 'John Smith', org: 'Green Recycling Co', checkedIn: true, time: '8:45 AM' },
    { name: 'Jane Doe', org: 'City of Springfield', checkedIn: true, time: '8:52 AM' },
    { name: 'Bob Wilson', org: 'EcoMaterials LLC', checkedIn: false, time: null },
  ]
  const checkedIn = attendees.filter(a => a.checkedIn).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-green-600">{checkedIn}</div>
          <div className="text-gray-500 mt-1">Checked In</div>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-gray-400">{attendees.length - checkedIn}</div>
          <div className="text-gray-500 mt-1">Not Checked In</div>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-blue-600">{Math.round((checkedIn / attendees.length) * 100)}%</div>
          <div className="text-gray-500 mt-1">Attendance Rate</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name to check in..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 border-2 rounded-xl text-lg focus:border-blue-500"
          autoFocus
        />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {attendees.map((a, idx) => (
              <tr key={idx} className={a.checkedIn ? 'bg-green-50' : 'hover:bg-gray-50'}>
                <td className="px-6 py-4 font-medium">{a.name}</td>
                <td className="px-6 py-4 text-gray-600">{a.org}</td>
                <td className="px-6 py-4">
                  {a.checkedIn ? (
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4" />Checked in at {a.time}</span>
                  ) : (
                    <span className="text-gray-400">Not checked in</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {!a.checkedIn && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Check In</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmailsTab() {
  const emails = [
    { name: 'Registration Confirmation', type: 'automated', sent: 156, opened: 142, status: 'active' },
    { name: 'Session Selection Reminder', type: 'automated', sent: 89, opened: 67, status: 'active' },
    { name: 'Pre-Event Logistics', type: 'manual', sent: 0, opened: 0, status: 'scheduled' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Event Emails</h3>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Create Email
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {emails.map((email, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{email.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${email.type === 'automated' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>
                    {email.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{email.sent}</td>
                <td className="px-4 py-3 text-gray-600">{email.sent > 0 ? `${email.opened} (${Math.round((email.opened / email.sent) * 100)}%)` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    email.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>{email.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-sm text-blue-600">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
