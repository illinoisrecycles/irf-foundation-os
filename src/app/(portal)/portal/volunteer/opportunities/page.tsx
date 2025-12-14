'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Calendar, MapPin, Users, Clock, ChevronRight, Search, Filter, Loader2
} from 'lucide-react'

type Opportunity = {
  id: string
  title: string
  description: string
  date_start: string
  date_end?: string
  location: string
  is_virtual: boolean
  required_volunteers: number
  signed_up_count: number
  skills_needed: string[]
}

export default function VolunteerOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchOpportunities()
  }, [])

  const fetchOpportunities = async () => {
    const { data, error } = await supabase
      .from('volunteer_opportunities')
      .select('*')
      .eq('status', 'published')
      .gte('date_start', new Date().toISOString())
      .order('date_start', { ascending: true })

    if (!error) {
      setOpportunities(data || [])
    }
    setLoading(false)
  }

  const filteredOpportunities = opportunities.filter(opp =>
    opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.location?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <h1 className="text-3xl font-bold text-gray-900">Volunteer Opportunities</h1>
        <p className="text-gray-600 mt-2">Make a difference – sign up for cleanups, events, and more</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search opportunities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* Opportunities Grid */}
      {filteredOpportunities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No volunteer opportunities available at this time.</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon for new opportunities!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOpportunities.map(opp => {
            const isFull = opp.signed_up_count >= opp.required_volunteers
            const spotsLeft = opp.required_volunteers - opp.signed_up_count

            return (
              <div 
                key={opp.id} 
                className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Header with gradient */}
                <div className="h-24 bg-gradient-to-br from-green-500 to-green-700 p-4 flex items-end">
                  <h3 className="text-xl font-semibold text-white">{opp.title}</h3>
                </div>

                <div className="p-6">
                  <div className="space-y-3 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {new Date(opp.date_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{opp.is_virtual ? 'Virtual Event' : opp.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span className={isFull ? 'text-red-600' : ''}>
                        {isFull 
                          ? 'Full' 
                          : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isFull ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((opp.signed_up_count / opp.required_volunteers) * 100, 100)}%`
                      }}
                    />
                  </div>

                  {/* Skills */}
                  {opp.skills_needed && opp.skills_needed.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {opp.skills_needed.slice(0, 3).map(skill => (
                        <span 
                          key={skill} 
                          className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/portal/volunteer/opportunities/${opp.id}`}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                      isFull
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isFull ? 'Full' : 'View & Sign Up'}
                    {!isFull && <ChevronRight className="w-4 h-4" />}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
