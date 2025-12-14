'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

// ============================================================================
// DISBURSEMENT SCHEDULE
// Manage payment schedules for grant awards
// ============================================================================

type Disbursement = {
  id: string
  application_id: string
  amount_cents: number
  scheduled_date: string
  status: 'scheduled' | 'pending_approval' | 'approved' | 'paid' | 'cancelled'
  description?: string
  paid_at?: string
  payment_reference?: string
}

type DisbursementScheduleProps = {
  applicationId: string
  awardAmountCents: number
  disbursements: Disbursement[]
  editable?: boolean
}

export function DisbursementSchedule({
  applicationId,
  awardAmountCents,
  disbursements,
  editable = true,
}: DisbursementScheduleProps) {
  const [newDisbursement, setNewDisbursement] = React.useState({
    amount: '',
    date: '',
    description: '',
  })
  const qc = useQueryClient()

  const totalScheduled = disbursements.reduce((sum, d) => sum + d.amount_cents, 0)
  const remaining = awardAmountCents - totalScheduled
  const totalPaid = disbursements
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount_cents, 0)

  const addDisbursement = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/grants/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          amount_cents: Math.round(parseFloat(newDisbursement.amount) * 100),
          scheduled_date: newDisbursement.date,
          description: newDisbursement.description,
        }),
      })
      if (!res.ok) throw new Error('Failed to add disbursement')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grant-application', applicationId] })
      setNewDisbursement({ amount: '', date: '', description: '' })
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/grants/disbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grant-application', applicationId] }),
  })

  const deleteDisbursement = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/grants/disbursements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grant-application', applicationId] }),
  })

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    pending_approval: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    paid: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const statusIcons: Record<string, React.ReactNode> = {
    scheduled: <Calendar className="w-4 h-4" />,
    pending_approval: <Clock className="w-4 h-4" />,
    approved: <CheckCircle2 className="w-4 h-4" />,
    paid: <DollarSign className="w-4 h-4" />,
    cancelled: <AlertCircle className="w-4 h-4" />,
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Award</p>
          <p className="text-xl font-bold">${(awardAmountCents / 100).toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Paid</p>
          <p className="text-xl font-bold text-green-700">${(totalPaid / 100).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">Remaining</p>
          <p className="text-xl font-bold text-blue-700">${(remaining / 100).toLocaleString()}</p>
        </div>
      </div>

      {/* Disbursement List */}
      <div className="space-y-3">
        <h3 className="font-semibold">Payment Schedule</h3>
        
        {disbursements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No disbursements scheduled yet
          </p>
        ) : (
          <div className="space-y-2">
            {disbursements.map((d) => (
              <div key={d.id} className="flex items-center gap-4 p-4 bg-white border rounded-lg">
                <div className={`p-2 rounded-lg ${statusColors[d.status]}`}>
                  {statusIcons[d.status]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">${(d.amount_cents / 100).toLocaleString()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[d.status]}`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(d.scheduled_date).toLocaleDateString()}
                    {d.description && ` — ${d.description}`}
                  </p>
                </div>
                {editable && d.status === 'scheduled' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateStatus.mutate({ id: d.id, status: 'pending_approval' })}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Request Approval
                    </button>
                    <button
                      onClick={() => deleteDisbursement.mutate(d.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {editable && d.status === 'pending_approval' && (
                  <button
                    onClick={() => updateStatus.mutate({ id: d.id, status: 'approved' })}
                    className="text-sm text-green-600 hover:underline"
                  >
                    Approve
                  </button>
                )}
                {editable && d.status === 'approved' && (
                  <button
                    onClick={() => updateStatus.mutate({ id: d.id, status: 'paid' })}
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Disbursement */}
      {editable && remaining > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Add Disbursement</h4>
          <div className="flex gap-3">
            <div className="w-32">
              <input
                type="number"
                placeholder="Amount"
                value={newDisbursement.amount}
                onChange={(e) => setNewDisbursement(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                step="0.01"
                max={remaining / 100}
              />
            </div>
            <div className="w-40">
              <input
                type="date"
                value={newDisbursement.date}
                onChange={(e) => setNewDisbursement(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDisbursement.description}
                onChange={(e) => setNewDisbursement(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <button
              onClick={() => addDisbursement.mutate()}
              disabled={!newDisbursement.amount || !newDisbursement.date || addDisbursement.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
