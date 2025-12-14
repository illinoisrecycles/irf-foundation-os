'use client'

import * as React from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, Receipt, 
  FileText, AlertTriangle, CheckCircle, RefreshCw, Upload,
  Building2, ArrowUpRight, ArrowDownRight, Sparkles, Clock,
  PieChart, BarChart3, Wallet, Target, Calendar, Download
} from 'lucide-react'

type CashFlowSummary = {
  currentBalance: number
  projectedBalance30Days: number
  projectedBalance90Days: number
  burnRate: number
  runway: number
  trend: 'up' | 'down' | 'stable'
}

type Transaction = {
  id: string
  transaction_date: string
  name: string
  merchant_name?: string
  amount_cents: number
  status: string
  ai_confidence?: number
  bank_account?: { name: string }
  expense_account?: { name: string; account_number: string }
}

type Insight = {
  id: string
  insight_type: string
  severity: string
  title: string
  description: string
  action_url?: string
}

export default function BookkeepingDashboard() {
  const [cashFlow, setCashFlow] = React.useState<CashFlowSummary | null>(null)
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [insights, setInsights] = React.useState<Insight[]>([])
  const [loading, setLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)
  const [stats, setStats] = React.useState({
    pendingCount: 0,
    categorizedToday: 0,
    totalAccounts: 0,
  })

  React.useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [cfRes, txRes] = await Promise.all([
        fetch('/api/bookkeeping?section=cash-flow'),
        fetch('/api/bookkeeping/transactions?status=pending&limit=10'),
      ])

      const cfData = await cfRes.json()
      const txData = await txRes.json()

      setCashFlow(cfData)
      setTransactions(txData.data || [])
      setStats(s => ({ ...s, pendingCount: txData.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const syncBanks = async () => {
    setSyncing(true)
    try {
      await fetch('/api/bookkeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-banks' }),
      })
      await loadDashboard()
    } finally {
      setSyncing(false)
    }
  }

  const categorizeTransaction = async (id: string, accountId: string) => {
    await fetch('/api/bookkeeping/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, account_id: accountId }),
    })
    setTransactions(txs => txs.filter(t => t.id !== id))
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Bookkeeping</h1>
          <p className="text-gray-500">Automated financial management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={syncBanks}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Banks'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Upload className="w-4 h-4" />
            Upload Receipt
          </button>
        </div>
      </div>

      {/* Cash Flow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            {cashFlow?.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500" />}
            {cashFlow?.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
          </div>
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(cashFlow?.currentBalance || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500">30-Day Projection</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(cashFlow?.projectedBalance30Days || 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">AI predicted</p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500">Monthly Burn Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(cashFlow?.burnRate || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500">Cash Runway</p>
          <p className="text-2xl font-bold text-gray-900">
            {cashFlow?.runway || 0} months
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Pending Transactions</h2>
              {stats.pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  {stats.pendingCount} to review
                </span>
              )}
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Auto-categorize all
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-sm text-gray-400">No pending transactions to review</p>
            </div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${tx.amount_cents < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                        {tx.amount_cents < 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.merchant_name || tx.name}</p>
                        <p className="text-sm text-gray-500">{tx.transaction_date}</p>
                        {tx.bank_account && (
                          <p className="text-xs text-gray-400">{tx.bank_account.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.amount_cents < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(tx.amount_cents))}
                      </p>
                      {tx.ai_confidence && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                          <Sparkles className="w-3 h-3" />
                          {Math.round(tx.ai_confidence * 100)}% match
                        </div>
                      )}
                    </div>
                  </div>
                  {tx.expense_account && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Suggested:</span>
                      <button
                        onClick={() => categorizeTransaction(tx.id, tx.expense_account!.account_number)}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200"
                      >
                        {tx.expense_account.account_number} - {tx.expense_account.name}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Reports */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Reports</h3>
            <div className="space-y-2">
              <a href="/admin/bookkeeping/reports?type=profit_loss" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm">Profit & Loss</span>
              </a>
              <a href="/admin/bookkeeping/reports?type=balance_sheet" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                <PieChart className="w-5 h-5 text-green-600" />
                <span className="text-sm">Balance Sheet</span>
              </a>
              <a href="/admin/bookkeeping/reports?type=990_prep" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-sm">990 Preparation</span>
              </a>
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">AI Insights</h3>
            </div>
            <div className="space-y-3">
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-sm font-medium">Cash Flow Alert</p>
                <p className="text-xs text-white/80 mt-1">
                  Based on current trends, you'll have {formatCurrency(cashFlow?.projectedBalance90Days || 0)} in 90 days.
                </p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-sm font-medium">Expense Pattern</p>
                <p className="text-xs text-white/80 mt-1">
                  Technology expenses are 15% higher than last quarter.
                </p>
              </div>
            </div>
          </div>

          {/* Connected Banks */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Connected Banks</h3>
              <button className="text-sm text-blue-600">+ Add</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Chase Checking</p>
                  <p className="text-xs text-gray-400">••••4521</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Amex Business</p>
                  <p className="text-xs text-gray-400">••••1004</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
