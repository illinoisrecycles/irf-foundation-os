'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  FileText, DollarSign, Calendar, CheckCircle, AlertCircle, 
  Clock, Upload, ChevronRight, Loader2, TrendingUp
} from 'lucide-react'

type Grant = {
  id: string
  organization_name: string
  requested_amount_cents: number
  status: string
  submitted_at: string
  program: {
    title: string
  }
  disbursements: {
    amount_cents: number
    disbursed_at: string
  }[]
  reports: {
    id: string
    report_type: string
    due_date: string
    status: string
  }[]
}

export default function GranteeDashboard() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalAwarded: 0,
    totalDisbursed: 0,
    activeGrants: 0,
    reportsDue: 0,
  })
  const supabase = createClient()

  useEffect(() => {
    fetchGrants()
  }, [])

  const fetchGrants = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch grants where user is the applicant
    const { data, error } = await supabase
      .from('grant_applications')
      .select(`
        *,
        program:grant_programs(title),
        disbursements:grant_disbursements(*),
        reports:grant_reports(*)
      `)
      .eq('applicant_profile_id', user.id)
      .in('status', ['approved', 'funded', 'completed'])
      .order('submitted_at', { ascending: false })

    if (!error && data) {
      setGrants(data)

      // Calculate stats
      const totalAwarded = data.reduce((sum, g) => sum + (g.requested_amount_cents || 0), 0)
      const totalDisbursed = data.reduce((sum, g) => 
        sum + g.disbursements.reduce((ds, d) => ds + (d.amount_cents || 0), 0), 0)
      const activeGrants = data.filter(g => g.status === 'funded').length
      const reportsDue = data.reduce((count, g) => 
        count + g.reports.filter(r => r.status === 'pending' && new Date(r.due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length, 0)

      setStats({ totalAwarded, totalDisbursed, activeGrants, reportsDue })
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Grantee Portal</h1>
        <p className="text-gray-600 mt-2">Manage your grants, submit reports, and track disbursements</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Awarded</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalAwarded / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Disbursed</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(stats.totalDisbursed / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Grants</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeGrants}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              stats.reportsDue > 0 ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <Clock className={`w-6 h-6 ${stats.reportsDue > 0 ? 'text-orange-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Reports Due</p>
              <p className={`text-2xl font-bold ${stats.reportsDue > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {stats.reportsDue}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Due Alert */}
      {stats.reportsDue > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-8 h-8 text-orange-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-orange-900">Reports Due Soon</h3>
            <p className="text-orange-700 mt-1">
              You have {stats.reportsDue} report{stats.reportsDue > 1 ? 's' : ''} due within the next 30 days.
            </p>
            <Link 
              href="/grantee/reports" 
              className="inline-block mt-3 text-orange-700 font-medium hover:underline"
            >
              View Reports →
            </Link>
          </div>
        </div>
      )}

      {/* Grants List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Your Grants</h2>
        </div>

        {grants.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No active grants</p>
            <p className="text-sm text-gray-500">
              Your approved grants will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {grants.map(grant => {
              const pendingReports = grant.reports.filter(r => r.status === 'pending')
              const nextReport = pendingReports.sort((a, b) => 
                new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
              )[0]

              return (
                <Link
                  key={grant.id}
                  href={`/grantee/grants/${grant.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {grant.program?.title || 'Grant'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          grant.status === 'funded' 
                            ? 'bg-green-100 text-green-700'
                            : grant.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {grant.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${(grant.requested_amount_cents / 100).toLocaleString()} awarded
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Approved {new Date(grant.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      {nextReport && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="text-orange-600">
                            {nextReport.report_type} report due {new Date(nextReport.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/grantee/reports/new"
          className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow text-center"
        >
          <Upload className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Submit Report</h3>
          <p className="text-sm text-gray-500 mt-1">Upload progress or final report</p>
        </Link>

        <Link
          href="/grantee/documents"
          className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow text-center"
        >
          <FileText className="w-10 h-10 text-purple-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Documents</h3>
          <p className="text-sm text-gray-500 mt-1">View grant agreements & receipts</p>
        </Link>

        <Link
          href="/grantee/support"
          className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow text-center"
        >
          <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Get Help</h3>
          <p className="text-sm text-gray-500 mt-1">Contact your program officer</p>
        </Link>
      </div>
    </div>
  )
}
