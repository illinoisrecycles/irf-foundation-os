'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Send, Users, FileText, Plus, BarChart2, Clock, CheckCircle, AlertCircle, Eye, Edit, Trash2, Copy } from 'lucide-react'

export default function EmailPage() {
  const [activeTab, setActiveTab] = React.useState<'campaigns' | 'templates' | 'lists' | 'automations'>('campaigns')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
          <p className="text-gray-600 mt-1">Create and manage email campaigns</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Subscribers', value: '2,847', icon: Users, color: 'blue' },
          { label: 'Campaigns Sent', value: '34', icon: Send, color: 'green' },
          { label: 'Avg Open Rate', value: '42.3%', icon: Mail, color: 'purple' },
          { label: 'Avg Click Rate', value: '8.7%', icon: BarChart2, color: 'orange' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'campaigns', label: 'Campaigns', icon: Send },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'lists', label: 'Lists', icon: Users },
            { id: 'automations', label: 'Automations', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'lists' && <ListsTab />}
      {activeTab === 'automations' && <AutomationsTab />}
    </div>
  )
}

function CampaignsTab() {
  const campaigns = [
    { id: '1', name: 'March Newsletter', status: 'sent', sentAt: '2024-03-15', recipients: 2500, opened: 1050, clicked: 218 },
    { id: '2', name: 'Conference Early Bird', status: 'sent', sentAt: '2024-03-10', recipients: 2800, opened: 1400, clicked: 420 },
    { id: '3', name: 'Membership Renewal Reminder', status: 'scheduled', scheduledAt: '2024-03-20', recipients: 450 },
    { id: '4', name: 'April Newsletter Draft', status: 'draft', recipients: 0 },
  ]

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{campaign.name}</div>
                {campaign.sentAt && <div className="text-sm text-gray-500">Sent {campaign.sentAt}</div>}
                {campaign.scheduledAt && <div className="text-sm text-gray-500">Scheduled for {campaign.scheduledAt}</div>}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  campaign.status === 'sent' ? 'bg-green-100 text-green-800' :
                  campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {campaign.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                  {campaign.status === 'scheduled' && <Clock className="w-3 h-3" />}
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {campaign.recipients.toLocaleString()}
              </td>
              <td className="px-6 py-4">
                {campaign.opened ? (
                  <div className="text-sm">
                    <div>Opens: {campaign.opened} ({((campaign.opened / campaign.recipients) * 100).toFixed(1)}%)</div>
                    <div className="text-gray-500">Clicks: {campaign.clicked} ({((campaign.clicked / campaign.recipients) * 100).toFixed(1)}%)</div>
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="p-2 hover:bg-gray-100 rounded" title="View"><Eye className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-2 hover:bg-gray-100 rounded" title="Edit"><Edit className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-2 hover:bg-gray-100 rounded" title="Duplicate"><Copy className="w-4 h-4 text-gray-400" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TemplatesTab() {
  const templates = [
    { id: '1', name: 'Monthly Newsletter', category: 'newsletter', lastUsed: '2024-03-15' },
    { id: '2', name: 'Event Announcement', category: 'announcement', lastUsed: '2024-03-10' },
    { id: '3', name: 'Membership Welcome', category: 'welcome', lastUsed: '2024-03-08' },
    { id: '4', name: 'Renewal Reminder', category: 'reminder', lastUsed: '2024-03-01' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {templates.map((template) => (
        <div key={template.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
            <FileText className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="font-medium text-gray-900">{template.name}</h3>
          <p className="text-sm text-gray-500 capitalize">{template.category}</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-xs text-gray-400">Last used: {template.lastUsed}</span>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
              <button className="p-1 hover:bg-gray-100 rounded"><Copy className="w-4 h-4 text-gray-400" /></button>
            </div>
          </div>
        </div>
      ))}
      <button className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2">
        <Plus className="w-8 h-8 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">Create Template</span>
      </button>
    </div>
  )
}

function ListsTab() {
  const lists = [
    { id: '1', name: 'All Members', type: 'dynamic', subscribers: 2847, description: 'All active member contacts' },
    { id: '2', name: 'Newsletter Subscribers', type: 'manual', subscribers: 3250, description: 'Opted-in newsletter recipients' },
    { id: '3', name: 'Conference Attendees 2024', type: 'manual', subscribers: 420, description: 'Registered for 2024 conference' },
    { id: '4', name: 'Expiring Memberships', type: 'dynamic', subscribers: 156, description: 'Members expiring in 30 days' },
  ]

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">List Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscribers</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lists.map((list) => (
            <tr key={list.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{list.name}</div>
                <div className="text-sm text-gray-500">{list.description}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  list.type === 'dynamic' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {list.type}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600">{list.subscribers.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">
                <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AutomationsTab() {
  const automations = [
    { id: '1', name: 'Welcome Series', trigger: 'New member joins', emails: 3, status: 'active' },
    { id: '2', name: 'Renewal Reminders', trigger: 'Membership expiring', emails: 2, status: 'active' },
    { id: '3', name: 'Event Follow-up', trigger: 'Event attendance', emails: 1, status: 'paused' },
  ]

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Automation</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emails</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {automations.map((auto) => (
            <tr key={auto.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{auto.name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{auto.trigger}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{auto.emails} email{auto.emails > 1 ? 's' : ''}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  auto.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {auto.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
