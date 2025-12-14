'use client'

import * as React from 'react'
import { CreditCard, RefreshCw, Loader2 } from 'lucide-react'
import DigitalMemberCard from '@/components/members/DigitalMemberCard'

export default function MembershipCardPage() {
  const [card, setCard] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchCard = async () => {
    setLoading(true)
    try {
      // In real app, get member ID from session
      const response = await fetch('/api/member-cards?member_id=demo-member-id')
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      setCard(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchCard()
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 mb-4">{error}</p>
          <button onClick={fetchCard} className="px-4 py-2 bg-red-600 text-white rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Your Membership Card</h1>
        <p className="text-gray-500">Show this at events or to verify your membership</p>
      </div>

      {card && <DigitalMemberCard card={card} onRefresh={fetchCard} />}

      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How to use your card</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• Tap the card to reveal your QR code</li>
          <li>• Staff can scan the QR to verify your membership</li>
          <li>• Save the QR code to your phone for offline access</li>
          <li>• Add to Apple Wallet or Google Wallet (coming soon)</li>
        </ul>
      </div>
    </div>
  )
}
