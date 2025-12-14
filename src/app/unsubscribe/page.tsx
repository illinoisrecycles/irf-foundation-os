'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, CheckCircle, AlertCircle } from 'lucide-react'

export default function UnsubscribePage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = React.useState<'pending' | 'success' | 'error'>('pending')
  const [loading, setLoading] = React.useState(false)
  const [reason, setReason] = React.useState('')

  const email = searchParams.get('email')
  const orgId = searchParams.get('org')
  const campaignId = searchParams.get('campaign')

  const handleUnsubscribe = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          organization_id: orgId,
          campaign_id: campaignId,
          reason,
        }),
      })

      if (response.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
          <p className="text-gray-600 mb-6">
            You've been successfully unsubscribed from our emails.
          </p>
          <p className="text-sm text-gray-400">
            Changed your mind? Contact us to resubscribe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Unsubscribe from emails
        </h1>
        <p className="text-gray-600 text-center mb-6">
          {email ? `We'll remove ${email} from our mailing list.` : 'Confirm your unsubscription.'}
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Help us improve (optional)
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Select a reason...</option>
            <option value="too_many">Too many emails</option>
            <option value="not_relevant">Content not relevant</option>
            <option value="never_subscribed">I never subscribed</option>
            <option value="other">Other</option>
          </select>
        </div>

        {status === 'error' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5" />
            Something went wrong. Please try again.
          </div>
        )}

        <button
          onClick={handleUnsubscribe}
          disabled={loading}
          className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Unsubscribe'}
        </button>

        <p className="text-center text-sm text-gray-400 mt-4">
          You can always resubscribe from your account settings.
        </p>
      </div>
    </div>
  )
}
