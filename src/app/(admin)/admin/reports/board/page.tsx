'use client'

import * as React from 'react'
import { FileText, Download, Calendar, Sparkles, Loader2, CheckCircle, Clock } from 'lucide-react'

type BoardReport = {
  id: string
  period_type: string
  period_start: string
  period_end: string
  pdf_url: string
  ai_summary: string
  created_at: string
}

export default function BoardReportsPage() {
  const [reports, setReports] = React.useState<BoardReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [selectedPeriod, setSelectedPeriod] = React.useState('ytd')

  React.useEffect(() => {
    fetch('/api/reports/board-packet?organization_id=demo-org')
      .then(res => res.json())
      .then(data => setReports(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const generateReport = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/reports/board-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: 'demo-org',
          period: selectedPeriod,
          include_ai_summary: true,
        }),
      })

      if (response.ok) {
        const newReport = await response.json()
        setReports([newReport, ...reports])
      }
    } finally {
      setGenerating(false)
    }
  }

  const periods = [
    { value: 'ytd', label: 'Year to Date' },
    { value: 'q1', label: 'Q1' },
    { value: 'q2', label: 'Q2' },
    { value: 'q3', label: 'Q3' },
    { value: 'q4', label: 'Q4' },
    { value: 'month', label: 'This Month' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Board Reports</h1>
          <p className="text-gray-500">Auto-generated board packets with AI summaries</p>
        </div>
      </div>

      {/* Generate New Report */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/20 rounded-xl">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Generate Board Packet</h2>
            <p className="text-blue-200">AI-powered executive summary included</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white font-medium"
          >
            {periods.map(p => (
              <option key={p.value} value={p.value} className="text-gray-900">
                {p.label}
              </option>
            ))}
          </select>

          <button
            onClick={generateReport}
            disabled={generating}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Report
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-blue-200 mt-4">
          Includes: membership stats, revenue breakdown, top events, donor analysis, and AI-generated recommendations
        </p>
      </div>

      {/* Previous Reports */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Previous Reports</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No reports generated yet</p>
            <p className="text-sm text-gray-400">Generate your first board packet above</p>
          </div>
        ) : (
          <div className="divide-y">
            {reports.map(report => (
              <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {report.period_type.toUpperCase()} Report
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(report.period_start).toLocaleDateString()} - {new Date(report.period_end).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Generated {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {report.ai_summary && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Summary
                    </span>
                  )}
                  {report.pdf_url ? (
                    <a
                      href={report.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
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
