'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import { 
  CreditCard, Download, Calendar, CheckCircle, AlertCircle, 
  Clock, RefreshCw, Loader2, ChevronRight, Shield
} from 'lucide-react'
import { format } from 'date-fns'

type Invoice = {
  id: string
  invoice_number: string
  status: string
  total_cents: number
  paid_at: string | null
  created_at: string
  pdf_url: string | null
}

type Membership = {
  id: string
  status: string
  plan_name: string
  price_cents: number
  start_date: string
  end_date: string
  auto_renew: boolean
}

export default function PortalBillingPage() {
  const [membership, setMembership] = useState<Membership | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [renewLoading, setRenewLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch membership
    const { data: memberData } = await supabase
      .from('member_organizations')
      .select(`
        id, status, start_date, end_date,
        membership_plan:membership_plans(name, price_cents)
      `)
      .eq('user_id', user.id)
      .single()

    if (memberData) {
      setMembership({
        id: memberData.id,
        status: memberData.status,
        plan_name: memberData.membership_plan?.name || 'Standard',
        price_cents: memberData.membership_plan?.price_cents || 0,
        start_date: memberData.start_date,
        end_date: memberData.end_date,
        auto_renew: true
      })
    }

    // Fetch payment history / invoices
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('*')
      .eq('member_organization_id', memberData?.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setInvoices(invoiceData || [])
    setLoading(false)
  }

  const handleRenew = async () => {
    setRenewLoading(true)
    
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'membership_renewal',
          success_url: `${window.location.origin}/portal/billing?renewed=true`,
          cancel_url: window.location.href
        })
      })

      const { sessionId } = await res.json()
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
      await stripe?.redirectToCheckout({ sessionId })
    } catch (error) {
      console.error('Renewal error:', error)
    }
    
    setRenewLoading(false)
  }

  const handleDownloadReceipt = async (invoiceId: string) => {
    // In production, generate PDF or redirect to Stripe receipt
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const isExpiringSoon = membership?.end_date && 
    new Date(membership.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  
  const isExpired = membership?.status === 'expired' || 
    (membership?.end_date && new Date(membership.end_date) < new Date())

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Membership</h1>
        <p className="text-gray-600 mt-2">Manage your membership and view payment history</p>
      </div>

      {/* Membership Status Card */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className={`p-6 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isExpired ? 'bg-red-100' : isExpiringSoon ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                {isExpired ? (
                  <AlertCircle className="w-7 h-7 text-red-600" />
                ) : isExpiringSoon ? (
                  <Clock className="w-7 h-7 text-yellow-600" />
                ) : (
                  <CheckCircle className="w-7 h-7 text-green-600" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {membership?.plan_name || 'No Active Membership'}
                </h2>
                <p className={`text-sm mt-1 ${
                  isExpired ? 'text-red-700' : isExpiringSoon ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {isExpired ? 'Membership Expired' : 
                   isExpiringSoon ? 'Expiring Soon' : 
                   'Active Membership'}
                </p>
              </div>
            </div>
            {(isExpired || isExpiringSoon) && (
              <button
                onClick={handleRenew}
                disabled={renewLoading}
                className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {renewLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Renew Now
              </button>
            )}
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Member Since</p>
            <p className="text-lg font-semibold text-gray-900">
              {membership?.start_date ? format(new Date(membership.start_date), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expires On</p>
            <p className="text-lg font-semibold text-gray-900">
              {membership?.end_date ? format(new Date(membership.end_date), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Annual Dues</p>
            <p className="text-lg font-semibold text-gray-900">
              ${((membership?.price_cents || 0) / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Auto-Renew</p>
            <p className="text-lg font-semibold text-gray-900">
              {membership?.auto_renew ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <button className="bg-white rounded-xl border p-6 text-left hover:shadow-lg transition-shadow group">
          <CreditCard className="w-8 h-8 text-primary mb-4" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary">Update Payment Method</h3>
          <p className="text-sm text-gray-500 mt-1">Change your card on file</p>
          <ChevronRight className="w-5 h-5 text-gray-400 mt-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <button className="bg-white rounded-xl border p-6 text-left hover:shadow-lg transition-shadow group">
          <Shield className="w-8 h-8 text-primary mb-4" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary">Manage Auto-Renew</h3>
          <p className="text-sm text-gray-500 mt-1">Toggle automatic renewal</p>
          <ChevronRight className="w-5 h-5 text-gray-400 mt-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <button className="bg-white rounded-xl border p-6 text-left hover:shadow-lg transition-shadow group">
          <Download className="w-8 h-8 text-primary mb-4" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary">Download Tax Receipt</h3>
          <p className="text-sm text-gray-500 mt-1">Get receipt for tax purposes</p>
          <ChevronRight className="w-5 h-5 text-gray-400 mt-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No payment history yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">
                    {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    ${(invoice.total_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownloadReceipt(invoice.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
