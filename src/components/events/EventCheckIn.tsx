'use client'

import * as React from 'react'
import { 
  Search, QrCode, CheckCircle, XCircle, Printer, Users, 
  Clock, AlertTriangle, Camera, Download, RefreshCw, Wifi, WifiOff
} from 'lucide-react'

type Registration = {
  id: string
  attendee_name: string
  attendee_email: string
  registration_type: string
  checked_in: boolean
  checked_in_at?: string
  member_organization?: { name: string }
}

type Props = {
  eventId: string
  eventTitle: string
}

export default function EventCheckIn({ eventId, eventTitle }: Props) {
  const [registrations, setRegistrations] = React.useState<Registration[]>([])
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [scanning, setScanning] = React.useState(false)
  const [lastAction, setLastAction] = React.useState<{ name: string; success: boolean } | null>(null)
  const [stats, setStats] = React.useState({ total: 0, checkedIn: 0 })
  const [offline, setOffline] = React.useState(false)
  const [offlineQueue, setOfflineQueue] = React.useState<string[]>([])

  // Fetch registrations
  React.useEffect(() => {
    fetchRegistrations()
    
    // Poll for updates
    const interval = setInterval(fetchRegistrations, 30000)
    
    // Offline detection
    const handleOnline = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [eventId])

  // Sync offline queue when back online
  React.useEffect(() => {
    if (!offline && offlineQueue.length > 0) {
      syncOfflineCheckIns()
    }
  }, [offline])

  const fetchRegistrations = async () => {
    try {
      const response = await fetch(`/api/events/registrations?event_id=${eventId}`)
      const data = await response.json()
      setRegistrations(data)
      setStats({
        total: data.length,
        checkedIn: data.filter((r: Registration) => r.checked_in).length,
      })
    } finally {
      setLoading(false)
    }
  }

  const checkIn = async (registrationId: string, name: string) => {
    if (offline) {
      // Queue for later
      setOfflineQueue([...offlineQueue, registrationId])
      setRegistrations(regs => 
        regs.map(r => r.id === registrationId ? { ...r, checked_in: true, checked_in_at: new Date().toISOString() } : r)
      )
      setLastAction({ name, success: true })
      return
    }

    try {
      const response = await fetch('/api/events/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: registrationId }),
      })

      if (response.ok) {
        setRegistrations(regs => 
          regs.map(r => r.id === registrationId ? { ...r, checked_in: true, checked_in_at: new Date().toISOString() } : r)
        )
        setStats(s => ({ ...s, checkedIn: s.checkedIn + 1 }))
        setLastAction({ name, success: true })
      } else {
        setLastAction({ name, success: false })
      }
    } catch {
      setLastAction({ name, success: false })
    }

    setTimeout(() => setLastAction(null), 3000)
  }

  const syncOfflineCheckIns = async () => {
    for (const id of offlineQueue) {
      await fetch('/api/events/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: id }),
      })
    }
    setOfflineQueue([])
  }

  const printBadge = async (registrationId: string) => {
    const response = await fetch(`/api/events/badges?registration_id=${registrationId}`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const printAllBadges = () => {
    window.open(`/api/events/badges?event_id=${eventId}`, '_blank')
  }

  const filteredRegistrations = registrations.filter(r =>
    r.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
    r.attendee_email.toLowerCase().includes(search.toLowerCase())
  )

  const notCheckedIn = filteredRegistrations.filter(r => !r.checked_in)
  const checkedIn = filteredRegistrations.filter(r => r.checked_in)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{eventTitle}</h1>
              <p className="text-sm text-gray-500">Event Check-In</p>
            </div>
            <div className="flex items-center gap-4">
              {offline ? (
                <span className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                  <WifiOff className="w-4 h-4" />
                  Offline ({offlineQueue.length} queued)
                </span>
              ) : (
                <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  <Wifi className="w-4 h-4" />
                  Online
                </span>
              )}
              <button onClick={printAllBadges} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Printer className="w-4 h-4" />
                Print All
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-2xl font-bold text-gray-900">{stats.checkedIn}</span>
              <span className="text-gray-500">/ {stats.total} checked in</span>
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-3">
              <div 
                className="bg-green-500 rounded-full h-3 transition-all"
                style={{ width: `${stats.total ? (stats.checkedIn / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {lastAction && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${
          lastAction.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {lastAction.success ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
          <span className="font-medium">
            {lastAction.success ? `${lastAction.name} checked in!` : `Failed to check in ${lastAction.name}`}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
          <button
            onClick={() => setScanning(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Registration List */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Not Checked In */}
        {notCheckedIn.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Waiting ({notCheckedIn.length})
            </h2>
            <div className="space-y-2">
              {notCheckedIn.map(reg => (
                <div
                  key={reg.id}
                  className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-lg font-semibold text-gray-600">
                      {reg.attendee_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{reg.attendee_name}</p>
                      <p className="text-sm text-gray-500">
                        {reg.member_organization?.name || reg.attendee_email}
                      </p>
                    </div>
                    {reg.registration_type !== 'attendee' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reg.registration_type === 'speaker' ? 'bg-red-100 text-red-700' :
                        reg.registration_type === 'sponsor' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {reg.registration_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printBadge(reg.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => checkIn(reg.id, reg.attendee_name)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Check In
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checked In */}
        {checkedIn.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Checked In ({checkedIn.length})
            </h2>
            <div className="space-y-2">
              {checkedIn.map(reg => (
                <div
                  key={reg.id}
                  className="bg-white rounded-xl border p-4 flex items-center justify-between opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{reg.attendee_name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Checked in {reg.checked_in_at && new Date(reg.checked_in_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
