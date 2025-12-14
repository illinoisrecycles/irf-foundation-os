'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  CreditCard, 
  Search, 
  Download,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ExternalLink,
  Filter
} from 'lucide-react'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

type Payment = {
  id: string
  stripe_payment_id: string | null
  payer_email: string
  payer_name: string | null
  amount_cents: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'cancelled'
  payment_type: 'membership' | 'donation' | 'event' | 'other'
  description: string | null
  reference_type: string | null
  reference_id: string | null
  failure_reason: string | null
  refunded_at: string | null
  created_at: string
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  succeeded: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  failed: { color: 'bg-red-100 text-red-700', icon: XCircle },
  refunded: { color: 'bg-gray-100 text-gray-700', icon: RefreshCw },
  cancelled: { color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

const mockPayments: Payment[] = [
  {
    id: '1',
    stripe_payment_id: 'pi_3abc123',
    payer_email: 'sarah@example.com',
    payer_name: 'Sarah Johnson',
    amount_cents: 45000,
    currency: 'usd',
    status: 'succeeded',
    payment_type: 'membership',
    description: 'Professional Membership - Annual',
    reference_type: 'membership',
    reference_id: 'mem_123',
    failure_reason: null,
    refunded_at: null,
    created_at: '2024-12-13T10:30:00Z',
  },
  {
    id: '2',
    stripe_payment_id: 'pi_3def456',
    payer_email: 'mike@recyclers.com',
    payer_name: 'Mike Chen',
    amount_cents: 15000,
    currency: 'usd',
    status: 'succeeded',
    payment_type: 'event',
    description: 'Circularity Conference - Early Bird',
    reference_type: 'event_registration',
    reference_id: 'reg_456',
    failure_reason: null,
    refunded_at: null,
    created_at: '2024-12-12T15:45:00Z',
  },
  {
    id: '3',
    stripe_payment_id: 'pi_3ghi789',
    payer_email: 'donor@gmail.com',
    payer_name: null,
    amount_cents: 50000,
    currency: 'usd',
    status: 'succeeded',
    payment_type: 'donation',
    description: 'General Fund Donation',
    reference_type: 'donation',
    reference_id: 'don_789',
    failure_reason: null,
    refunded_at: null,
    created_at: '2024-12-12T09:15:00Z',
  },
  {
    id: '4',
    stripe_payment_id: 'pi_3jkl012',
    payer_email: 'failed@example.com',
    payer_name: 'Test User',
    amount_cents: 19900,
    currency: 'usd',
    status: 'failed',
    payment_type: 'membership',
    description: 'Corporate Membership - Annual',
    reference_type: 'membership',
    reference_id: 'mem_012',
    failure_reason: 'Card declined',
    refunded_at: null,
    created_at: '2024-12-11T14:20:00Z',
  },
  {
    id: '5',
    stripe_payment_id: 'pi_3mno345',
    payer_email: 'refund@example.com',
    payer_name: 'Jane Doe',
    amount_cents: 15000,
    currency: 'usd',
    status: 'refunded',
    payment_type: 'event',
    description: 'Webinar Registration',
    reference_type: 'event_registration',
    reference_id: 'reg_345',
    failure_reason: null,
    refunded_at: '2024-12-10T11:00:00Z',
    created_at: '2024-12-08T16:30:00Z',
  },
]

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('')
  const [typeFilter, setTypeFilter] = React.useState<string>('')

  const { data, isLoading } = useQuery<{ payments: Payment[] }>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch(`/api/payments?orgId=${encodeURIComponent(ORG_ID)}`)
      if (!res.ok) throw new Error('Failed to fetch payments')
      const json = await res.json()
      return { payments: json.payments?.length ? json.payments : mockPayments }
    },
  })

  const payments: Payment[] = data?.payments ?? mockPayments

  const filteredPayments = React.useMemo(() => {
    let result = [...payments]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.payer_email.toLowerCase().includes(q) ||
        p.payer_name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.stripe_payment_id?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) {
      result = result.filter(p => p.status === statusFilter)
    }

    if (typeFilter) {
      result = result.filter(p => p.payment_type === typeFilter)
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [payments, searchQuery, statusFilter, typeFilter])

  const totalSucceeded = payments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + p.amount_cents, 0)
  const totalFailed = payments.filter(p => p.status === 'failed').reduce((sum, p) => sum + p.amount_cents, 0)
  const totalRefunded = payments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + p.amount_cents, 0)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const exportCSV = () => {
    const headers = ['Date', 'Payer', 'Email', 'Amount', 'Type', 'Status', 'Description', 'Stripe ID']
    const rows = filteredPayments.map(p => [
      p.created_at,
      p.payer_name || 'N/A',
      p.payer_email,
      formatCurrency(p.amount_cents),
      p.payment_type,
      p.status,
      p.description || '',
      p.stripe_payment_id || '',
    ])
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} • View and manage transactions
          </p>
        </div>

        <button 
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSucceeded)}</p>
              <p className="text-sm text-muted-foreground">Succeeded</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalFailed)}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <RefreshCw className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRefunded)}</p>
              <p className="text-sm text-muted-foreground">Refunded</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{payments.length}</p>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search payments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-lg border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All types</option>
          <option value="membership">Membership</option>
          <option value="donation">Donation</option>
          <option value="event">Event</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading payments...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No payments found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter || typeFilter ? 'Try adjusting your filters' : 'Payments will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayments.map((payment, i) => {
                  const StatusIcon = statusConfig[payment.status].icon
                  return (
                    <tr 
                      key={payment.id} 
                      className="hover:bg-muted/30 transition-colors animate-in fade-in"
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{payment.payer_name || 'Anonymous'}</div>
                          <div className="text-xs text-muted-foreground">{payment.payer_email}</div>
                          {payment.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{payment.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${
                          payment.status === 'succeeded' ? 'text-green-600' :
                          payment.status === 'refunded' ? 'text-gray-500 line-through' :
                          payment.status === 'failed' ? 'text-red-600' :
                          ''
                        }`}>
                          {formatCurrency(payment.amount_cents)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs rounded-full border px-2 py-1 capitalize">
                          {payment.payment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-1 font-medium flex items-center gap-1 w-fit ${statusConfig[payment.status].color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {payment.status}
                        </span>
                        {payment.failure_reason && (
                          <div className="text-xs text-red-600 mt-1">{payment.failure_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {payment.stripe_payment_id && (
                            <a
                              href={`https://dashboard.stripe.com/payments/${payment.stripe_payment_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md p-2 hover:bg-muted/50 transition-colors"
                              title="View in Stripe"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button className="rounded-md p-2 hover:bg-muted/50 transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
