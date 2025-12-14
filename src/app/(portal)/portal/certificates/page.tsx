'use client'

import * as React from 'react'
import { Award, Download, Calendar, Clock, ChevronRight, FileText, Loader2 } from 'lucide-react'

type Certificate = {
  id: string
  credit_hours: number
  credit_type: string
  verified_at: string
  certificate_url: string
  event_title: string
  event_date: string
  accrediting_body?: string
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = React.useState<Certificate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [summary, setSummary] = React.useState<{ [type: string]: number }>({})

  React.useEffect(() => {
    // Fetch member's certificates
    fetch('/api/member/certificates')
      .then(res => res.json())
      .then(data => {
        setCertificates(data.certificates || [])
        setSummary(data.summary || {})
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const totalCredits = Object.values(summary).reduce((sum, n) => sum + n, 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Certificates & Credits</h1>
          <p className="text-gray-500">Track your continuing education progress</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200">
          <Download className="w-4 h-4" />
          Export Transcript
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
          <Award className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{totalCredits}</p>
          <p className="text-blue-100">Total Credits Earned</p>
        </div>
        {Object.entries(summary).slice(0, 3).map(([type, hours]) => (
          <div key={type} className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-500 mb-1">{type}</p>
            <p className="text-2xl font-bold text-gray-900">{hours}</p>
            <p className="text-gray-400 text-sm">credits</p>
          </div>
        ))}
      </div>

      {/* Certificate List */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Certificates</h2>
        </div>
        
        {certificates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No certificates yet</p>
            <p className="text-sm text-gray-400">Attend events to earn continuing education credits</p>
          </div>
        ) : (
          <div className="divide-y">
            {certificates.map(cert => (
              <div key={cert.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{cert.event_title}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(cert.event_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {cert.credit_hours} {cert.credit_type} credits
                      </span>
                      {cert.accrediting_body && (
                        <span className="text-gray-400">• {cert.accrediting_body}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cert.certificate_url ? (
                    <a
                      href={cert.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">Processing...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
