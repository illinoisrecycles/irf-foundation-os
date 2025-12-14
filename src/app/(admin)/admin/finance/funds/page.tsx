'use client'

import { useState, useEffect } from 'react'
import { 
  Wallet, Plus, TrendingUp, TrendingDown, Lock, Unlock,
  Loader2, Edit2, Trash2, PieChart
} from 'lucide-react'

type Fund = {
  id: string
  name: string
  description: string | null
  fund_type: 'unrestricted' | 'temporarily_restricted' | 'permanently_restricted'
  balance_cents: number
  is_default: boolean
  is_active: boolean
}

const fundTypeLabels = {
  unrestricted: { label: 'Unrestricted', color: 'bg-green-100 text-green-700', icon: Unlock },
  temporarily_restricted: { label: 'Temporarily Restricted', color: 'bg-yellow-100 text-yellow-700', icon: Lock },
  permanently_restricted: { label: 'Permanently Restricted', color: 'bg-red-100 text-red-700', icon: Lock }
}

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)

  useEffect(() => {
    fetchFunds()
  }, [])

  const fetchFunds = async () => {
    const res = await fetch('/api/funds')
    const data = await res.json()
    setFunds(data.funds || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fund?')) return
    
    await fetch(`/api/funds?id=${id}`, { method: 'DELETE' })
    fetchFunds()
  }

  // Calculate totals
  const totals = {
    unrestricted: funds.filter(f => f.fund_type === 'unrestricted')
      .reduce((sum, f) => sum + f.balance_cents, 0),
    temporarily_restricted: funds.filter(f => f.fund_type === 'temporarily_restricted')
      .reduce((sum, f) => sum + f.balance_cents, 0),
    permanently_restricted: funds.filter(f => f.fund_type === 'permanently_restricted')
      .reduce((sum, f) => sum + f.balance_cents, 0),
  }
  const grandTotal = totals.unrestricted + totals.temporarily_restricted + totals.permanently_restricted

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fund Accounting</h1>
          <p className="text-gray-600 mt-1">Manage restricted and unrestricted funds</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Fund
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Net Assets</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(grandTotal / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Unlock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unrestricted</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.unrestricted / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Temporarily Restricted</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.temporarily_restricted / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Permanently Restricted</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(totals.permanently_restricted / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Funds List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">All Funds</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : funds.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No funds created yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Create Your First Fund
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fund Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {funds.map(fund => {
                const typeInfo = fundTypeLabels[fund.fund_type]
                const Icon = typeInfo.icon
                return (
                  <tr key={fund.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{fund.name}</p>
                          {fund.description && (
                            <p className="text-sm text-gray-500">{fund.description}</p>
                          )}
                          {fund.is_default && (
                            <span className="text-xs text-blue-600">Default Fund</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        <Icon className="w-3 h-3" />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-lg font-semibold ${fund.balance_cents >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        ${(fund.balance_cents / 100).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        fund.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {fund.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingFund(fund)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        {!fund.is_default && (
                          <button
                            onClick={() => handleDelete(fund.id)}
                            className="p-2 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingFund) && (
        <FundModal
          fund={editingFund}
          onClose={() => {
            setShowCreateModal(false)
            setEditingFund(null)
          }}
          onSaved={() => {
            setShowCreateModal(false)
            setEditingFund(null)
            fetchFunds()
          }}
        />
      )}
    </div>
  )
}

function FundModal({ 
  fund, 
  onClose, 
  onSaved 
}: { 
  fund: Fund | null
  onClose: () => void
  onSaved: () => void 
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      fund_type: formData.get('fund_type'),
      is_default: formData.get('is_default') === 'on'
    }

    if (fund) {
      await fetch('/api/funds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fund.id, ...data })
      })
    } else {
      await fetch('/api/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {fund ? 'Edit Fund' : 'Create Fund'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fund Name *
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={fund?.name}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="e.g., General Operating Fund"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={fund?.description || ''}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Purpose of this fund"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fund Type *
            </label>
            <select
              name="fund_type"
              required
              defaultValue={fund?.fund_type || 'unrestricted'}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="unrestricted">Unrestricted</option>
              <option value="temporarily_restricted">Temporarily Restricted</option>
              <option value="permanently_restricted">Permanently Restricted</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_default"
              defaultChecked={fund?.is_default}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Set as default fund</span>
          </label>

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
              {saving ? 'Saving...' : fund ? 'Save Changes' : 'Create Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
