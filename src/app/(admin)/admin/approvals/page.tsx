'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, 
  DollarSign, FileText, Users, Briefcase,
  ChevronRight, Filter, Search, Eye
} from 'lucide-react'

type ApprovalRequest = {
  id: string
  title: string
  description: string | null
  approval_type: string
  status: string
  amount_cents: number | null
  urgency: string
  created_at: string
  due_date: string | null
  entity_table: string
  entity_id: string
  created_by_profile: { full_name: string; email: string } | null
  approval_steps: Array<{
    id: string
    step_order: number
    step_name: string | null
    role_required: string | null
    status: string
    decided_at: string | null
  }>
}

const typeIcons: Record<string, any> = {
  grant_award: Briefcase,
  grant_disbursement: DollarSign,
  vendor_payment: FileText,
  expense: DollarSign,
  period_close: FileText,
}

const typeLabels: Record<string, string> = {
  grant_award: 'Grant Award',
  grant_disbursement: 'Grant Disbursement',
  vendor_payment: 'Vendor Payment',
  expense: 'Expense',
  period_close: 'Period Close',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all' | 'my'>('pending')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchApprovals()
  }, [filter, typeFilter])

  const fetchApprovals = async () => {
    setLoading(true)
    const params = new URLSearchParams({
      organization_id: 'ORG_ID', // Would come from context
      status: filter === 'all' ? 'all' : 'pending',
    })
    if (typeFilter) params.set('type', typeFilter)
    if (filter === 'my') params.set('my_approvals', 'true')

    const res = await fetch(`/api/approvals?${params}`)
    const data = await res.json()
    setApprovals(data.approvals || [])
    setLoading(false)
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedApproval) return
    setProcessing(true)

    await fetch(`/api/approvals/${selectedApproval.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        profile_id: 'CURRENT_USER_ID', // Would come from auth context
        note: actionNote,
      }),
    })

    setSelectedApproval(null)
    setActionNote('')
    setProcessing(false)
    fetchApprovals()
  }

  const pendingCount = approvals.filter(a => a.status === 'pending').length
  const totalAmount = approvals
    .filter(a => a.status === 'pending' && a.amount_cents)
    .reduce((sum, a) => sum + (a.amount_cents || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve pending requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalAmount / 100).toLocaleString()}</p>
              <p className="text-sm text-gray-600">Pending Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {approvals.filter(a => a.urgency === 'critical' || a.urgency === 'high').length}
              </p>
              <p className="text-sm text-gray-600">Urgent</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {approvals.filter(a => a.approval_steps?.some(s => s.status === 'pending')).length}
              </p>
              <p className="text-sm text-gray-600">Awaiting My Action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {(['pending', 'my', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'pending' ? 'Pending' : f === 'my' ? 'My Queue' : 'All'}
              </button>
            ))}
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            <option value="">All Types</option>
            <option value="grant_award">Grant Awards</option>
            <option value="grant_disbursement">Disbursements</option>
            <option value="vendor_payment">Vendor Payments</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
      </div>

      {/* Approvals List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600">No pending approvals</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {approvals.map(approval => {
                const TypeIcon = typeIcons[approval.approval_type] || FileText
                const currentStep = approval.approval_steps?.find(s => s.status === 'pending')
                
                return (
                  <tr key={approval.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {approval.urgency === 'critical' && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{approval.title}</p>
                          <p className="text-sm text-gray-500">
                            By {approval.created_by_profile?.full_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{typeLabels[approval.approval_type] || approval.approval_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {approval.amount_cents ? (
                        <span className="font-medium">${(approval.amount_cents / 100).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[approval.status]}`}>
                        {approval.status}
                      </span>
                      {currentStep && (
                        <p className="text-xs text-gray-500 mt-1">
                          Step {currentStep.step_order}: {currentStep.role_required || 'Review'}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedApproval(approval)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Review Approval Request</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg">{selectedApproval.title}</h3>
                <p className="text-gray-600 mt-1">{selectedApproval.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="font-medium">{typeLabels[selectedApproval.approval_type]}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Amount</label>
                  <p className="font-medium text-lg">
                    {selectedApproval.amount_cents 
                      ? `$${(selectedApproval.amount_cents / 100).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Submitted By</label>
                  <p className="font-medium">{selectedApproval.created_by_profile?.full_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Submitted</label>
                  <p className="font-medium">
                    {new Date(selectedApproval.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Approval Steps */}
              <div>
                <label className="text-sm text-gray-500 mb-2 block">Approval Progress</label>
                <div className="space-y-2">
                  {selectedApproval.approval_steps
                    ?.sort((a, b) => a.step_order - b.step_order)
                    .map(step => (
                      <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {step.status === 'approved' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : step.status === 'rejected' ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">Step {step.step_order}: {step.role_required || 'Review'}</p>
                          {step.decided_at && (
                            <p className="text-sm text-gray-500">
                              {step.status} on {new Date(step.decided_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[step.status]}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Decision Note */}
              {selectedApproval.status === 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decision Note (optional)
                  </label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full px-4 py-3 border rounded-lg"
                    rows={3}
                    placeholder="Add a note about your decision..."
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedApproval(null)
                  setActionNote('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              {selectedApproval.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={processing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
