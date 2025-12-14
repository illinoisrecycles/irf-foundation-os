'use client'

import * as React from 'react'
import QRCode from 'qrcode'
import { 
  QrCode, 
  Camera, 
  CheckCircle, 
  XCircle, 
  User,
  Clock,
  Ticket
} from 'lucide-react'

type CheckInStatus = 'idle' | 'scanning' | 'success' | 'error'

type Registration = {
  id: string
  attendee_name: string
  attendee_email: string
  ticket_type: string
  checked_in_at: string | null
}

// Generate QR code data URL
export async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  } catch (err) {
    console.error('QR generation failed:', err)
    return ''
  }
}

// QR Code display component (for tickets/confirmation emails)
export function TicketQRCode({ 
  registrationId, 
  size = 200 
}: { 
  registrationId: string
  size?: number 
}) {
  const [qrUrl, setQrUrl] = React.useState<string>('')

  React.useEffect(() => {
    generateQRCode(`checkin:${registrationId}`).then(setQrUrl)
  }, [registrationId])

  if (!qrUrl) {
    return (
      <div 
        className="bg-muted animate-pulse rounded-lg flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <QrCode className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="Check-in QR Code" width={size} height={size} />
      <p className="text-xs text-center text-muted-foreground mt-2">
        Scan to check in
      </p>
    </div>
  )
}

// Check-in scanner component (for event staff)
export function CheckInScanner({
  eventId,
  onCheckIn,
}: {
  eventId: string
  onCheckIn: (registrationId: string) => Promise<Registration | null>
}) {
  const [status, setStatus] = React.useState<CheckInStatus>('idle')
  const [lastScanned, setLastScanned] = React.useState<Registration | null>(null)
  const [manualCode, setManualCode] = React.useState('')
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  const processCheckIn = async (code: string) => {
    if (!code.startsWith('checkin:')) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    const registrationId = code.replace('checkin:', '')
    setStatus('scanning')

    try {
      const registration = await onCheckIn(registrationId)
      if (registration) {
        setLastScanned(registration)
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch (err) {
      setStatus('error')
    }

    setTimeout(() => setStatus('idle'), 3000)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      processCheckIn(`checkin:${manualCode.trim()}`)
      setManualCode('')
    }
  }

  // Camera-based scanning would use a library like @zxing/browser
  // For simplicity, this demo uses manual entry
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStatus('scanning')
    } catch (err) {
      console.error('Camera access denied:', err)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setStatus('idle')
  }

  return (
    <div className="space-y-6">
      {/* Status Display */}
      <div className={`rounded-xl p-6 text-center transition-all ${
        status === 'success' ? 'bg-green-100 border-green-500' :
        status === 'error' ? 'bg-red-100 border-red-500' :
        status === 'scanning' ? 'bg-blue-100 border-blue-500' :
        'bg-muted border-muted-foreground/20'
      } border-2`}>
        {status === 'success' && lastScanned && (
          <div className="space-y-2">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold text-green-800">Checked In!</h3>
            <p className="font-medium">{lastScanned.attendee_name}</p>
            <p className="text-sm text-green-700">{lastScanned.ticket_type}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2">
            <XCircle className="h-12 w-12 text-red-600 mx-auto" />
            <h3 className="text-lg font-semibold text-red-800">Invalid or Already Checked In</h3>
            <p className="text-sm text-red-700">Please try again or check manually</p>
          </div>
        )}
        {status === 'scanning' && (
          <div className="space-y-2">
            <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-lg font-semibold text-blue-800">Processing...</h3>
          </div>
        )}
        {status === 'idle' && (
          <div className="space-y-2">
            <QrCode className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">Ready to Scan</h3>
            <p className="text-sm text-muted-foreground">Scan a QR code or enter confirmation number</p>
          </div>
        )}
      </div>

      {/* Camera View (hidden canvas for processing) */}
      <video ref={videoRef} className="hidden" autoPlay playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Controls */}
      <div className="flex gap-2">
        <button
          onClick={status === 'scanning' ? stopCamera : startCamera}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors ${
            status === 'scanning' 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          <Camera className="h-5 w-5" />
          {status === 'scanning' ? 'Stop Camera' : 'Start Camera'}
        </button>
      </div>

      {/* Manual Entry */}
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-2">Or enter confirmation number:</p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter code..."
            className="flex-1 h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Check In
          </button>
        </form>
      </div>
    </div>
  )
}

// Attendee list with check-in status
export function AttendeeList({
  registrations,
  onCheckIn,
}: {
  registrations: Registration[]
  onCheckIn: (id: string) => Promise<void>
}) {
  const checkedIn = registrations.filter(r => r.checked_in_at)
  const notCheckedIn = registrations.filter(r => !r.checked_in_at)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-2xl font-bold">{registrations.length}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg bg-green-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{checkedIn.length}</p>
          <p className="text-sm text-green-600">Checked In</p>
        </div>
        <div className="rounded-lg bg-yellow-100 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{notCheckedIn.length}</p>
          <p className="text-sm text-yellow-600">Pending</p>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {registrations.map((reg) => (
            <div 
              key={reg.id} 
              className={`flex items-center justify-between p-4 ${
                reg.checked_in_at ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${
                  reg.checked_in_at ? 'bg-green-100' : 'bg-muted'
                }`}>
                  {reg.checked_in_at ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{reg.attendee_name}</p>
                  <p className="text-xs text-muted-foreground">{reg.attendee_email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ticket className="h-3 w-3" />
                    {reg.ticket_type}
                  </div>
                  {reg.checked_in_at && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Clock className="h-3 w-3" />
                      {new Date(reg.checked_in_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                
                {!reg.checked_in_at && (
                  <button
                    onClick={() => onCheckIn(reg.id)}
                    className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                  >
                    Check In
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
