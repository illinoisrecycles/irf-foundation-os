'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Award, 
  Plus, 
  Search, 
  Download,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Users,
  Calendar
} from 'lucide-react'

type Grant = {
  id: string
  applicant_name: string
  applicant_email: string
  project_title: string
  amount_requested: number
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  program: string
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  draft: { color: 'bg-gray-100 text-gray-700', icon: FileText },
  submitted: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  under_review: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
  withdrawn: { color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

const mockGrants: Grant[] = [
  {
    id: '1',
    applicant_name: 'Springfield Recycling Coalition',
    applicant_email: 'grants@springfieldrecycling.org',
    project_title: 'Community Composting Initiative',
    amount_requested: 1500000,
    status: 'under_review',
    program: '2025 Innovation Grant',
    submitted_at: '2024-12-01T10:00:00Z',
    reviewed_at: null,
    created_at: '2024-11-15T09:00:00Z',
  },
  {
    id: '2',
    applicant_name: 'Champaign Waste Reduction Project',
    applicant_email: 'info@champaignwaste.org',
    project_title: 'School Recycling Education Program',
    amount_requested: 750000,
    status: 'approved',
    program: '2025 Innovation Grant',
    submitted_at: '2024-11-20T14:00:00Z',
    reviewed_at: '2024-12-05T10:00:00Z',
    created_at: '2024-11-10T11:00:00Z',
  },
  {
    id: '3',
    applicant_name: 'Peoria Green Initiative',
    applicant_email: 'grants@peoriagreen.org',
    project_title: 'Municipal Recycling Infrastructure Upgrade',
    amount_requested: 2500000,
    status: 'submitted',
    program: '2025 Innovation Grant',
    submitted_at: '2024-12-10T09:30:00Z',
    reviewed_at: null,
    created_at: '2024-12-05T08:00:00Z',
  },
  {
    id: '4',
    applicant_name: 'Rockford Circular Economy Hub',
    applicant_email: 'apply@rockfordcircular.org',
    project_title: 'Textile Recycling Pilot Program',
    amount_requested: 1000000,
    status: 'rejected',
    program: '2024 Innovation Grant',
    submitted_at: '2024-10-15T11:00:00Z',
    reviewed_at: '2024-11-01T15:00:00Z',
    created_at: '2024-10-01T10:00:00Z',
  },
]

export default function GrantsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('')
  const [activeTab, setActiveTab] = React.useState<string>('all')

  const grants = mockGrants

  const filteredGrants = React.useMemo(() => {
    let result = [...grants]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(g => 
        g.applicant_name.toLowerCase().includes(q) ||
        g.project_title.toLowerCase().includes(q) ||
        g.program.toLowerCase().includes(q)
      )
    }

    if (statusFilter) {
      result = result.filter(g => g.status === statusFilter)
    }

    if (activeTab !== 'all') {
      result = result.filter(g => g.status === activeTab)
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [grants, searchQuery, statusFilter, activeTab])

  const totalRequested = grants.filter(g => g.status !== 'rejected' && g.status !== 'withdrawn')
    .reduce((sum, g) => sum + g.amount_requested, 0)
  const totalApproved = grants.filter(g => g.status === 'approved')
    .reduce((sum, g) => sum + g.amount_requested, 0)
  const pendingReview = grants.filter(g => g.status === 'submitted' || g.status === 'under_review').length

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const tabs = [
    { id: 'all', label: 'All', count: grants.length },
    { id: 'submitted', label: 'Submitted', count: grants.filter(g => g.status === 'submitted').length },
    { id: 'under_review', label: 'Under Review', count: grants.filter(g => g.status === 'under_review').length },
    { id: 'approved', label: 'Approved', count: grants.filter(g => g.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: grants.filter(g => g.status === 'rejected').length },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Award className="h-6 w-6 text-primary" />
            </div>
            Grants
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredGrants.length} application{filteredGrants.length !== 1 ? 's' : ''} • Manage grant programs and reviews
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            New Program
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{grants.length}</p>
              <p className="text-sm text-muted-foreground">Total Applications</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingReview}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRequested)}</p>
              <p className="text-sm text-muted-foreground">Total Requested</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalApproved)}</p>
              <p className="text-sm text-muted-foreground">Total Approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            {tab.label}
            <span className={`text-xs rounded-full px-2 py-0.5 ${
              activeTab === tab.id 
                ? 'bg-primary-foreground/20' 
                : 'bg-background'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-lg border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Grants List */}
      {filteredGrants.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Award className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No applications found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'Try adjusting your search' : 'No grant applications in this category'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGrants.map((grant, i) => {
            const StatusIcon = statusConfig[grant.status].icon
            return (
              <div 
                key={grant.id}
                className="rounded-xl border bg-card p-6 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs rounded-full px-2 py-1 font-medium flex items-center gap-1 ${statusConfig[grant.status].color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {grant.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs rounded-full border px-2 py-1 text-muted-foreground">
                        {grant.program}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-1">{grant.project_title}</h3>
                    <p className="text-sm text-muted-foreground">{grant.applicant_name}</p>
                    
                    <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium text-foreground">{formatCurrency(grant.amount_requested)}</span>
                        <span>requested</span>
                      </div>
                      {grant.submitted_at && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>Submitted {formatDate(grant.submitted_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(grant.status === 'submitted' || grant.status === 'under_review') && (
                      <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
                        Review
                      </button>
                    )}
                    <button className="rounded-md p-2 hover:bg-muted/50 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
