'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Code, Copy, Check, Plus, Trash2, Settings, ExternalLink,
  BarChart3, DollarSign, Calendar, Users, Eye, Loader2
} from 'lucide-react'

type Widget = {
  id: string
  widget_type: string
  name: string
  embed_key: string
  config: Record<string, any>
  allowed_domains: string[]
  is_active: boolean
  view_count: number
  last_viewed_at: string
  created_at: string
}

const WIDGET_TYPES = [
  { id: 'impact_counter', name: 'Impact Counter', icon: BarChart3, description: 'Display your impact metrics' },
  { id: 'donation_thermometer', name: 'Donation Thermometer', icon: DollarSign, description: 'Show campaign progress' },
  { id: 'event_list', name: 'Event List', icon: Calendar, description: 'Upcoming events widget' },
  { id: 'volunteer_opportunities', name: 'Volunteer Opportunities', icon: Users, description: 'Show volunteer openings' },
]

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchWidgets()
  }, [])

  const fetchWidgets = async () => {
    const { data, error } = await supabase
      .from('embed_widgets')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setWidgets(data || [])
    }
    setLoading(false)
  }

  const copyEmbedCode = (widget: Widget, type: 'html' | 'js' | 'iframe') => {
    const baseUrl = window.location.origin
    let code = ''

    switch (type) {
      case 'html':
        code = `<div id="foundationos-widget-${widget.embed_key}"></div>
<script src="${baseUrl}/api/widgets/${widget.embed_key}?format=js"></script>`
        break
      case 'js':
        code = `<script src="${baseUrl}/api/widgets/${widget.embed_key}?format=js"></script>`
        break
      case 'iframe':
        code = `<iframe src="${baseUrl}/api/widgets/${widget.embed_key}" 
  frameborder="0" 
  style="width:100%;min-height:300px;border:none;">
</iframe>`
        break
    }

    navigator.clipboard.writeText(code)
    setCopied(`${widget.id}-${type}`)
    setTimeout(() => setCopied(null), 2000)
  }

  const deleteWidget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this widget?')) return
    
    await supabase.from('embed_widgets').delete().eq('id', id)
    fetchWidgets()
  }

  const toggleActive = async (widget: Widget) => {
    await supabase
      .from('embed_widgets')
      .update({ is_active: !widget.is_active })
      .eq('id', widget.id)
    fetchWidgets()
  }

  const getWidgetIcon = (type: string) => {
    const widgetType = WIDGET_TYPES.find(w => w.id === type)
    const Icon = widgetType?.icon || Code
    return <Icon className="w-5 h-5" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Embed Widgets</h1>
          <p className="text-gray-600 mt-1">
            Create embeddable widgets for your website and partner sites
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedWidget(null)
            setShowModal(true)
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Widget
        </button>
      </div>

      {/* Widget Types Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        {WIDGET_TYPES.map(type => {
          const count = widgets.filter(w => w.widget_type === type.id).length
          return (
            <div key={type.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <type.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{type.name}</p>
                  <p className="text-sm text-gray-500">{count} active</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Widgets List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : widgets.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Code className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No widgets created yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Create Your First Widget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {widgets.map(widget => (
            <div key={widget.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      widget.is_active ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {getWidgetIcon(widget.widget_type)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{widget.name}</h3>
                      <p className="text-sm text-gray-500">
                        {WIDGET_TYPES.find(t => t.id === widget.widget_type)?.name}
                        {' • '}
                        <span className={widget.is_active ? 'text-green-600' : 'text-gray-400'}>
                          {widget.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/widgets/${widget.embed_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Preview"
                    >
                      <Eye className="w-5 h-5 text-gray-500" />
                    </a>
                    <button
                      onClick={() => {
                        setSelectedWidget(widget)
                        setShowModal(true)
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteWidget(widget.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {widget.view_count.toLocaleString()} views
                  </span>
                  {widget.last_viewed_at && (
                    <span>
                      Last viewed: {new Date(widget.last_viewed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Embed Codes */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-3">Embed Code</p>
                  <div className="flex gap-2">
                    {['html', 'js', 'iframe'].map((type) => (
                      <button
                        key={type}
                        onClick={() => copyEmbedCode(widget, type as any)}
                        className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        {copied === `${widget.id}-${type}` ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <WidgetModal
          widget={selectedWidget}
          onClose={() => {
            setShowModal(false)
            setSelectedWidget(null)
          }}
          onSaved={() => {
            setShowModal(false)
            setSelectedWidget(null)
            fetchWidgets()
          }}
        />
      )}
    </div>
  )
}

function WidgetModal({ 
  widget, 
  onClose, 
  onSaved 
}: { 
  widget: Widget | null
  onClose: () => void
  onSaved: () => void 
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: widget?.name || '',
    widget_type: widget?.widget_type || 'impact_counter',
    allowed_domains: widget?.allowed_domains?.join(', ') || '',
    config: widget?.config || {},
  })
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const data = {
      name: form.name,
      widget_type: form.widget_type,
      allowed_domains: form.allowed_domains.split(',').map(d => d.trim()).filter(Boolean),
      config: form.config,
      is_active: true,
    }

    if (widget) {
      await supabase.from('embed_widgets').update(data).eq('id', widget.id)
    } else {
      await supabase.from('embed_widgets').insert(data)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {widget ? 'Edit Widget' : 'Create Widget'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Widget Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="e.g., Homepage Impact Counter"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Widget Type
            </label>
            <select
              value={form.widget_type}
              onChange={e => setForm({ ...form, widget_type: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              disabled={!!widget}
            >
              {WIDGET_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Domains (optional)
            </label>
            <input
              type="text"
              value={form.allowed_domains}
              onChange={e => setForm({ ...form, allowed_domains: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="example.com, blog.example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to allow all domains
            </p>
          </div>

          {/* Type-specific config */}
          {form.widget_type === 'impact_counter' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900">Impact Counter Settings</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Custom Metric Value</label>
                <input
                  type="number"
                  value={form.config.custom_metric_value || ''}
                  onChange={e => setForm({ 
                    ...form, 
                    config: { ...form.config, custom_metric_value: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., 3200"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Custom Metric Label</label>
                <input
                  type="text"
                  value={form.config.custom_metric_label || ''}
                  onChange={e => setForm({ 
                    ...form, 
                    config: { ...form.config, custom_metric_label: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Tons Recycled"
                />
              </div>
            </div>
          )}

          {form.widget_type === 'donation_thermometer' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900">Thermometer Settings</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={form.config.campaign_name || ''}
                  onChange={e => setForm({ 
                    ...form, 
                    config: { ...form.config, campaign_name: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., 2025 Annual Fund"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Goal Amount ($)</label>
                <input
                  type="number"
                  value={(form.config.goal_cents || 0) / 100}
                  onChange={e => setForm({ 
                    ...form, 
                    config: { ...form.config, goal_cents: parseFloat(e.target.value) * 100 || 0 }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Donate URL</label>
                <input
                  type="url"
                  value={form.config.donate_url || ''}
                  onChange={e => setForm({ 
                    ...form, 
                    config: { ...form.config, donate_url: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://donate.example.org"
                />
              </div>
            </div>
          )}

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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : widget ? 'Save Changes' : 'Create Widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
