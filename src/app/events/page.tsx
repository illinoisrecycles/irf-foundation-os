'use client'

import * as React from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Calendar, MapPin, Clock, Users } from 'lucide-react'

type Event = {
  id: string
  title: string
  date: string
  time: string
  location: string
  type: string
  attendees: number
}

export default function EventsPage() {
  const events: Event[] = [
    { id: '1', title: '2025 Illinois Circularity Conference', date: 'Oct 14-15, 2025', time: '8:00 AM - 5:00 PM', location: 'East Peoria, IL', type: 'Conference', attendees: 156 },
    { id: '2', title: 'MRF Operations Best Practices', date: 'Apr 8, 2025', time: '1:00 PM - 2:30 PM', location: 'Virtual', type: 'Webinar', attendees: 45 },
    { id: '3', title: 'Northern Illinois Networking', date: 'May 15, 2025', time: '5:30 PM - 7:30 PM', location: 'Chicago, IL', type: 'Networking', attendees: 32 },
    { id: '4', title: 'Recycling Policy Update', date: 'Jun 10, 2025', time: '12:00 PM - 1:00 PM', location: 'Virtual', type: 'Webinar', attendees: 28 },
  ]

  return (
    <PublicLayout>
      <div className="bg-purple-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Events</h1>
          <p className="text-xl text-purple-100">Conferences, webinars, and networking opportunities</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">{event.type}</span>
                    <h3 className="text-xl font-bold text-gray-900 mt-2">{event.title}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-gray-600">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{event.date} · {event.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" />{event.attendees} registered</span>
                    </div>
                  </div>
                </div>
                <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                  Register
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
