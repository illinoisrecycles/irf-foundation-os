'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Users, Handshake, Search, Sparkles, Mail, Check, X, 
  MessageSquare, ArrowRight, Loader2, Plus, RefreshCw
} from 'lucide-react'

type Match = {
  id: string
  match_type: string
  asker_need: string
  offerer_capability: string
  match_score: number
  status: string
  intro_sent_at: string | null
  asker_profile: {
    id: string
    full_name: string
    email: string
    company: string
    job_title: string
    avatar_url: string | null
  }
  offerer_profile: {
    id: string
    full_name: string
    email: string
    company: string
    job_title: string
    avatar_url: string | null
  }
}

type MemberWithAsks = {
  id: string
  full_name: string
  email: string
  company: string
  job_title: string
  asks: string[]
  offers: string[]
  avatar_url: string | null
}

export default function NetworkMatcherPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [members, setMembers] = useState<MemberWithAsks[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'matches' | 'directory'>('matches')
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [matchesRes, membersRes] = await Promise.all([
      supabase
        .from('member_matches')
        .select(`
          *,
          asker_profile:profiles!asker_profile_id(id, full_name, email, company, job_title, avatar_url),
          offerer_profile:profiles!offerer_profile_id(id, full_name, email, company, job_title, avatar_url)
        `)
        .order('match_score', { ascending: false })
        .limit(50),
      supabase
        .from('profiles')
        .select('id, full_name, email, company, job_title, asks, offers, avatar_url, matching_enabled')
        .eq('matching_enabled', true)
        .not('asks', 'is', null)
        .limit(100)
    ])

    if (!matchesRes.error) setMatches(matchesRes.data || [])
    if (!membersRes.error) setMembers(membersRes.data || [])
    setLoading(false)
  }

  const generateMatches = async () => {
    setGenerating(true)
    try {
      await fetch('/api/networking/generate-matches', { method: 'POST' })
      await fetchData()
    } catch (err) {
      console.error('Match generation failed:', err)
    }
    setGenerating(false)
  }

  const sendIntro = async (matchId: string) => {
    await supabase
      .from('member_matches')
      .update({ 
        status: 'sent', 
        intro_sent_at: new Date().toISOString() 
      })
      .eq('id', matchId)
    
    // In production, this would also send an email
    await fetchData()
    setSelectedMatch(null)
  }

  const updateMatchStatus = async (matchId: string, status: string) => {
    await supabase
      .from('member_matches')
      .update({ status })
      .eq('id', matchId)
    await fetchData()
  }

  // Stats
  const stats = {
    totalMatches: matches.length,
    pendingIntros: matches.filter(m => m.status === 'suggested').length,
    sentIntros: matches.filter(m => m.status === 'sent').length,
    successfulConnections: matches.filter(m => m.status === 'completed').length,
    activeMembers: members.length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Network Matcher</h1>
          <p className="text-gray-600 mt-1">Connect members based on their asks and offers</p>
        </div>
        <button
          onClick={generateMatches}
          disabled={generating}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate Matches
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalMatches}</p>
              <p className="text-xs text-gray-500">Total Matches</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingIntros}</p>
              <p className="text-xs text-gray-500">Pending Intros</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.sentIntros}</p>
              <p className="text-xs text-gray-500">Sent Intros</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Handshake className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.successfulConnections}</p>
              <p className="text-xs text-gray-500">Connections Made</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeMembers}</p>
              <p className="text-xs text-gray-500">Opted-In Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('matches')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            tab === 'matches'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Suggested Matches
        </button>
        <button
          onClick={() => setTab('directory')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            tab === 'directory'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Ask/Offer Directory
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tab === 'matches' ? (
        matches.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Handshake className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No matches generated yet</p>
            <button
              onClick={generateMatches}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Generate First Matches
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {matches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                onSendIntro={() => setSelectedMatch(match)}
                onAccept={() => updateMatchStatus(match.id, 'accepted')}
                onDecline={() => updateMatchStatus(match.id, 'declined')}
              />
            ))}
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Member</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Looking For (Asks)</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Can Offer</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-gray-600 font-medium">
                            {member.full_name?.[0] || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.full_name}</p>
                        <p className="text-sm text-gray-500">
                          {member.job_title}{member.company ? ` at ${member.company}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(member.asks || []).map((ask, i) => (
                        <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                          {ask}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(member.offers || []).map((offer, i) => (
                        <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          {offer}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Intro Modal */}
      {selectedMatch && (
        <IntroModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSend={() => sendIntro(selectedMatch.id)}
        />
      )}
    </div>
  )
}

function MatchCard({ 
  match, 
  onSendIntro,
  onAccept,
  onDecline 
}: { 
  match: Match
  onSendIntro: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  const matchPercent = Math.round((match.match_score || 0) * 100)

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-600 uppercase">
            {match.match_type.replace('_', ' ')}
          </span>
          <span className="px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-600">
            {matchPercent}% match
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Asker */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            {match.asker_profile?.avatar_url ? (
              <img src={match.asker_profile.avatar_url} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <span className="text-orange-600 font-medium">
                {match.asker_profile?.full_name?.[0] || '?'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{match.asker_profile?.full_name}</p>
            <p className="text-sm text-gray-500">
              {match.asker_profile?.job_title}{match.asker_profile?.company ? ` at ${match.asker_profile.company}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center my-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium mx-2">
            needs: {match.asker_need}
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 mx-2" />
          <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium mx-2">
            offers: {match.offerer_capability}
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Offerer */}
        <div className="flex items-center gap-3 mt-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            {match.offerer_profile?.avatar_url ? (
              <img src={match.offerer_profile.avatar_url} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <span className="text-green-600 font-medium">
                {match.offerer_profile?.full_name?.[0] || '?'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{match.offerer_profile?.full_name}</p>
            <p className="text-sm text-gray-500">
              {match.offerer_profile?.job_title}{match.offerer_profile?.company ? ` at ${match.offerer_profile.company}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-1 rounded ${
          match.status === 'suggested' ? 'bg-yellow-100 text-yellow-700' :
          match.status === 'sent' ? 'bg-blue-100 text-blue-700' :
          match.status === 'accepted' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {match.status}
        </span>

        {match.status === 'suggested' && (
          <div className="flex gap-2">
            <button
              onClick={onDecline}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Decline"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onSendIntro}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1"
            >
              <Mail className="w-4 h-4" /> Send Intro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function IntroModal({ match, onClose, onSend }: { match: Match; onClose: () => void; onSend: () => void }) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(
    `Hi ${match.asker_profile?.full_name?.split(' ')[0]} and ${match.offerer_profile?.full_name?.split(' ')[0]},

I'd like to introduce you to each other!

${match.asker_profile?.full_name} is looking for ${match.asker_need}, and ${match.offerer_profile?.full_name} has experience with ${match.offerer_capability}.

I thought you might benefit from connecting. Feel free to reach out to each other directly.

Best regards`
  )

  const handleSend = async () => {
    setSending(true)
    await onSend()
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Send Introduction</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-orange-600 font-medium">
                  {match.asker_profile?.full_name?.[0]}
                </span>
              </div>
              <p className="text-sm font-medium mt-1">{match.asker_profile?.full_name?.split(' ')[0]}</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="text-center flex-1">
              <Handshake className="w-8 h-8 text-primary mx-auto" />
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-green-600 font-medium">
                  {match.offerer_profile?.full_name?.[0]}
                </span>
              </div>
              <p className="text-sm font-medium mt-1">{match.offerer_profile?.full_name?.split(' ')[0]}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Introduction Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <p className="text-sm text-gray-500">
            This email will be sent to both {match.asker_profile?.email} and {match.offerer_profile?.email}
          </p>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Introduction
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
