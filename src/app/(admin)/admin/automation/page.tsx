'use client'

import * as React from 'react'
import {
  Zap, Plus, Play, Pause, Trash2, ChevronRight, Mail, Bell,
  UserPlus, DollarSign, Calendar, Settings, Clock, CheckCircle
} from 'lucide-react'

type AutomationRule = {
  id: string
  name: string
  description: string
  trigger: { type: string; conditions: Record<string, any> }
  actions: { type: string; config: Record<string, any> }[]
  isActive: boolean
  runCount: number
  lastRun?: string
}

export default function AutomationPage() {
  const [rules, setRules] = React.useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Welcome New Members',
      description: 'Send welcome email when a new member joins',
      trigger: { type: 'member.created', conditions: {} },
      actions: [
        { type: 'send_email', config: { template: 'welcome', subject: 'Welcome to IRF!' } },
        { type: 'create_work_item', config: { title: 'Follow up with new member', due_days: 7 } },
      ],
      isActive: true,
      runCount: 45,
      lastRun: '2024-01-19T14:30:00',
    },
    {
      id: '2',
      name: 'Large Donation Alert',
      description: 'Notify staff when donation exceeds $1,000',
      trigger: { type: 'donation.created', conditions: { amount_cents: { gte: 100000 } } },
      actions: [
        { type: 'slack_notify', config: { message: 'New large donation received!' } },
        { type: 'send_email', config: { to: 'director@irf.org', subject: 'Large Donation Received' } },
      ],
      isActive: true,
      runCount: 12,
      lastRun: '2024-01-15T09:00:00',
    },
    {
      id: '3',
      name: 'Renewal Reminder - 30 Days',
      description: 'Send reminder 30 days before expiration',
      trigger: { type: 'daily_check', conditions: { days_until_expiry: 30 } },
      actions: [
        { type: 'send_email', config: { template: 'renewal_reminder' } },
      ],
      isActive: true,
      runCount: 156,
      lastRun: '2024-01-20T08:00:00',
    },
    {
      id: '4',
      name: 'Event Registration Thank You',
      description: 'Send confirmation after event registration',
      trigger: { type: 'event.registration.created', conditions: {} },
      actions: [
        { type: 'send_email', config: { template: 'event_confirmation' } },
        { type: 'update_engagement', config: { points: 5 } },
      ],
      isActive: false,
      runCount: 0,
    },
  ])

  const [showBuilder, setShowBuilder] = React.useState(false)

  const triggerTypes = [
    { value: 'member.created', label: 'Member Joins', icon: UserPlus },
    { value: 'member.updated', label: 'Member Updated', icon: Settings },
    { value: 'donation.created', label: 'Donation Received', icon: DollarSign },
    { value: 'payment.failed', label: 'Payment Failed', icon: DollarSign },
    { value: 'event.registration.created', label: 'Event Registration', icon: Calendar },
    { value: 'daily_check', label: 'Daily Check', icon: Clock },
  ]

  const actionTypes = [
    { value: 'send_email', label: 'Send Email', icon: Mail },
    { value: 'slack_notify', label: 'Slack Notification', icon: Bell },
    { value: 'create_work_item', label: 'Create Task', icon: CheckCircle },
    { value: 'update_engagement', label: 'Update Engagement', icon: Zap },
    { value: 'trigger_webhook', label: 'Trigger Webhook', icon: Zap },
  ]

  const getTriggerIcon = (type: string) => {
    const trigger = triggerTypes.find(t => t.value === type)
    return trigger?.icon || Zap
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automation</h1>
          <p className="text-gray-600 mt-1">Create rules to automate workflows and notifications</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <div className="text-3xl font-bold text-gray-900">{rules.length}</div>
          <div className="text-sm text-gray-500">Total Rules</div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="text-3xl font-bold text-green-600">{rules.filter(r => r.isActive).length}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="text-3xl font-bold text-gray-900">{rules.reduce((sum, r) => sum + r.runCount, 0)}</div>
          <div className="text-sm text-gray-500">Total Runs</div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="text-3xl font-bold text-blue-600">4</div>
          <div className="text-sm text-gray-500">Triggered Today</div>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Automation Rules</h2>
        </div>
        <div className="divide-y">
          {rules.map(rule => {
            const TriggerIcon = getTriggerIcon(rule.trigger.type)
            return (
              <div key={rule.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${rule.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Zap className={`w-6 h-6 ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                      
                      {/* Trigger & Actions Summary */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <TriggerIcon className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-600 font-medium">
                            {triggerTypes.find(t => t.value === rule.trigger.type)?.label}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        <div className="flex items-center gap-2">
                          {rule.actions.map((action, idx) => {
                            const ActionIcon = actionTypes.find(a => a.value === action.type)?.icon || Zap
                            return (
                              <div key={idx} className="flex items-center gap-1 text-sm text-gray-600">
                                <ActionIcon className="w-4 h-4" />
                                <span>{actionTypes.find(a => a.value === action.type)?.label}</span>
                                {idx < rule.actions.length - 1 && <span className="mx-1">+</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                        <span>Ran {rule.runCount} times</span>
                        {rule.lastRun && (
                          <span>Last: {new Date(rule.lastRun).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <Settings className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setRules(rules.map(r =>
                        r.id === rule.id ? { ...r, isActive: !r.isActive } : r
                      ))}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      {rule.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Templates */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Start Templates</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: 'Membership Renewal Flow', description: 'Automated reminders at 60, 30, and 7 days before expiration', icon: UserPlus },
            { name: 'Donation Thank You', description: 'Send personalized thank you based on donation amount', icon: DollarSign },
            { name: 'Event Follow-up', description: 'Survey and thank you after event attendance', icon: Calendar },
          ].map((template, idx) => (
            <button
              key={idx}
              className="bg-white rounded-xl border p-6 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <template.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
              </div>
              <p className="text-sm text-gray-500">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
