'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Gift, 
  Plus, 
  Search, 
  Download,
  MoreHorizontal,
  Mail,
  Receipt,
  RefreshCw,
  TrendingUp,
  Calendar,
  DollarSign
} from 'lucide-react'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

type Donation = {
  id: string
  donor_name: string | null
  donor_email: string
  amount_cents: number
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  is_recurring: boolean
  campaign: string | null
  receipt_sent_at: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  succeeded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
}

const mockDonations: Donation[] = [
  {
    id: '1',
    donor_name: 'Sarah Johnson',
    donor_email: 'sarah@example.com',
    amount_cents: 50000,
    status: 'succeeded',
    is_recurring: true,
    campaign: 'Annual Appeal 2025',
    receipt_sent_at: '2024-12-10T10:00:00Z',
    created_at: '2024-12-10T09:30:00Z',
  },
  {
    id: '2',
    donor_name: 'Anonymous',
    donor_email: 'donor@gmail.com',
    amount_cents: 25000,
    status: 'succeeded',
    is_recurring: false,
    campaign: null,
    receipt_sent_at: null,
    created_at: '2024-12-09T15:20:00Z',
  },
  {
    id: '3',
    donor_name: 'GreenCycle LLC',
    donor_email: 'giving@greencycle.com',
    amount_cents: 100000,
    status: 'succeeded',
    is_recurring: false,
    campaign: 'Corporate Giving',
    receipt_sent_at: '2024-12-08T12:00:00Z',
    created_at: '2024-12-08T11:45:00Z',
  },
  {
    id: '4',
    donor_name: 'Mike Chen',
    donor_email: 'mike@recyclers.com',
    amount_cents: 10000,
    status: 'succeeded',
    is_recurring: true,
    campaign: null,
    receipt_sent_at: null,
    created_at: '2024-12-07T08:15:00Z',
  },
]

export default function DonationsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('')

  const { data, isLoading } = useQuery<{ donations: Donation[] }>({
    queryKey: ['donations'],
    queryFn: async () => {
      const res = await fetch(`/api/donations?orgId=${encodeURIComponent(ORG_ID)}`)
      if (!res.ok) throw new Error('Failed to fetch donations')
      const json = await res.json()
      return { donations: json.donations?.length ? json.donations : mockDonations }
    },
  })

  const donations: Donation[] = data?.donations ?? mockDonations

  const filteredDonations = React.useMemo(() => {
    let result = [...donations]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d => 
        d.donor_name?.toLowerCase().includes(q) ||
        d.donor_email.toLowerCase().includes(q) ||
        d.campaign?.toLowerCase().includes(q)
      )
    }

    if (statusFilter) {
      result = result.filter(d => d.status === statusFilter)
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [donations, searchQuery, statusFilter])

  const totalDonations = donations.filter(d => d.status === 'succeeded').reduce((sum, d) => sum + d.amount_cents, 0)
  const recurringCount = donations.filter(d => d.is_recurring && d.status === 'succeeded').length
  const pendingReceipts = donations.filter(d => d.status === 'succeeded' && !d.receipt_sent_at).length

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
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            Donations
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredDonations.length} donation{filteredDonations.length !== 1 ? 's' : ''} • Manage gifts and receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            Record Donation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalDonations)}</p>
              <p className="text-sm text-muted-foreground">Total Received</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Gift className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{donations.length}</p>
              <p className="text-sm text-muted-foreground">Total Donations</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <RefreshCw className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recurringCount}</p>
              <p className="text-sm text-muted-foreground">Recurring Donors</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Receipt className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingReceipts}</p>
              <p className="text-sm text-muted-foreground">Pending Receipts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search donations..."
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
      </div>

      {/* Donations Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading donations...</p>
          </div>
        ) : filteredDonations.length === 0 ? (
          <div className="p-12 text-center">
            <Gift className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No donations found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter ? 'Try adjusting your filters' : 'Record your first donation to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Donor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campaign</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Receipt</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDonations.map((donation, i) => (
                  <tr 
                    key={donation.id} 
                    className="hover:bg-muted/30 transition-colors animate-in fade-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {donation.donor_name || 'Anonymous'}
                          {donation.is_recurring && (
                            <span title="Recurring donor" className="inline-flex items-center">
                              <RefreshCw className="h-3 w-3 text-purple-500" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{donation.donor_email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-green-600">{formatCurrency(donation.amount_cents)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusColors[donation.status]}`}>
                        {donation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {donation.campaign || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(donation.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {donation.receipt_sent_at ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          Sent
                        </span>
                      ) : donation.status === 'succeeded' ? (
                        <button className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Send
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded-md p-2 hover:bg-muted/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
