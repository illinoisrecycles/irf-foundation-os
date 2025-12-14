'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Calendar, MapPin, Users, Clock, CheckCircle, AlertCircle, 
  ArrowLeft, Loader2, Share2
} from 'lucide-react'

type Opportunity = {
  id: string
  title: string
  description: string
  date_start: string
  date_end?: string
  location: string
  is_virtual: boolean
  virtual_link?: string
  required_volunteers: number
  signed_up_count: number
  skills_needed: string[]
  requirements?: string
}

export default function OpportunityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchOpportunity()
  }, [params.id])

  const fetchOpportunity = async () => {
    // Fetch opportunity
    const { data: opp, error: oppError } = await supabase
      .from('volunteer_opportunities')
      .select('*')
      .eq('id', params.id)
      .single()

    if (oppError || !opp) {
      setLoading(false)
      return
    }

    setOpportunity(opp)

    // Check if user is already signed up
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: signup } = await supabase
        .from('volunteer_signups')
        .select('id')
        .eq('opportunity_id', params.id)
        .eq('user_id', user.id)
        .single()

      setIsSignedUp(!!signup)
    }

    setLoading(false)
  }

  const handleSignUp = async () => {
    setSigning(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push(`/login?next=/portal/volunteer/opportunities/${params.id}`)
        return
      }

      const response = await fetch('/api/volunteers/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: params.id,
          user_id: user.id,
          volunteer_email: user.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up')
      }

      setIsSignedUp(true)
      setOpportunity(prev => prev ? {
        ...prev,
        signed_up_count: prev.signed_up_count + 1
      } : null)

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  const handleCancelSignup = async () => {
    if (!confirm('Are you sure you want to cancel your signup?')) return

    setSigning(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: signup } = await supabase
      .from('volunteer_signups')
      .select('id')
      .eq('opportunity_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (signup) {
      await fetch(`/api/volunteers/signups?id=${signup.id}`, {
        method: 'DELETE'
      })

      setIsSignedUp(false)
      setOpportunity(prev => prev ? {
        ...prev,
        signed_up_count: Math.max(0, prev.signed_up_count - 1)
      } : null)
    }

    setSigning(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Opportunity Not Found</h2>
        <p className="text-gray-600 mb-6">This volunteer opportunity may have been removed.</p>
        <Link href="/portal/volunteer/opportunities" className="text-primary hover:underline">
          ← Back to Opportunities
        </Link>
      </div>
    )
  }

  const isFull = opportunity.signed_up_count >= opportunity.required_volunteers
  const spotsLeft = opportunity.required_volunteers - opportunity.signed_up_count
  const isPast = new Date(opportunity.date_start) < new Date()

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back link */}
      <Link 
        href="/portal/volunteer/opportunities"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Opportunities
      </Link>

      {/* Main Card */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="h-32 bg-gradient-to-br from-green-500 to-green-700 p-6 flex items-end">
          <h1 className="text-3xl font-bold text-white">{opportunity.title}</h1>
        </div>

        <div className="p-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Details */}
            <div className="md:col-span-2 space-y-6">
              {/* Quick Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium text-gray-900">
                      {new Date(opportunity.date_start).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(opportunity.date_start).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {opportunity.date_end && ` - ${new Date(opportunity.date_end).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">
                      {opportunity.is_virtual ? 'Virtual Event' : opportunity.location}
                    </p>
                    {opportunity.is_virtual && opportunity.virtual_link && (
                      <a 
                        href={opportunity.virtual_link} 
                        target="_blank"
                        className="text-sm text-primary hover:underline"
                      >
                        Join Link →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">About This Opportunity</h2>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 whitespace-pre-line">
                    {opportunity.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Requirements */}
              {opportunity.requirements && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
                  <p className="text-gray-700 whitespace-pre-line">{opportunity.requirements}</p>
                </div>
              )}

              {/* Skills */}
              {opportunity.skills_needed && opportunity.skills_needed.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills Needed</h2>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.skills_needed.map(skill => (
                      <span 
                        key={skill}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Signup Card */}
              <div className="bg-gray-50 rounded-xl p-6 sticky top-6">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-gray-600" />
                    <span className="text-2xl font-bold text-gray-900">
                      {opportunity.signed_up_count}
                    </span>
                    <span className="text-gray-500">/ {opportunity.required_volunteers}</span>
                  </div>
                  <p className="text-sm text-gray-500">volunteers signed up</p>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        isFull ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((opportunity.signed_up_count / opportunity.required_volunteers) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Success message */}
                {isSignedUp && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">You're signed up!</p>
                      <p className="text-sm text-green-700 mt-1">
                        We'll send you a reminder before the event.
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {isPast ? (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <p className="text-gray-600">This opportunity has passed</p>
                  </div>
                ) : isSignedUp ? (
                  <button
                    onClick={handleCancelSignup}
                    disabled={signing}
                    className="w-full py-4 border-2 border-red-500 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {signing && <Loader2 className="w-5 h-5 animate-spin" />}
                    Cancel Signup
                  </button>
                ) : isFull ? (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium text-gray-700">This opportunity is full</p>
                    <p className="text-sm text-gray-500 mt-1">Check back for more opportunities</p>
                  </div>
                ) : (
                  <button
                    onClick={handleSignUp}
                    disabled={signing}
                    className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {signing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                    {signing ? 'Signing up...' : 'Sign Up to Volunteer'}
                  </button>
                )}

                {/* Spots left */}
                {!isPast && !isSignedUp && !isFull && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} remaining
                  </p>
                )}

                {/* Share */}
                <button className="w-full mt-4 py-3 border rounded-xl text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Share Opportunity
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
