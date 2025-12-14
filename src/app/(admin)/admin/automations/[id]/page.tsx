'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Zap, Mail, MessageSquare, Bell, UserPlus, DollarSign, Calendar,
  Clock, CheckCircle, GitBranch, Plus, Trash2, Save, ArrowLeft,
  Sparkles, Phone, Tag, Activity, Globe, ChevronDown, Play
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================
type TriggerType = {
  id: string
  label: string
  icon: any
  description: string
  payloadFields: string[]
}

type ActionType = {
  id: string
  label: string
  icon: any
  description: string
  configFields: ConfigField[]
}

type ConfigField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'checkbox'
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}

type Condition = {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in'
  value: string
}

type Action = {
  id: string
  type: string
  config: Record<string, any>
}

type Workflow = {
  id?: string
  name: string
  description: string
  trigger_type: string
  trigger_conditions: Record<string, any>
  actions: Action[]
  is_active: boolean
}

// ============================================================================
// TRIGGER & ACTION DEFINITIONS
// ============================================================================
const TRIGGERS: TriggerType[] = [
  { id: 'donation.created', label: 'Donation Received', icon: DollarSign, description: 'When a new donation is recorded', payloadFields: ['amount_cents', 'donor_email', 'donor_name', 'campaign_id', 'is_recurring'] },
  { id: 'member.created', label: 'New Member Joined', icon: UserPlus, description: 'When a new member signs up', payloadFields: ['name', 'email', 'membership_status'] },
  { id: 'member.renewed', label: 'Member Renewed', icon: CheckCircle, description: 'When a membership is renewed', payloadFields: ['name', 'email', 'plan_name'] },
  { id: 'member.expired', label: 'Member Expired', icon: Clock, description: 'When a membership expires', payloadFields: ['name', 'email'] },
  { id: 'member.score_dropped', label: 'Engagement Score Dropped', icon: Activity, description: 'When engagement drops significantly', payloadFields: ['old_score', 'new_score', 'engagement_tier'] },
  { id: 'event.registration.created', label: 'Event Registration', icon: Calendar, description: 'When someone registers for an event', payloadFields: ['event_id', 'attendee_email', 'attendee_name'] },
  { id: 'grant.application.submitted', label: 'Grant Application', icon: Zap, description: 'When a grant application is submitted', payloadFields: ['application_id', 'project_title', 'requested_amount'] },
]

const ACTIONS: ActionType[] = [
  { 
    id: 'send_email', 
    label: 'Send Email', 
    icon: Mail, 
    description: 'Send a templated email',
    configFields: [
      { key: 'to_field', label: 'Recipient Field', type: 'text', placeholder: 'e.g., donor_email' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Use {{field}} for dynamic values' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email content with {{field}} placeholders' },
    ]
  },
  { 
    id: 'ai_email_draft', 
    label: 'AI Email Draft', 
    icon: Sparkles, 
    description: 'Generate personalized email with AI (requires approval)',
    configFields: [
      { key: 'context_template', label: 'Context for AI', type: 'textarea', placeholder: 'e.g., "Donor gave ${{amount_cents/100}}. This is their first gift."' },
      { key: 'tone', label: 'Tone', type: 'select', options: [
        { value: 'formal', label: 'Formal' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'urgent', label: 'Urgent' },
      ]},
      { key: 'approval_required', label: 'Require Approval', type: 'checkbox' },
    ]
  },
  { 
    id: 'create_work_item', 
    label: 'Create Task', 
    icon: CheckCircle, 
    description: 'Create a work item for staff',
    configFields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Use {{field}} for dynamic values' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ]},
      { key: 'due_days', label: 'Due in (days)', type: 'number' },
    ]
  },
  { 
    id: 'slack_notify', 
    label: 'Slack Notification', 
    icon: MessageSquare, 
    description: 'Send a Slack message',
    configFields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/...' },
      { key: 'message', label: 'Message', type: 'textarea' },
    ]
  },
  { 
    id: 'sms_notify', 
    label: 'SMS Alert', 
    icon: Phone, 
    description: 'Send an SMS notification',
    configFields: [
      { key: 'to_field', label: 'Phone Field', type: 'text', placeholder: 'e.g., phone_number' },
      { key: 'message', label: 'Message', type: 'textarea' },
    ]
  },
  { 
    id: 'update_engagement', 
    label: 'Update Engagement', 
    icon: Activity, 
    description: 'Add engagement points',
    configFields: [
      { key: 'points', label: 'Points to Add', type: 'number' },
      { key: 'activity_type', label: 'Activity Type', type: 'text', placeholder: 'e.g., major_donation' },
    ]
  },
  { 
    id: 'add_tag', 
    label: 'Add Tag', 
    icon: Tag, 
    description: 'Add a tag to the member',
    configFields: [
      { key: 'tag', label: 'Tag Name', type: 'text' },
    ]
  },
  { 
    id: 'trigger_webhook', 
    label: 'Trigger Webhook', 
    icon: Globe, 
    description: 'Send data to external webhooks',
    configFields: [
      { key: 'event_type', label: 'Event Type Override', type: 'text', placeholder: 'Leave empty to use trigger event' },
    ]
  },
  { 
    id: 'delay', 
    label: 'Wait', 
    icon: Clock, 
    description: 'Wait before next action',
    configFields: [
      { key: 'minutes', label: 'Wait Minutes', type: 'number' },
    ]
  },
]

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
]

// ============================================================================
// WORKFLOW BUILDER COMPONENT
// ============================================================================
export default function WorkflowBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'

  const [workflow, setWorkflow] = React.useState<Workflow>({
    name: '',
    description: '',
    trigger_type: '',
    trigger_conditions: {},
    actions: [],
    is_active: false,
  })

  const [conditions, setConditions] = React.useState<Condition[]>([])
  const [saving, setSaving] = React.useState(false)
  const [showTriggerPicker, setShowTriggerPicker] = React.useState(false)
  const [showActionPicker, setShowActionPicker] = React.useState(false)

  const selectedTrigger = TRIGGERS.find(t => t.id === workflow.trigger_type)

  // Load existing workflow
  React.useEffect(() => {
    if (!isNew) {
      // Fetch workflow by ID
      fetch(`/api/automation?id=${params.id}`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            setWorkflow(data)
            // Parse conditions from trigger_conditions
            const conds: Condition[] = []
            for (const [field, cond] of Object.entries(data.trigger_conditions || {})) {
              if (typeof cond === 'object' && cond !== null) {
                for (const [op, val] of Object.entries(cond)) {
                  conds.push({ field, operator: op as any, value: String(val) })
                }
              } else {
                conds.push({ field, operator: 'eq', value: String(cond) })
              }
            }
            setConditions(conds)
          }
        })
    }
  }, [params.id, isNew])

  const handleSave = async () => {
    setSaving(true)
    
    // Build trigger_conditions from conditions array
    const triggerConditions: Record<string, any> = {}
    for (const cond of conditions) {
      if (cond.operator === 'eq') {
        triggerConditions[cond.field] = cond.value
      } else {
        triggerConditions[cond.field] = { [cond.operator]: cond.value }
      }
    }

    const payload = {
      ...workflow,
      trigger_conditions: triggerConditions,
      organization_id: 'demo-org', // Replace with actual org
    }

    try {
      const method = isNew ? 'POST' : 'PATCH'
      const response = await fetch('/api/automation', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? payload : { id: params.id, ...payload }),
      })

      if (response.ok) {
        router.push('/admin/automation')
      }
    } finally {
      setSaving(false)
    }
  }

  const addCondition = () => {
    if (!selectedTrigger) return
    setConditions([...conditions, { 
      field: selectedTrigger.payloadFields[0] || '', 
      operator: 'eq', 
      value: '' 
    }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const addAction = (actionType: string) => {
    setWorkflow({
      ...workflow,
      actions: [...workflow.actions, { 
        id: `action_${Date.now()}`, 
        type: actionType, 
        config: {} 
      }],
    })
    setShowActionPicker(false)
  }

  const updateAction = (index: number, config: Record<string, any>) => {
    const newActions = [...workflow.actions]
    newActions[index] = { ...newActions[index], config: { ...newActions[index].config, ...config } }
    setWorkflow({ ...workflow, actions: newActions })
  }

  const removeAction = (index: number) => {
    setWorkflow({ ...workflow, actions: workflow.actions.filter((_, i) => i !== index) })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin/automation')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Create Automation' : 'Edit Automation'}
            </h1>
            <p className="text-gray-500">Build a workflow to automate tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workflow.is_active}
              onChange={(e) => setWorkflow({ ...workflow, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Active</span>
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !workflow.name || !workflow.trigger_type}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Name & Description */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              placeholder="e.g., Welcome New Members"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              placeholder="What does this automation do?"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Visual Builder */}
      <div className="relative">
        {/* Connector Line */}
        <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-gray-200 z-0" />

        {/* TRIGGER NODE */}
        <div className="relative z-10 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${
              selectedTrigger ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {selectedTrigger ? (
                <selectedTrigger.icon className="w-8 h-8 text-blue-600" />
              ) : (
                <Zap className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Trigger</span>
                  {selectedTrigger && (
                    <button onClick={() => setShowTriggerPicker(true)} className="text-sm text-blue-600 hover:underline">
                      Change
                    </button>
                  )}
                </div>
                
                {!selectedTrigger ? (
                  <button
                    onClick={() => setShowTriggerPicker(true)}
                    className="w-full py-8 border-2 border-dashed rounded-lg text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <Plus className="w-6 h-6 mx-auto mb-2" />
                    Select a trigger event
                  </button>
                ) : (
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedTrigger.label}</h3>
                    <p className="text-sm text-gray-500">{selectedTrigger.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CONDITIONS */}
        {selectedTrigger && (
          <div className="relative z-10 mb-6 ml-24">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                  <GitBranch className="w-4 h-4 inline mr-1" />
                  Conditions (Optional)
                </span>
                <button onClick={addCondition} className="text-sm text-purple-600 hover:underline">
                  + Add Condition
                </button>
              </div>

              {conditions.length === 0 ? (
                <p className="text-sm text-gray-400">No conditions - runs for all {selectedTrigger.label} events</p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={cond.field}
                        onChange={(e) => {
                          const newConds = [...conditions]
                          newConds[idx].field = e.target.value
                          setConditions(newConds)
                        }}
                        className="px-3 py-1.5 border rounded-lg text-sm"
                      >
                        {selectedTrigger.payloadFields.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={(e) => {
                          const newConds = [...conditions]
                          newConds[idx].operator = e.target.value as any
                          setConditions(newConds)
                        }}
                        className="px-3 py-1.5 border rounded-lg text-sm"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) => {
                          const newConds = [...conditions]
                          newConds[idx].value = e.target.value
                          setConditions(newConds)
                        }}
                        placeholder="Value"
                        className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                      />
                      <button onClick={() => removeCondition(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        {selectedTrigger && workflow.actions.map((action, idx) => {
          const actionDef = ACTIONS.find(a => a.id === action.type)
          if (!actionDef) return null

          return (
            <div key={action.id} className="relative z-10 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-green-100 flex items-center justify-center">
                  <actionDef.icon className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                        Action {idx + 1}
                      </span>
                      <button onClick={() => removeAction(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-1">{actionDef.label}</h3>
                    <p className="text-sm text-gray-500 mb-4">{actionDef.description}</p>

                    <div className="space-y-3">
                      {actionDef.configFields.map(field => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={action.config[field.key] || ''}
                              onChange={(e) => updateAction(idx, { [field.key]: e.target.value })}
                              placeholder={field.placeholder}
                              rows={3}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={action.config[field.key] || ''}
                              onChange={(e) => updateAction(idx, { [field.key]: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                              <option value="">Select...</option>
                              {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : field.type === 'checkbox' ? (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={action.config[field.key] || false}
                                onChange={(e) => updateAction(idx, { [field.key]: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-600">Yes</span>
                            </label>
                          ) : (
                            <input
                              type={field.type}
                              value={action.config[field.key] || ''}
                              onChange={(e) => updateAction(idx, { [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* ADD ACTION BUTTON */}
        {selectedTrigger && (
          <div className="relative z-10 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <div className="flex-1">
                <button
                  onClick={() => setShowActionPicker(true)}
                  className="w-full py-6 border-2 border-dashed rounded-xl text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors"
                >
                  + Add Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trigger Picker Modal */}
      {showTriggerPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Select Trigger Event</h2>
            <div className="space-y-2">
              {TRIGGERS.map(trigger => (
                <button
                  key={trigger.id}
                  onClick={() => {
                    setWorkflow({ ...workflow, trigger_type: trigger.id })
                    setShowTriggerPicker(false)
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <trigger.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{trigger.label}</div>
                    <div className="text-sm text-gray-500">{trigger.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowTriggerPicker(false)} className="mt-4 w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Picker Modal */}
      {showActionPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Select Action</h2>
            <div className="space-y-2">
              {ACTIONS.map(action => (
                <button
                  key={action.id}
                  onClick={() => addAction(action.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border hover:border-green-300 hover:bg-green-50 text-left transition-colors"
                >
                  <div className="p-2 bg-green-100 rounded-lg">
                    <action.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{action.label}</div>
                    <div className="text-sm text-gray-500">{action.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowActionPicker(false)} className="mt-4 w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
