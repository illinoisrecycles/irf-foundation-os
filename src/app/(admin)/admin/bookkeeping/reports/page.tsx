'use client'

import * as React from 'react'
import { FileText, Download, Calendar, Loader2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

type ReportData = {
  revenue?: { account: string; amount: number }[]
  expenses?: { account: string; amount: number }[]
  totalRevenue?: number
  totalExpenses?: number
  netIncome?: number
  assets?: { category: string; accounts: { name: string; balance: number }[] }[]
  liabilities?: { category: string; accounts: { name: string; balance: number }[] }[]
  equity?: { category: string; accounts: { name: string; balance: number }[] }[]
  totalAssets?: number
  totalLiabilities?: number
  totalEquity?: number
}

export default function ReportsPage() {
  const [reportType, setReportType] = React.useState('profit_loss')
  const [startDate, setStartDate] = React.useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0])
  const [data, setData] = React.useState<ReportData | null>(null)
  const [loading, setLoading] = React.useState(false)

  const loadReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/bookkeeping/reports?type=${reportType}&start=${startDate}&end=${endDate}`
      )
      const reportData = await res.json()
      setData(reportData)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadReport()
  }, [reportType, startDate, endDate])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const downloadPDF = () => {
    window.open(
      `/api/bookkeeping/reports?type=${reportType}&start=${startDate}&end=${endDate}&format=pdf`,
      '_blank'
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-500">Generate and download financial statements</p>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="profit_loss">Profit & Loss</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="trial_balance">Trial Balance</option>
              <option value="990_prep">990 Preparation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : reportType === 'profit_loss' && data ? (
        <div className="bg-white rounded-xl border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Profit & Loss Statement</h2>
            <p className="text-sm text-gray-500">{startDate} to {endDate}</p>
          </div>

          <div className="p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(data.totalRevenue || 0)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 mb-1">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(data.totalExpenses || 0)}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${(data.netIncome || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className={`text-sm mb-1 ${(data.netIncome || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Net Income
                </p>
                <p className={`text-2xl font-bold ${(data.netIncome || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(data.netIncome || 0)}
                </p>
              </div>
            </div>

            {/* Revenue */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Revenue
              </h3>
              <div className="space-y-2">
                {data.revenue?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold">
                  <span>Total Revenue</span>
                  <span className="text-green-600">{formatCurrency(data.totalRevenue || 0)}</span>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Expenses
              </h3>
              <div className="space-y-2">
                {data.expenses?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold">
                  <span>Total Expenses</span>
                  <span className="text-red-600">{formatCurrency(data.totalExpenses || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6">
          <pre className="text-sm text-gray-600 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
