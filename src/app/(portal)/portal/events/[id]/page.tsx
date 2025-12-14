'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Calendar, MapPin, Clock, Users, DollarSign, 
  CheckCircle, Loader2, ArrowLeft, ExternalLink,
  User, Mail, Building2
} from 'lucide-react'
import Link from 'next/link'

type Event = {
  id: string
  title: string
  description: string
  event_type: string
  start_date: string
  end_date: string
  location: string
  is_virtual: boolean
  virtual_link: string | null
  capacity: number | null
  registration_count: number
  price_cents: number
  member_price_cents: number | null
  early_bird_price_cents: number | null
  early_bird_deadline: string | null
  registration_deadline: string | null
  is_published: boolean
  requires_approval: boolean
  ceu_credits: number | null
  image_url: string | null
}

type RegistrationForm = {
  name: string
  email: string
  organization: string
  dietary_restrictions: string
  special_requests: string
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  
  const [form, setForm] = useState<RegistrationForm>({
    name: '',
    email: '',
    organization: '',
    dietary_restrictions: '',
    special_requests: '',
  })

  useEffect(() => {
    fetchEvent()
  }, [eventId])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events?id=${eventId}`)
      const data = await res.json()
      if (data.event) {
        setEvent(data.event)
      } else {
        setError('Event not found')
      }
    } catch (err) {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  const getPrice = () => {
    if (!event) return 0
    
    // Check early bird
    if (event.early_bird_price_cents && event.early_bird_deadline) {
      if (new Date() < new Date(event.early_bird_deadline)) {
        return event.early_bird_price_cents
      }
    }
    
    // Check member price (would need auth context)
    // For now, show regular price
    return event.price_cents
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return

    setRegistering(true)
    setError(null)

    try {
      const price = getPrice()
      
      if (price > 0) {
        // Create Stripe checkout session
        const res = await fetch('/api/stripe/create-event-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: event.id,
            attendee_name: form.name,
            attendee_email: form.email,
            organization: form.organization,
            metadata: {
              dietary_restrictions: form.dietary_restrictions,
              special_requests: form.special_requests,
            },
          }),
        })

        const data = await res.json()
        
        if (data.url) {
          window.location.href = data.url
          return
        } else {
          throw new Error(data.error || 'Failed to create checkout')
        }
      } else {
        // Free event - register directly
        const res = await fetch('/api/events/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: event.id,
            attendee_name: form.name,
            attendee_email: form.email,
            organization: form.organization,
            metadata: {
              dietary_restrictions: form.dietary_restrictions,
              special_requests: form.special_requests,
            },
          }),
        })

        if (res.ok) {
          setRegistered(true)
        } else {
          const data = await res.json()
          throw new Error(data.error || 'Registration failed')
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!event || error) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
        <p className="text-gray-600 mb-4">{error || 'This event does not exist.'}</p>
        <Link href="/portal/events" className="text-primary hover:underline">
          ← Back to Events
        </Link>
      </div>
    )
  }

  if (registered) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Registered!</h1>
        <p className="text-gray-600 mb-6">
          You've successfully registered for {event.title}. Check your email for confirmation details.
        </p>
        <Link 
          href="/portal/events" 
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
      </div>
    )
  }

  const price = getPrice()
  const spotsLeft = event.capacity ? event.capacity - event.registration_count : null
  const isFull = spotsLeft !== null && spotsLeft <= 0
  const isPast = new Date(event.start_date) < new Date()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Link */}
      <Link 
        href="/portal/events" 
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          {event.image_url && (
            <img 
              src={event.image_url} 
              alt={event.title}
              className="w-full h-64 object-cover rounded-xl"
            />
          )}
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                {event.event_type}
              </span>
              {event.ceu_credits && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  {event.ceu_credits} CEU Credits
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          </div>

          {/* Details */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="w-5 h-5" />
              <div>
                <p className="font-medium text-gray-900">
                  {new Date(event.start_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-sm">
                  {new Date(event.start_date).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {event.end_date && ` - ${new Date(event.end_date).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="w-5 h-5" />
              <div>
                <p className="font-medium text-gray-900">
                  {event.is_virtual ? 'Virtual Event' : event.location}
                </p>
                {event.is_virtual && event.virtual_link && (
                  <a 
                    href={event.virtual_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Join Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="prose max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">About This Event</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>
        </div>

        {/* Sidebar - Registration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-6 sticky top-6">
            {/* Price */}
            <div className="text-center mb-6">
              {price > 0 ? (
                <>
                  <p className="text-3xl font-bold text-gray-900">
                    ${(price / 100).toFixed(2)}
                  </p>
                  {event.early_bird_price_cents && event.early_bird_deadline && 
                   new Date() < new Date(event.early_bird_deadline) && (
                    <p className="text-sm text-green-600">
                      Early bird pricing until {new Date(event.early_bird_deadline).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-3xl font-bold text-green-600">Free</p>
              )}
            </div>

            {/* Capacity */}
            {spotsLeft !== null && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
                <Users className="w-4 h-4" />
                {isFull ? (
                  <span className="text-red-600 font-medium">Event is full</span>
                ) : (
                  <span>{spotsLeft} spots remaining</span>
                )}
              </div>
            )}

            {/* Registration Form or Button */}
            {isPast ? (
              <p className="text-center text-gray-500">This event has ended</p>
            ) : isFull ? (
              <button 
                disabled 
                className="w-full py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              >
                Registration Closed
              </button>
            ) : showForm ? (
              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dietary Restrictions
                  </label>
                  <input
                    type="text"
                    value={form.dietary_restrictions}
                    onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Vegetarian, Gluten-free"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : price > 0 ? (
                    <>
                      <DollarSign className="w-4 h-4" />
                      Pay & Register
                    </>
                  ) : (
                    'Complete Registration'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
              >
                Register Now
              </button>
            )}

            {/* Registration Deadline */}
            {event.registration_deadline && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Registration closes {new Date(event.registration_deadline).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
