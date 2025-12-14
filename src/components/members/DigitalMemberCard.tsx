'use client'

import * as React from 'react'
import { Download, RefreshCw, Share2, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react'

type MemberCard = {
  memberId: string
  memberName: string
  organizationName: string
  membershipType: string
  memberNumber: string
  joinedDate: string
  expiresDate: string
  status: 'active' | 'expired' | 'pending'
  qrCodeDataUrl: string
  verificationUrl: string
  engagementTier?: string
  badges: string[]
}

type Props = {
  card: MemberCard
  onRefresh?: () => void
}

export default function DigitalMemberCard({ card, onRefresh }: Props) {
  const [flipped, setFlipped] = React.useState(false)

  const statusColors = {
    active: 'bg-green-500',
    expired: 'bg-red-500',
    pending: 'bg-yellow-500',
  }

  const statusIcons = {
    active: <CheckCircle className="w-4 h-4" />,
    expired: <XCircle className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="w-full max-w-md mx-auto perspective-1000">
      <div 
        className={`relative w-full aspect-[1.6/1] cursor-pointer transition-transform duration-500 transform-style-3d ${
          flipped ? 'rotate-y-180' : ''
        }`}
        onClick={() => setFlipped(!flipped)}
      >
        {/* FRONT OF CARD */}
        <div className={`absolute inset-0 backface-hidden ${flipped ? 'invisible' : ''}`}>
          <div className="h-full bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{card.organizationName}</h2>
                <p className="text-blue-200 text-sm">{card.membershipType}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[card.status]} bg-opacity-20`}>
                {statusIcons[card.status]}
                {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
              </div>
            </div>

            {/* Member Name */}
            <div className="mb-4">
              <p className="text-2xl font-bold">{card.memberName}</p>
              <p className="text-blue-300 text-sm">Member #{card.memberNumber}</p>
            </div>

            {/* Badges */}
            {card.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {card.badges.map((badge, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">
                    {badge}
                  </span>
                ))}
              </div>
            )}

            {/* Dates */}
            <div className="flex justify-between text-sm mt-auto">
              <div>
                <p className="text-blue-300">Member Since</p>
                <p className="font-medium">{formatDate(card.joinedDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-300">Valid Until</p>
                <p className="font-medium">{formatDate(card.expiresDate)}</p>
              </div>
            </div>

            {/* Tap hint */}
            <p className="text-center text-blue-300 text-xs mt-4">Tap to view QR code</p>
          </div>
        </div>

        {/* BACK OF CARD (QR Code) */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 ${!flipped ? 'invisible' : ''}`}>
          <div className="h-full bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center">
            <img src={card.qrCodeDataUrl} alt="Membership QR Code" className="w-40 h-40 mb-4" />
            <p className="text-gray-900 font-semibold">{card.memberName}</p>
            <p className="text-gray-500 text-sm">{card.membershipType}</p>
            <p className="text-gray-400 text-xs mt-2">Scan to verify membership</p>
            <p className="text-center text-gray-400 text-xs mt-4">Tap to flip back</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 mt-6">
        <button 
          onClick={(e) => { e.stopPropagation(); onRefresh?.() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button 
          onClick={(e) => { 
            e.stopPropagation()
            // Download QR as image
            const link = document.createElement('a')
            link.download = `membership-${card.memberNumber}.png`
            link.href = card.qrCodeDataUrl
            link.click()
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200"
        >
          <Download className="w-4 h-4" />
          Save QR
        </button>
        <button 
          onClick={(e) => { e.stopPropagation() }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700"
        >
          <Wallet className="w-4 h-4" />
          Add to Wallet
        </button>
      </div>
    </div>
  )
}
