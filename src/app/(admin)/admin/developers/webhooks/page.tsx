'use client'

import { useState, useEffect } from 'react'
import { 
  Webhook, Plus, Settings, Trash2, Play, Pause, RefreshCw,
  CheckCircle, XCircle, Clock, Loader2, Copy, Eye, EyeOff
} from 'lucide-react'

type WebhookEndpoint = {
  id: string
  url: string
  description: string
  secret: string
  events: string[]
  is_active: boolean
  last_triggered_at: string | null
  success_count: number
  failure_count: number
  created_at: string
}

const AVAILABLE_EVENTS = [
  { id: 'member.created', label: 'Member Created', description: 'When a new member joins' },
  { id: 'member.updated', label: 'Member Updated', description: 'When member info changes' },
  { id: 'member.renewed', label: 'Member Renewed', description: 'When membership is renewed' },
  { id: 'member.expired', label: 'Member Expired', description: 'When membership expires' },
  { id: 'donation.received', label: 'Donation Received', description: 'When a donation is made' },
  { id: 'event.registration', label: 'Event Registration', description: 'When someone registers for an event' },
  { id: 'event.checkin', label: 'Event Check-in', description: 'When someone checks in' },
  { id: 'volunteer.signup', label: 'Volunteer Signup', description: 'When someone signs up to volunteer' },
  { id: 'invoice.created', label: 'Invoice Created', description: 'When an invoice is created' },
  { id: 'invoice.paid', label: 'Invoice Paid', description: 'When an invoice is paid' },
  { id: 'grant.application_submitted', label: 'Grant Application', description: 'When a grant application is submitted' },
]

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchEndpoints()
  }, [])

  const fetchEndpoints = async () => {
    const res = await fetch('/api/webhooks/endpoints')
    const data = await res.json()
    setEndpoints(data.endpoints || [])
    setLoading(false)
  }

  const toggleEndpoint = async (id: string, is_active: boolean) => {
    await fetch('/api/webhooks/endpoints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active })
    })
    fetchEndpoints()
  }

  const deleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return
    
    await fetch(`/api/webhooks/endpoints?id=${id}`, { method: 'DELETE' })
    fetchEndpoints()
  }

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret)
    // Would show toast here
  }

  const testWebhook = async (id: string) => {
    // Send test payload
    await fetch(`/api/webhooks/endpoints/${id}/test`, { method: 'POST' })
    // Would show result toast
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-gray-600 mt-1">Receive real-time notifications when events occur</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Endpoint
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How Webhooks Work</h3>
        <p className="text-blue-800 text-sm">
          Webhooks allow your external systems to receive real-time notifications when events happen 
          in FoundationOS. Each webhook includes a signature header for verification.
        </p>
        <a href="/admin/developers/docs#webhooks" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          View Documentation →
        </a>
      </div>

      {/* Endpoints List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No webhook endpoints configured</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Create Your First Webhook
            </button>
          </div>
        ) : (
          endpoints.map(endpoint => (
            <div key={endpoint.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${endpoint.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-mono text-sm text-gray-900 break-all">{endpoint.url}</p>
                      {endpoint.description && (
                        <p className="text-sm text-gray-500 mt-1">{endpoint.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEndpoint(endpoint.id, endpoint.is_active)}
                      className={`p-2 rounded-lg ${
                        endpoint.is_active 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={endpoint.is_active ? 'Pause' : 'Activate'}
                    >
                      {endpoint.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => testWebhook(endpoint.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Send Test"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteEndpoint(endpoint.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Secret */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 uppercase font-medium">Signing Secret</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowSecrets(prev => ({ ...prev, [endpoint.id]: !prev[endpoint.id] }))}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {showSecrets[endpoint.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copySecret(endpoint.secret)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-sm mt-1">
                    {showSecrets[endpoint.id] ? endpoint.secret : '••••••••••••••••••••••••••••••••'}
                  </p>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {endpoint.events.map(event => (
                    <span key={event} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      {event}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {endpoint.success_count} successful
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    {endpoint.failure_count} failed
                  </span>
                  {endpoint.last_triggered_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last triggered {new Date(endpoint.last_triggered_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateWebhookModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchEndpoints()
          }}
        />
      )}
    </div>
  )
}

function CreateWebhookModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const res = await fetch('/api/webhooks/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, description, events: selectedEvents })
    })

    if (res.ok) {
      onCreated()
    }
    setSaving(false)
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Add Webhook Endpoint</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endpoint URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
              placeholder="https://your-app.com/webhooks/foundationos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="e.g., Zapier integration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Events to Subscribe *
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
              {AVAILABLE_EVENTS.map(event => (
                <label
                  key={event.id}
                  className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{event.label}</p>
                    <p className="text-xs text-gray-500">{event.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-red-500 mt-2">Select at least one event</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || selectedEvents.length === 0}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
