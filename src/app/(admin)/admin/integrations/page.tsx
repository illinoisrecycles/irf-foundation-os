'use client'

import * as React from 'react'
import {
  Video, FileSpreadsheet, Webhook, Zap, Check, X, ExternalLink,
  Plus, Trash2, Settings, RefreshCw, AlertCircle
} from 'lucide-react'

type Integration = {
  id: string
  name: string
  icon: any
  description: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
}

type WebhookConfig = {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggered?: string
  failureCount: number
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = React.useState<'apps' | 'webhooks'>('apps')
  const [showWebhookModal, setShowWebhookModal] = React.useState(false)

  const integrations: Integration[] = [
    { id: 'zoom', name: 'Zoom', icon: Video, description: 'Virtual meetings and webinars for events', status: 'connected', lastSync: '2024-01-20T10:30:00' },
    { id: 'quickbooks', name: 'QuickBooks Online', icon: FileSpreadsheet, description: 'Sync invoices and payments', status: 'disconnected' },
    { id: 'zapier', name: 'Zapier', icon: Zap, description: 'Connect to 5,000+ apps via webhooks', status: 'connected' },
  ]

  const [webhooks, setWebhooks] = React.useState<WebhookConfig[]>([
    { id: '1', name: 'Zapier - New Member', url: 'https://hooks.zapier.com/hooks/catch/123/abc', events: ['member.created'], isActive: true, lastTriggered: '2024-01-19T14:00:00', failureCount: 0 },
    { id: '2', name: 'Slack Notifications', url: 'https://hooks.slack.com/services/xxx', events: ['donation.created', 'member.expired'], isActive: true, failureCount: 0 },
    { id: '3', name: 'CRM Sync', url: 'https://api.example.com/webhook', events: ['member.created', 'member.updated'], isActive: false, failureCount: 5 },
  ])

  const eventTypes = [
    { value: 'member.created', label: 'Member Created' },
    { value: 'member.updated', label: 'Member Updated' },
    { value: 'member.expired', label: 'Member Expired' },
    { value: 'member.renewed', label: 'Member Renewed' },
    { value: 'donation.created', label: 'Donation Received' },
    { value: 'payment.succeeded', label: 'Payment Succeeded' },
    { value: 'payment.failed', label: 'Payment Failed' },
    { value: 'event.registration.created', label: 'Event Registration' },
    { value: 'grant.application.submitted', label: 'Grant Application Submitted' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">Connect external services and automate workflows</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('apps')}
          className={`px-6 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'apps' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Connected Apps
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-6 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'webhooks' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Webhooks
        </button>
      </div>

      {activeTab === 'apps' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map(integration => (
            <div key={integration.id} className="bg-white rounded-xl border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    integration.status === 'connected' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <integration.icon className={`w-6 h-6 ${
                      integration.status === 'connected' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      integration.status === 'connected' ? 'bg-green-100 text-green-800' :
                      integration.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {integration.status === 'connected' ? 'Connected' : 
                       integration.status === 'error' ? 'Error' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

              {integration.lastSync && (
                <p className="text-xs text-gray-400 mb-4">
                  Last synced: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}

              <div className="flex gap-2">
                {integration.status === 'connected' ? (
                  <>
                    <button className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
                      <Settings className="w-4 h-4 inline mr-2" />
                      Configure
                    </button>
                    <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowWebhookModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Webhook
            </button>
          </div>

          <div className="bg-white rounded-xl border divide-y">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${webhook.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Webhook className={`w-6 h-6 ${webhook.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                        {webhook.failureCount > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            {webhook.failureCount} failures
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 font-mono mt-1">{webhook.url}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {webhook.events.map(event => (
                          <span key={event} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {event}
                          </span>
                        ))}
                      </div>
                      {webhook.lastTriggered && (
                        <p className="text-xs text-gray-400 mt-2">
                          Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <Settings className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhook.isActive}
                        onChange={() => {
                          setWebhooks(webhooks.map(w =>
                            w.id === webhook.id ? { ...w, isActive: !w.isActive } : w
                          ))
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Webhook Documentation */}
          <div className="mt-8 p-6 bg-blue-50 rounded-xl">
            <h3 className="font-semibold text-blue-900 mb-2">Webhook Documentation</h3>
            <p className="text-sm text-blue-800 mb-4">
              Webhooks send real-time HTTP POST requests to your specified URL when events occur.
              All payloads include a signature header for verification.
            </p>
            <div className="bg-white rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`{
  "event": "member.created",
  "timestamp": "2024-01-20T10:30:00Z",
  "data": {
    "id": "mem_123",
    "name": "Example Organization",
    "email": "contact@example.org"
  }
}`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
