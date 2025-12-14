'use client'

import { useState, useEffect } from 'react'
import { 
  Calculator, Plus, TrendingUp, TrendingDown, Check, AlertTriangle,
  Loader2, ChevronDown, ChevronRight, Edit2, Trash2, CheckCircle
} from 'lucide-react'

type BudgetLine = {
  id: string
  category: string
  description: string
  amount_cents: number
  period: string
  account?: { name: string; code: string }
  fund?: { name: string }
}

type Budget = {
  id: string
  name: string
  fiscal_year: number
  status: 'draft' | 'approved' | 'closed'
  lines: BudgetLine[]
  approved_at: string | null
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null)

  // Mock actuals data - in production, fetch from ledger
  const [actuals, setActuals] = useState<Record<string, number>>({
    'Program Expenses': 2500000,
    'Fundraising': 450000,
    'Administrative': 320000,
    'Events': 180000,
    'Marketing': 95000,
  })

  useEffect(() => {
    fetchBudgets()
  }, [selectedYear])

  const fetchBudgets = async () => {
    const res = await fetch(`/api/budgets?fiscal_year=${selectedYear}`)
    const data = await res.json()
    setBudgets(data.budgets || [])
    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    await fetch('/api/budgets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve' })
    })
    fetchBudgets()
  }

  // Calculate totals for a budget
  const getBudgetTotal = (budget: Budget) => {
    return budget.lines.reduce((sum, line) => sum + line.amount_cents, 0)
  }

  // Group lines by category
  const groupLinesByCategory = (lines: BudgetLine[]) => {
    return lines.reduce((acc, line) => {
      if (!acc[line.category]) {
        acc[line.category] = []
      }
      acc[line.category].push(line)
      return acc
    }, {} as Record<string, BudgetLine[]>)
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Management</h1>
          <p className="text-gray-600 mt-1">Plan and track your fiscal year budgets</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
          >
            {years.map(year => (
              <option key={year} value={year}>FY {year}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Budget
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No budgets for FY {selectedYear}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Create Budget
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {budgets.map(budget => {
            const total = getBudgetTotal(budget)
            const grouped = groupLinesByCategory(budget.lines)
            const isExpanded = expandedBudget === budget.id

            return (
              <div key={budget.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Budget Header */}
                <div
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{budget.name}</h2>
                      <p className="text-sm text-gray-500">
                        FY {budget.fiscal_year} • {budget.lines.length} line items
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      budget.status === 'approved' ? 'bg-green-100 text-green-700' :
                      budget.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {budget.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Budget</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(total / 100).toLocaleString()}
                      </p>
                    </div>
                    {budget.status === 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApprove(budget.id)
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Budget Details */}
                {isExpanded && (
                  <div className="border-t">
                    {Object.entries(grouped).map(([category, lines]) => {
                      const categoryBudget = lines.reduce((sum, l) => sum + l.amount_cents, 0)
                      const categoryActual = actuals[category] || 0
                      const variance = categoryBudget - categoryActual
                      const percentUsed = categoryBudget > 0 ? (categoryActual / categoryBudget) * 100 : 0
                      const isOverBudget = categoryActual > categoryBudget

                      return (
                        <div key={category} className="border-b last:border-0">
                          <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">{category}</h3>
                            <div className="flex items-center gap-8">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Budget</p>
                                <p className="font-medium">${(categoryBudget / 100).toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Actual</p>
                                <p className="font-medium">${(categoryActual / 100).toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Variance</p>
                                <p className={`font-medium flex items-center gap-1 ${
                                  isOverBudget ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {isOverBudget ? (
                                    <TrendingUp className="w-4 h-4" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4" />
                                  )}
                                  ${Math.abs(variance / 100).toLocaleString()}
                                </p>
                              </div>
                              <div className="w-32">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      isOverBudget ? 'bg-red-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-right">
                                  {percentUsed.toFixed(0)}% used
                                </p>
                              </div>
                            </div>
                          </div>
                          <table className="w-full">
                            <tbody>
                              {lines.map(line => (
                                <tr key={line.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-3 text-gray-600">{line.description}</td>
                                  <td className="px-6 py-3 text-gray-500 text-sm">
                                    {line.account?.name || '-'}
                                  </td>
                                  <td className="px-6 py-3 text-gray-500 text-sm">
                                    {line.fund?.name || '-'}
                                  </td>
                                  <td className="px-6 py-3 text-right font-medium">
                                    ${(line.amount_cents / 100).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateBudgetModal
          fiscalYear={selectedYear}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchBudgets()
          }}
        />
      )}
    </div>
  )
}

function CreateBudgetModal({ 
  fiscalYear, 
  onClose, 
  onCreated 
}: { 
  fiscalYear: number
  onClose: () => void
  onCreated: () => void 
}) {
  const [saving, setSaving] = useState(false)
  const [lines, setLines] = useState([
    { category: 'Program Expenses', description: '', amount_cents: 0 }
  ])

  const categories = [
    'Program Expenses',
    'Fundraising',
    'Administrative',
    'Events',
    'Marketing',
    'Personnel',
    'Technology',
    'Other'
  ]

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      fiscal_year: fiscalYear,
      lines: lines.filter(l => l.description && l.amount_cents > 0)
    }

    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    setSaving(false)
    onCreated()
  }

  const addLine = () => {
    setLines([...lines, { category: 'Program Expenses', description: '', amount_cents: 0 }])
  }

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const total = lines.reduce((sum, l) => sum + l.amount_cents, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h3 className="text-xl font-semibold text-gray-900">Create Budget for FY {fiscalYear}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Budget Name *</label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="e.g., Operating Budget"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">Budget Lines</label>
              <button
                type="button"
                onClick={addLine}
                className="text-sm text-primary hover:underline"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <select
                    value={line.category}
                    onChange={(e) => updateLine(index, 'category', e.target.value)}
                    className="w-40 px-3 py-2 border rounded-lg text-sm"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={line.amount_cents / 100 || ''}
                      onChange={(e) => updateLine(index, 'amount_cents', parseFloat(e.target.value || '0') * 100)}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm"
                      step="0.01"
                    />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end text-lg font-semibold border-t pt-4">
            Total: ${(total / 100).toLocaleString()}
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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
