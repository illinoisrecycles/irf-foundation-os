'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Video,
  Users,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  X
} from 'lucide-react'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

type Event = {
  id: string
  title: string
  slug: string
  description: string | null
  start_date: string
  end_date: string
  venue_name: string | null
  venue_address: string | null
  virtual_url: string | null
  is_virtual: boolean
  max_attendees: number | null
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  ticket_types: Array<{
    id: string
    name: string
    price_cents: number
    quantity_available: number | null
    quantity_sold: number
  }>
  registrations_count?: number
}

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  virtual_url: z.string().url().optional().or(z.literal('')),
  is_virtual: z.boolean().default(false),
  max_attendees: z.number().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
})

type EventFormData = z.infer<typeof eventSchema>

const statusColors = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  published: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
}

export default function EventsPage() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [view, setView] = React.useState<'calendar' | 'list'>('calendar')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await fetch(`/api/events?orgId=${encodeURIComponent(ORG_ID)}`)
      if (!res.ok) throw new Error('Failed to fetch events')
      return (await res.json()) as { events: Event[] }
    },
  })

  const createEvent = useMutation({
    mutationFn: async (eventData: EventFormData) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventData,
          organization_id: ORG_ID,
        }),
      })
      if (!res.ok) throw new Error('Failed to create event')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      setShowCreateDialog(false)
    },
  })

  const events = data?.events ?? []

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad to start on Sunday
  const startDay = monthStart.getDay()
  const paddedDays = Array(startDay).fill(null).concat(calendarDays)

  const getEventsForDay = (date: Date) => {
    return events.filter(e => isSameDay(parseISO(e.start_date), date))
  }

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      start_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '',
      is_virtual: false,
      status: 'draft',
    },
  })

  React.useEffect(() => {
    if (selectedDate) {
      form.setValue('start_date', format(selectedDate, "yyyy-MM-dd'T'09:00"))
    }
  }, [selectedDate, form])

  const onSubmit = (data: EventFormData) => {
    createEvent.mutate(data)
  }

  const getRegistrationCount = (event: Event) => {
    return event.registrations_count ?? 0
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            Events
          </h1>
          <p className="text-muted-foreground mt-1">
            {events.length} event{events.length !== 1 ? 's' : ''} • Manage conferences, webinars, and meetings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        /* Calendar View */
        <div className="rounded-xl border bg-card shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="border-b p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {paddedDays.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-28 border-b border-r p-2 bg-muted/20" />
              }

              const dayEvents = getEventsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day)
                    if (dayEvents.length === 0) {
                      setShowCreateDialog(true)
                    }
                  }}
                  className={`min-h-28 border-b border-r p-2 cursor-pointer transition-colors hover:bg-muted/30 ${
                    !isCurrentMonth ? 'bg-muted/10 text-muted-foreground' : ''
                  } ${isToday(day) ? 'bg-primary/5' : ''}`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isToday(day) ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : ''
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded truncate ${
                          event.status === 'published' 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-semibold">All Events</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No events yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first event to get started</p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Event
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className="p-4 hover:bg-muted/30 transition-colors animate-in fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      {/* Date Badge */}
                      <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-primary/10 text-primary shrink-0">
                        <span className="text-xs font-medium uppercase">
                          {format(parseISO(event.start_date), 'MMM')}
                        </span>
                        <span className="text-2xl font-bold">
                          {format(parseISO(event.start_date), 'd')}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[event.status]}`}>
                            {event.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(parseISO(event.start_date), 'h:mm a')}
                          </span>
                          {event.venue_name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.venue_name}
                            </span>
                          )}
                          {event.is_virtual && (
                            <span className="flex items-center gap-1">
                              <Video className="h-3.5 w-3.5" />
                              Virtual
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {getRegistrationCount(event)} registered
                            {event.max_attendees && ` / ${event.max_attendees}`}
                          </span>
                        </div>

                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/admin/events/${event.id}`}
                        className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <a
                        href={`/admin/events/${event.id}/edit`}
                        className="rounded-lg border p-2 hover:bg-muted/50 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </a>
                      <button className="rounded-lg border p-2 hover:bg-muted/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog.Root open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-lg font-semibold">Create Event</Dialog.Title>
              <Dialog.Close className="rounded-lg p-2 hover:bg-muted/50 transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title *</label>
                <input
                  {...form.register('title')}
                  placeholder="e.g., 2025 Illinois Circularity Conference"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Start Date *</label>
                  <input
                    type="datetime-local"
                    {...form.register('start_date')}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">End Date</label>
                  <input
                    type="datetime-local"
                    {...form.register('end_date')}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <textarea
                  {...form.register('description')}
                  rows={3}
                  placeholder="Event description..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Venue Name</label>
                <input
                  {...form.register('venue_name')}
                  placeholder="e.g., Par-A-Dice Hotel & Casino, East Peoria, IL"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Venue Address</label>
                <input
                  {...form.register('venue_address')}
                  placeholder="Full street address"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_virtual"
                  {...form.register('is_virtual')}
                  className="h-4 w-4 rounded border"
                />
                <label htmlFor="is_virtual" className="text-sm">This is a virtual event</label>
              </div>

              {form.watch('is_virtual') && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Virtual URL</label>
                  <input
                    {...form.register('virtual_url')}
                    placeholder="https://zoom.us/j/..."
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Max Attendees</label>
                  <input
                    type="number"
                    {...form.register('max_attendees', { valueAsNumber: true })}
                    placeholder="Leave empty for unlimited"
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Status</label>
                  <select
                    {...form.register('status')}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={createEvent.isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createEvent.isPending ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
