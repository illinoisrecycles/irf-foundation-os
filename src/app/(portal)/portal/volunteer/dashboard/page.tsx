'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Clock, Calendar, Award, Plus, ChevronRight, Loader2,
  CheckCircle, MapPin, Trophy
} from 'lucide-react'

type Signup = {
  id: string
  status: string
  hours_logged: number
  opportunity: {
    id: string
    title: string
    date_start: string
    location: string
    is_virtual: boolean
  }
}

type Badge = {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

export default function VolunteerDashboardPage() {
  const [signups, setSignups] = useState<Signup[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch signups
    const { data: signupData } = await supabase
      .from('volunteer_signups')
      .select(`
        id, status, hours_logged,
        opportunity:volunteer_opportunities(id, title, date_start, location, is_virtual)
      `)
      .eq('user_id', user.id)
      .order('signed_up_at', { ascending: false })

    setSignups(signupData || [])

    // Calculate total approved hours
    const { data: hoursData } = await supabase
      .from('volunteer_hours')
      .select('hours')
      .eq('user_id', user.id)
      .eq('status', 'approved')

    const total = hoursData?.reduce((sum, h) => sum + Number(h.hours), 0) || 0
    setTotalHours(total)

    // Get earned badges
    const { data: awardData } = await supabase
      .from('volunteer_badge_awards')
      .select('badge:volunteer_badges(*)')
      .eq('user_id', user.id)

    const earnedBadges = awardData?.map(a => a.badge).filter(Boolean) as Badge[]
    setBadges(earnedBadges || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const upcomingSignups = signups.filter(s => 
    s.status === 'confirmed' && new Date(s.opportunity.date_start) > new Date()
  )
  const pastSignups = signups.filter(s => 
    s.status === 'completed' || new Date(s.opportunity.date_start) <= new Date()
  )

  // Badge progress (simple logic - would be dynamic in production)
  const badgeProgress = [
    { name: 'Rising Star', threshold: 10, icon: '⭐', current: totalHours, earned: totalHours >= 10 },
    { name: 'Dedicated Volunteer', threshold: 50, icon: '🏆', current: totalHours, earned: totalHours >= 50 },
    { name: 'Century Club', threshold: 100, icon: '💎', current: totalHours, earned: totalHours >= 100 },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Volunteer Dashboard</h1>
          <p className="text-gray-600 mt-2">Track your impact and upcoming commitments</p>
        </div>
        <Link
          href="/portal/volunteer/opportunities"
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Find Opportunities
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <Clock className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-3xl font-bold text-gray-900">{totalHours}</p>
              <p className="text-xs text-gray-500">hours volunteered</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Upcoming</p>
              <p className="text-3xl font-bold text-gray-900">{upcomingSignups.length}</p>
              <p className="text-xs text-gray-500">scheduled shifts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
              <Award className="w-7 h-7 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Badges Earned</p>
              <p className="text-3xl font-bold text-gray-900">{badges.length}</p>
              <p className="text-xs text-gray-500">achievements unlocked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Badge Progress */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Badge Progress
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {badgeProgress.map(badge => (
            <div 
              key={badge.name}
              className={`p-4 rounded-xl border-2 ${
                badge.earned 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{badge.icon}</span>
                <div>
                  <p className={`font-semibold ${badge.earned ? 'text-green-700' : 'text-gray-700'}`}>
                    {badge.name}
                  </p>
                  <p className="text-sm text-gray-500">{badge.threshold} hours</p>
                </div>
                {badge.earned && (
                  <CheckCircle className="w-6 h-6 text-green-500 ml-auto" />
                )}
              </div>
              {!badge.earned && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((badge.current / badge.threshold) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-right">
                    {badge.current} / {badge.threshold} hours
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Commitments */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Commitments</h2>
          <Link href="/portal/volunteer/opportunities" className="text-primary hover:underline text-sm">
            Find More →
          </Link>
        </div>

        {upcomingSignups.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No upcoming volunteer shifts</p>
            <Link 
              href="/portal/volunteer/opportunities"
              className="text-primary hover:underline text-sm"
            >
              Browse opportunities →
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {upcomingSignups.map(signup => (
              <Link 
                key={signup.id}
                href={`/portal/volunteer/opportunities/${signup.opportunity.id}`}
                className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{signup.opportunity.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>
                        {new Date(signup.opportunity.date_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {signup.opportunity.is_virtual ? 'Virtual' : signup.opportunity.location}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Past Activity */}
      {pastSignups.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Past Activity</h2>
          </div>
          <div className="divide-y">
            {pastSignups.slice(0, 5).map(signup => (
              <div key={signup.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">{signup.opportunity.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(signup.opportunity.date_start).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {signup.hours_logged > 0 && (
                  <span className="text-sm text-gray-600">
                    {signup.hours_logged} hours
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
