'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  CheckCircle, Sparkles, Users, DollarSign, Mail, Zap,
  ArrowRight, Download, Loader2, PartyPopper
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function MigrationSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResults()
    // Celebration confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })
  }, [])

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/migrate/preview/${sessionId}`)
      const data = await res.json()
      setSession(data.session)
    } catch (err) {
      console.error('Failed to fetch results:', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  const stats = session?.stats || {}

  return (
    <div className="max-w-4xl mx-auto py-16 px-4 text-center">
      {/* Success Icon */}
      <div className="relative inline-block mb-8">
        <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-20 h-20 text-green-600" />
        </div>
        <div className="absolute -top-2 -right-2 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
          <PartyPopper className="w-7 h-7 text-yellow-900" />
        </div>
      </div>

      {/* Headline */}
      <h1 className="text-5xl font-bold text-gray-900 mb-4">
        Migration Complete! 🎉
      </h1>
      <p className="text-2xl text-gray-600 mb-12">
        Your data has been successfully imported into FoundationOS
      </p>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white rounded-2xl border p-6">
          <Users className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <div className="text-4xl font-bold text-gray-900">
            {(stats.profiles_created || 0).toLocaleString()}
          </div>
          <p className="text-gray-600 mt-1">Contacts Imported</p>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <Users className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <div className="text-4xl font-bold text-gray-900">
            {(stats.members_created || 0).toLocaleString()}
          </div>
          <p className="text-gray-600 mt-1">Members Created</p>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <DollarSign className="w-10 h-10 text-purple-600 mx-auto mb-3" />
          <div className="text-4xl font-bold text-gray-900">
            {(stats.donations_created || 0).toLocaleString()}
          </div>
          <p className="text-gray-600 mt-1">Donations Imported</p>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <Sparkles className="w-10 h-10 text-orange-600 mx-auto mb-3" />
          <div className="text-4xl font-bold text-gray-900">
            {(stats.duplicates_merged || 0).toLocaleString()}
          </div>
          <p className="text-gray-600 mt-1">Duplicates Merged</p>
        </div>
      </div>

      {/* What We Did Automatically */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-purple-600" />
          AI Optimizations Applied
        </h2>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-xl p-4">
            <Mail className="w-8 h-8 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Welcome Emails</h3>
            <p className="text-sm text-gray-600">
              {session?.welcome_emails_sent || 'Queued'} personalized welcome emails sent to new members
            </p>
          </div>
          <div className="bg-white rounded-xl p-4">
            <Zap className="w-8 h-8 text-purple-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Automations Created</h3>
            <p className="text-sm text-gray-600">
              {session?.automations_created || 3} standard workflows activated (renewal reminders, thank-yous)
            </p>
          </div>
          <div className="bg-white rounded-xl p-4">
            <Sparkles className="w-8 h-8 text-orange-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Smart Tags Applied</h3>
            <p className="text-sm text-gray-600">
              {session?.tags_applied || 0} high-value donors and key members auto-tagged
            </p>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {session?.post_migration_report && (
        <div className="bg-white rounded-2xl border p-8 mb-12 text-left">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            AI Migration Insights
          </h2>
          <div className="prose prose-purple max-w-none">
            <pre className="whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-xl p-6">
              {session.post_migration_report}
            </pre>
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => router.push('/admin/members')}
          className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white text-lg font-bold rounded-xl hover:bg-primary/90"
        >
          View Your Members
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-50"
        >
          Go to Dashboard
        </button>
      </div>

      {/* Footer Note */}
      <p className="text-gray-500 mt-12">
        Migration ID: {sessionId} • {new Date().toLocaleDateString()}
      </p>
    </div>
  )
}
