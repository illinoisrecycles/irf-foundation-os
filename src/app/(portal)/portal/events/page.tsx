'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Calendar, MapPin, Clock, Users, CheckCircle, ChevronRight,
  Filter, Search, Star, DollarSign, CreditCard
} from 'lucide-react'

type Event = {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string | null
  time: string
  location: string
  type: 'conference' | 'webinar' | 'workshop' | 'networking'
  price_member: number
  price_nonmember: number
  capacity: number
  registered: number
  is_registered: boolean
  registration_status: 'open' | 'closed' | 'waitlist'
  image_url: string | null
  featured: boolean
  sessions_count: number
}

export default function PortalEventsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [showRegistered, setShowRegistered] = React.useState(false)

  const events: Event[] = [
    {
      id: '1',
      name: '2025 Illinois Circularity Conference',
      description: 'Join recycling professionals from across Illinois for two days of networking, education, and innovation. Features keynotes, breakout sessions, and an exhibitor hall.',
      start_date: '2025-10-14',
      end_date: '2025-10-15',
      time: '8:00 AM - 5:00 PM',
      location: 'Par-A-Dice Hotel & Casino, East Peoria, IL',
      type: 'conference',
      price_member: 275,
      price_nonmember: 350,
      capacity: 300,
      registered: 156,
      is_registered: true,
      registration_status: 'open',
      image_url: null,
      featured: true,
      sessions_count: 24,
    },
    {
      id: '2',
      name: 'MRF Best Practices Webinar',
      description: 'Learn about the latest technologies and techniques for improving MRF efficiency and material quality.',
      start_date: '2025-03-28',
      end_date: null,
      time: '2:00 PM - 3:30 PM',
      location: 'Virtual (Zoom)',
      type: 'webinar',
      price_member: 0,
      price_nonmember: 25,
      capacity: 200,
      registered: 89,
      is_registered: false,
      registration_status: 'open',
      image_url: null,
      featured: false,
      sessions_count: 1,
    },
    {
      id: '3',
      name: 'Northern Illinois Networking Mixer',
      description: 'Connect with recycling professionals in the Chicago area over appetizers and drinks.',
      start_date: '2025-04-15',
      end_date: null,
      time: '5:30 PM - 7:30 PM',
      location: 'Chicago, IL',
      type: 'networking',
      price_member: 15,
      price_nonmember: 25,
      capacity: 75,
      registered: 42,
      is_registered: false,
      registration_status: 'open',
      image_url: null,
      featured: false,
      sessions_count: 0,
    },
    {
      id: '4',
      name: 'Contamination Reduction Workshop',
      description: 'Hands-on workshop on developing effective contamination reduction strategies for your community.',
      start_date: '2025-05-08',
      end_date: null,
      time: '9:00 AM - 12:00 PM',
      location: 'Springfield, IL',
      type: 'workshop',
      price_member: 40,
      price_nonmember: 60,
      capacity: 40,
      registered: 38,
      is_registered: false,
      registration_status: 'waitlist',
      image_url: null,
      featured: false,
      sessions_count: 3,
    },
  ]

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || event.type === typeFilter
    const matchesRegistered = !showRegistered || event.is_registered
    return matchesSearch && matchesType && matchesRegistered
  })

  const myRegistrations = events.filter(e => e.is_registered)

  const typeColors: Record<string, string> = {
    conference: 'bg-purple-100 text-purple-800',
    webinar: 'bg-blue-100 text-blue-800',
    workshop: 'bg-orange-100 text-orange-800',
    networking: 'bg-green-100 text-green-800',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Events & Training</h1>
        <p className="text-gray-600 mt-1">Browse upcoming events and manage your registrations</p>
      </div>

      {/* My Registrations Summary */}
      {myRegistrations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-green-900">My Upcoming Events</h2>
            <span className="text-sm text-green-700">{myRegistrations.length} registration(s)</span>
          </div>
          <div className="space-y-3">
            {myRegistrations.map((event) => (
              <div key={event.id} className="flex items-center justify-between bg-white rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {' · '}{event.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> Registered
                  </span>
                  <Link 
                    href={`/portal/events/${event.id}`}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Types</option>
          <option value="conference">Conferences</option>
          <option value="webinar">Webinars</option>
          <option value="workshop">Workshops</option>
          <option value="networking">Networking</option>
        </select>
        <label className="flex items-center gap-2 px-4 py-3 border rounded-xl cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={showRegistered}
            onChange={(e) => setShowRegistered(e.target.checked)}
            className="rounded border-gray-300 text-green-600"
          />
          <span className="text-sm text-gray-700">My Registrations</span>
        </label>
      </div>

      {/* Featured Event */}
      {filteredEvents.some(e => e.featured) && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl overflow-hidden">
          {filteredEvents.filter(e => e.featured).map((event) => (
            <div key={event.id} className="p-8">
              <div className="flex items-center gap-2 text-purple-200 mb-4">
                <Star className="w-5 h-5" />
                <span className="uppercase text-sm font-semibold tracking-wide">Featured Event</span>
              </div>
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <h2 className="text-3xl font-bold text-white mb-4">{event.name}</h2>
                  <p className="text-purple-100 mb-6">{event.description}</p>
                  <div className="flex flex-wrap gap-6 text-purple-100">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      {event.end_date 
                        ? `${new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      }
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {event.registered} / {event.capacity} registered
                    </span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-6">
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-white">${event.price_member}</div>
                    <div className="text-purple-200 text-sm">Member Price</div>
                    <div className="text-purple-300 text-xs mt-1">(${event.price_nonmember} non-member)</div>
                  </div>
                  {event.is_registered ? (
                    <div className="text-center">
                      <span className="flex items-center justify-center gap-2 text-green-300 mb-3">
                        <CheckCircle className="w-5 h-5" /> You're Registered!
                      </span>
                      <Link
                        href={`/portal/events/${event.id}`}
                        className="block w-full py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50"
                      >
                        View Registration
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/portal/events/${event.id}/register`}
                      className="block w-full py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 text-center"
                    >
                      Register Now
                    </Link>
                  )}
                  <p className="text-center text-purple-200 text-sm mt-3">
                    {event.sessions_count} sessions available
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event List */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900">All Events</h2>
        {filteredEvents.filter(e => !e.featured).map((event) => (
          <div key={event.id} className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${typeColors[event.type]}`}>
                      {event.type}
                    </span>
                    {event.price_member === 0 && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                        Free for Members
                      </span>
                    )}
                    {event.registration_status === 'waitlist' && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                        Waitlist Only
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {event.time}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {event.registered} / {event.capacity}
                    </span>
                  </div>
                </div>
                <div className="ml-6 text-right flex-shrink-0">
                  <div className="mb-4">
                    {event.price_member === 0 ? (
                      <div className="text-2xl font-bold text-green-600">Free</div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-900">${event.price_member}</div>
                        <div className="text-xs text-gray-500">member price</div>
                      </>
                    )}
                  </div>
                  {event.is_registered ? (
                    <Link
                      href={`/portal/events/${event.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" /> Registered
                    </Link>
                  ) : event.registration_status === 'waitlist' ? (
                    <Link
                      href={`/portal/events/${event.id}/register`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                    >
                      Join Waitlist <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <Link
                      href={`/portal/events/${event.id}/register`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Register <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
