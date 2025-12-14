'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Sparkles, Loader2, Copy, Check, ArrowLeft, Building2, Mail,
  DollarSign, Calendar, CheckCircle, XCircle, AlertTriangle,
  User, FileText, Star
} from 'lucide-react'

type Application = {
  id: string
  organization_name: string
  contact_email: string
  requested_amount_cents: number
  status: string
  submitted_at: string
  data: Record<string, any>
  ai_summary: string | null
  ai_summary_generated_at: string | null
  ai_risk_flags: string[] | null
  ai_strength_highlights: string[] | null
  average_score: number | null
  total_reviews: number
  program: {
    title: string
    budget_cents: number
  }
  reviews: {
    id: string
    score: number
    comments: string
    reviewed_at: string
    reviewer: { email: string }
  }[]
}

export default function GrantReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [score, setScore] = useState<number>(0)
  const [comments, setComments] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchApplication()
  }, [params.id])

  const fetchApplication = async () => {
    const { data, error } = await supabase
      .from('grant_applications')
      .select(`
        *,
        program:grant_programs(title, budget_cents),
        reviews:grant_reviews(
          id, score, comments, reviewed_at,
          reviewer:profiles(email)
        )
      `)
      .eq('id', params.id)
      .single()

    if (!error && data) {
      setApplication(data)
    }
    setLoading(false)
  }

  const generateSummary = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/grants/ai-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: params.id }),
      })

      if (res.ok) {
        const data = await res.json()
        setApplication(prev => prev ? {
          ...prev,
          ai_summary: data.summary,
          ai_summary_generated_at: data.generated_at,
          ai_risk_flags: data.risks,
          ai_strength_highlights: data.strengths,
        } : null)
      }
    } catch (err) {
      console.error('Summary generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const copySummary = () => {
    if (application?.ai_summary) {
      navigator.clipboard.writeText(application.ai_summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const submitReview = async () => {
    if (!score) return
    setSubmittingReview(true)

    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase.from('grant_reviews').insert({
      application_id: params.id,
      reviewer_profile_id: user?.id,
      score,
      comments,
    })

    if (!error) {
      fetchApplication()
      setScore(0)
      setComments('')
    }
    setSubmittingReview(false)
  }

  const updateStatus = async (newStatus: string) => {
    await supabase
      .from('grant_applications')
      .update({ status: newStatus })
      .eq('id', params.id)
    
    fetchApplication()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Application not found</p>
        <Link href="/admin/grants" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Grants
        </Link>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    funded: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/grants/applications" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grant Application Review</h1>
            <p className="text-gray-600">{application.program?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-full font-medium ${statusColors[application.status]}`}>
            {application.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary Section */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900">AI Analysis</h2>
                </div>
                <button
                  onClick={generateSummary}
                  disabled={generating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {application.ai_summary ? 'Regenerate' : 'Generate Summary'}
                </button>
              </div>
            </div>

            {application.ai_summary ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    Generated {new Date(application.ai_summary_generated_at!).toLocaleString()}
                  </p>
                  <button onClick={copySummary} className="p-2 hover:bg-gray-100 rounded-lg">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                  {application.ai_summary}
                </div>

                {/* Strengths & Risks */}
                {(application.ai_strength_highlights?.length || application.ai_risk_flags?.length) && (
                  <div className="grid md:grid-cols-2 gap-4 mt-6 pt-6 border-t">
                    {application.ai_strength_highlights?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Strengths
                        </h4>
                        <ul className="text-sm text-green-800 space-y-1">
                          {application.ai_strength_highlights.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {application.ai_risk_flags?.length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Considerations
                        </h4>
                        <ul className="text-sm text-orange-800 space-y-1">
                          {application.ai_risk_flags.map((r, i) => (
                            <li key={i}>• {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Click "Generate Summary" for AI-powered analysis</p>
              </div>
            )}
          </div>

          {/* Application Details */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Details</h2>
            
            <div className="space-y-4">
              {Object.entries(application.data || {}).map(([key, value]) => (
                <div key={key} className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <p className="text-gray-900 whitespace-pre-line">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Review */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Your Review</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Score (1-100)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={score}
                    onChange={(e) => setScore(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold w-12 text-center">{score}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Your assessment and recommendations..."
                />
              </div>

              <button
                onClick={submitReview}
                disabled={!score || submittingReview}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applicant Info */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Applicant</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">{application.organization_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">{application.contact_email}</span>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900 font-medium">
                  ${(application.requested_amount_cents / 100).toLocaleString()} requested
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">
                  Submitted {new Date(application.submitted_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Review Summary */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Review Summary</h3>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-primary">
                {application.average_score?.toFixed(0) || '-'}
              </p>
              <p className="text-gray-500">Average Score</p>
              <p className="text-sm text-gray-400 mt-1">
                {application.total_reviews || application.reviews?.length || 0} reviews
              </p>
            </div>

            {application.reviews?.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                {application.reviews.map(review => (
                  <div key={review.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{review.reviewer?.email}</span>
                      <span className="font-semibold">{review.score}/100</span>
                    </div>
                    {review.comments && (
                      <p className="text-gray-500 mt-1 text-xs line-clamp-2">{review.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => updateStatus('approved')}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Decline
              </button>
              <button
                onClick={() => updateStatus('under_review')}
                className="w-full py-2 border rounded-lg hover:bg-gray-50"
              >
                Request More Info
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
