'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  CreditCard,
  Receipt,
  Download,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

// Mock data for demo
const revenueData = [
  { month: 'Jan', revenue: 12500, expenses: 8200, donations: 3500 },
  { month: 'Feb', revenue: 15800, expenses: 9100, donations: 4200 },
  { month: 'Mar', revenue: 18200, expenses: 10500, donations: 5100 },
  { month: 'Apr', revenue: 16400, expenses: 9800, donations: 4800 },
  { month: 'May', revenue: 21000, expenses: 11200, donations: 6200 },
  { month: 'Jun', revenue: 24500, expenses: 12800, donations: 7500 },
  { month: 'Jul', revenue: 22800, expenses: 11500, donations: 6800 },
  { month: 'Aug', revenue: 26200, expenses: 13200, donations: 8100 },
  { month: 'Sep', revenue: 28500, expenses: 14100, donations: 9200 },
  { month: 'Oct', revenue: 31200, expenses: 15500, donations: 10500 },
  { month: 'Nov', revenue: 29800, expenses: 14800, donations: 9800 },
  { month: 'Dec', revenue: 35000, expenses: 16200, donations: 12000 },
]

const revenueBySource = [
  { name: 'Memberships', value: 45000, color: 'hsl(var(--primary))' },
  { name: 'Donations', value: 28000, color: 'hsl(142 76% 36%)' },
  { name: 'Events', value: 18000, color: 'hsl(221 83% 53%)' },
  { name: 'Grants', value: 32000, color: 'hsl(38 92% 50%)' },
  { name: 'Other', value: 5000, color: 'hsl(var(--muted-foreground))' },
]

const recentTransactions = [
  { id: '1', description: 'Membership - Corporate Plan', amount: 199900, type: 'income', date: '2024-12-13', status: 'succeeded' },
  { id: '2', description: 'Conference Registration', amount: 15000, type: 'income', date: '2024-12-12', status: 'succeeded' },
  { id: '3', description: 'Donation - Sarah Johnson', amount: 50000, type: 'income', date: '2024-12-12', status: 'succeeded' },
  { id: '4', description: 'Venue Deposit - Conference', amount: -250000, type: 'expense', date: '2024-12-11', status: 'pending' },
  { id: '5', description: 'Grant Disbursement', amount: -750000, type: 'expense', date: '2024-12-10', status: 'succeeded' },
  { id: '6', description: 'Recurring Donation', amount: 10000, type: 'income', date: '2024-12-10', status: 'succeeded' },
]

const stats = [
  { 
    name: 'Total Revenue (YTD)', 
    value: '$282,000', 
    change: '+18.2%', 
    trend: 'up', 
    icon: DollarSign,
    color: 'bg-green-100 text-green-600'
  },
  { 
    name: 'Total Expenses (YTD)', 
    value: '$147,100', 
    change: '+12.4%', 
    trend: 'up', 
    icon: CreditCard,
    color: 'bg-red-100 text-red-600'
  },
  { 
    name: 'Net Income', 
    value: '$134,900', 
    change: '+24.8%', 
    trend: 'up', 
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-600'
  },
  { 
    name: 'Outstanding Invoices', 
    value: '$12,450', 
    change: '-8.3%', 
    trend: 'down', 
    icon: Receipt,
    color: 'bg-yellow-100 text-yellow-600'
  },
]

export default function FinancesPage() {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(cents) / 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Status']
    const rows = recentTransactions.map(t => [
      t.date,
      t.description,
      formatCurrency(t.amount),
      t.type,
      t.status
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finances-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            Finances
          </h1>
          <p className="text-muted-foreground mt-1">
            Financial overview and transaction management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button 
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div 
            key={stat.name}
            className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                stat.trend === 'up' && stat.name.includes('Expense')
                  ? 'bg-red-100 text-red-700'
                  : stat.trend === 'up'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold">Revenue vs Expenses</h3>
            <p className="text-sm text-muted-foreground">Monthly financial performance</p>
          </div>
          <div className="p-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderRadius: '8px', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(142 76% 36%)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(0 84% 60%)" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Revenue by Source */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 border-b">
            <h3 className="font-semibold">Revenue by Source</h3>
            <p className="text-sm text-muted-foreground">YTD breakdown</p>
          </div>
          <div className="p-6">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBySource}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {revenueBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {revenueBySource.map((source) => (
                <div key={source.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <span>{source.name}</span>
                  </div>
                  <span className="font-medium">${(source.value / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Recent Transactions</h3>
            <p className="text-sm text-muted-foreground">Latest financial activity</p>
          </div>
          <button className="text-sm text-primary hover:underline">View All</button>
        </div>
        <div className="divide-y">
          {recentTransactions.map((tx, i) => (
            <div 
              key={tx.id} 
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors animate-in fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2 ${tx.amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.amount > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${
                    tx.status === 'succeeded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {tx.status}
                  </span>
                </div>
                <button className="rounded-md p-2 hover:bg-muted/50 transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
