'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, Download, Calendar, TrendingUp, TrendingDown,
  Loader2, Printer, Filter, ChevronRight, PieChart, BarChart3
} from 'lucide-react'

type ReportType = 'income_statement' | 'balance_sheet' | 'cash_flow' | '990_prep' | 'donor_report'

export default function FinancialReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('income_statement')
  const [loading, setLoading] = useState(false)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [reportData, setReportData] = useState<any>(null)

  useEffect(() => {
    generateReport()
  }, [activeReport, fiscalYear])

  const generateReport = async () => {
    setLoading(true)
    // In production, fetch from /api/reports/financial
    // For now, use mock data
    await new Promise(r => setTimeout(r, 500))
    
    if (activeReport === 'income_statement') {
      setReportData({
        revenue: {
          'Membership Dues': 125000,
          'Program Revenue': 85000,
          'Donations': 210000,
          'Grants': 150000,
          'Event Income': 45000,
          'Investment Income': 8500,
        },
        expenses: {
          'Program Services': 280000,
          'Management & General': 95000,
          'Fundraising': 48000,
        }
      })
    } else if (activeReport === '990_prep') {
      setReportData({
        totalRevenue: 623500,
        totalExpenses: 423000,
        netAssets: 1250000,
        programEfficiency: 66.2,
        compensationRatio: 45.3,
        topCompensated: [
          { name: 'Executive Director', amount: 125000 },
          { name: 'Program Manager', amount: 78000 },
          { name: 'Development Director', amount: 72000 },
        ],
        functionalExpenses: {
          program: 280000,
          management: 95000,
          fundraising: 48000,
        }
      })
    }
    
    setLoading(false)
  }

  const reports = [
    { id: 'income_statement', name: 'Statement of Activities', icon: TrendingUp, description: 'Revenue and expenses by fund' },
    { id: 'balance_sheet', name: 'Statement of Financial Position', icon: BarChart3, description: 'Assets, liabilities, net assets' },
    { id: 'cash_flow', name: 'Cash Flow Statement', icon: TrendingDown, description: 'Operating, investing, financing' },
    { id: '990_prep', name: '990 Preparation', icon: FileText, description: 'Data for Form 990 filing' },
    { id: 'donor_report', name: 'Donor Report', icon: PieChart, description: 'Giving by donor tier' },
  ]

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-600 mt-1">Generate nonprofit financial statements</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map(year => (
              <option key={year} value={year}>FY {year}</option>
            ))}
          </select>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Report Selector */}
        <div className="md:col-span-1 space-y-2">
          {reports.map(report => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id as ReportType)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                activeReport === report.id 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-white border hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <report.icon className="w-5 h-5" />
                <div>
                  <p className="font-medium">{report.name}</p>
                  <p className={`text-xs mt-1 ${activeReport === report.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {report.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Report Content */}
        <div className="md:col-span-3">
          {loading ? (
            <div className="bg-white rounded-xl border p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : activeReport === 'income_statement' ? (
            <IncomeStatement data={reportData} fiscalYear={fiscalYear} />
          ) : activeReport === '990_prep' ? (
            <Form990Prep data={reportData} fiscalYear={fiscalYear} />
          ) : (
            <div className="bg-white rounded-xl border p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Report coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IncomeStatement({ data, fiscalYear }: { data: any; fiscalYear: number }) {
  if (!data) return null

  const totalRevenue = Object.values(data.revenue).reduce((sum: number, val: any) => sum + val, 0) as number
  const totalExpenses = Object.values(data.expenses).reduce((sum: number, val: any) => sum + val, 0) as number
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-6 border-b bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900">Statement of Activities</h2>
        <p className="text-sm text-gray-500">For the Year Ended December 31, {fiscalYear}</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Revenue Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Revenue & Support
          </h3>
          <div className="space-y-2">
            {Object.entries(data.revenue).map(([name, amount]: [string, any]) => (
              <div key={name} className="flex justify-between py-2 border-b border-dashed">
                <span className="text-gray-700">{name}</span>
                <span className="font-medium">${amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold text-lg">
              <span>Total Revenue</span>
              <span className="text-green-600">${totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Expenses
          </h3>
          <div className="space-y-2">
            {Object.entries(data.expenses).map(([name, amount]: [string, any]) => (
              <div key={name} className="flex justify-between py-2 border-b border-dashed">
                <span className="text-gray-700">{name}</span>
                <span className="font-medium">${amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold text-lg">
              <span>Total Expenses</span>
              <span className="text-red-600">${totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Net Income */}
        <div className="pt-4 border-t-2">
          <div className="flex justify-between text-xl font-bold">
            <span>Change in Net Assets</span>
            <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
              ${netIncome.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Form990Prep({ data, fiscalYear }: { data: any; fiscalYear: number }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-500">Total Revenue (Part I, Line 12)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${data.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-500">Total Expenses (Part I, Line 18)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${data.totalExpenses.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-gray-500">Net Assets (Part I, Line 22)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${data.netAssets.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Program Efficiency */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Efficiency Ratio</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{ width: `${data.programEfficiency}%` }}
              />
            </div>
          </div>
          <span className="text-2xl font-bold text-green-600">{data.programEfficiency}%</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Program expenses as % of total expenses. Watchdog orgs recommend &gt;65%.
        </p>
      </div>

      {/* Functional Expenses */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Part IX: Functional Expenses</h3>
        <div className="space-y-4">
          {Object.entries(data.functionalExpenses).map(([category, amount]: [string, any]) => {
            const percent = (amount / data.totalExpenses) * 100
            return (
              <div key={category}>
                <div className="flex justify-between mb-1">
                  <span className="capitalize text-gray-700">{category}</span>
                  <span className="font-medium">
                    ${amount.toLocaleString()} ({percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      category === 'program' ? 'bg-green-500' :
                      category === 'management' ? 'bg-blue-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Compensated */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Part VII: Compensation</h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Position</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Compensation</th>
            </tr>
          </thead>
          <tbody>
            {data.topCompensated.map((person: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-3 text-gray-700">{person.name}</td>
                <td className="px-4 py-3 text-right font-medium">${person.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
