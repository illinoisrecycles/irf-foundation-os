'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  CheckCircle, AlertTriangle, Search, Sparkles, Loader2, 
  ChevronRight, Edit2, X, Database, Users, DollarSign, Calendar,
  ArrowRight, RefreshCw
} from 'lucide-react'

type MappingField = {
  source: string
  target: string
  confidence: number
  transformNote?: string
}

type Conflict = {
  field: string
  proposals: {
    sourceField: string
    targetPath: string
    confidence: number
    reasoning: string
  }[]
}

export default function MigrationPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [confidences, setConfidences] = useState<Record<string, number>>({})
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [unmapped, setUnmapped] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  useEffect(() => {
    fetchPreview()
  }, [sessionId])

  const fetchPreview = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/migrate/preview/${sessionId}`)
      const data = await res.json()
      
      setSession(data.session)
      setMapping(data.mapping || {})
      setConfidences(data.confidenceByField || {})
      setConflicts(data.conflicts || [])
      setUnmapped(data.unmappedFields || [])
    } catch (err) {
      console.error('Failed to fetch preview:', err)
    }
    setLoading(false)
  }

  const resolveConflict = (sourceField: string, targetPath: string) => {
    setMapping(prev => ({ ...prev, [sourceField]: targetPath }))
    setConflicts(prev => prev.filter(c => c.field !== sourceField))
    setConfidences(prev => ({ ...prev, [sourceField]: 1.0 })) // User-confirmed = 100%
  }

  const askAIForSuggestion = async (sourceField: string) => {
    try {
      const res = await fetch('/api/migrate/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sourceField }),
      })
      const { suggestion } = await res.json()
      if (suggestion) {
        resolveConflict(sourceField, suggestion)
      }
    } catch (err) {
      console.error('AI suggestion failed:', err)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setImportProgress(0)

    try {
      const res = await fetch('/api/migrate/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, finalMapping: mapping }),
      })

      if (!res.ok) throw new Error('Import failed')

      // Poll for progress
      let attempts = 0
      while (attempts < 120) {
        await new Promise(r => setTimeout(r, 1000))
        
        const statusRes = await fetch(`/api/migrate/status/${sessionId}`)
        const status = await statusRes.json()
        
        setImportProgress(status.progress_percent || 0)

        if (status.status === 'complete') {
          router.push(`/admin/migrate/${sessionId}/success`)
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Import failed')
        }

        attempts++
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setImporting(false)
    }
  }

  const filteredFields = Object.entries(mapping).filter(([source]) =>
    source.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const overallConfidence = session?.ai_confidence || 0
  const mappedCount = Object.keys(mapping).length
  const totalFields = mappedCount + unmapped.length

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'bg-green-500'
    if (conf >= 0.7) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTargetIcon = (target: string) => {
    if (target.startsWith('profiles')) return <Users className="w-4 h-4" />
    if (target.startsWith('donations')) return <DollarSign className="w-4 h-4" />
    if (target.startsWith('events')) return <Calendar className="w-4 h-4" />
    return <Database className="w-4 h-4" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Migration Preview</h1>
        <p className="text-xl text-gray-600 mt-2">
          AI has mapped your data with{' '}
          <span className="font-bold text-primary">{Math.round(overallConfidence * 100)}%</span> confidence
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-green-600">{mappedCount}</div>
          <p className="text-gray-600 mt-1">Fields Mapped</p>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-blue-600">
            {session?.detected_row_count?.toLocaleString() || '—'}
          </div>
          <p className="text-gray-600 mt-1">Total Records</p>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className={`text-4xl font-bold ${conflicts.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {conflicts.length}
          </div>
          <p className="text-gray-600 mt-1">Need Review</p>
        </div>
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl font-bold text-gray-400">{unmapped.length}</div>
          <p className="text-gray-600 mt-1">Unmapped</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Mapping Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold">Field Mapping</h2>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64"
              />
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Field</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maps To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFields.map(([source, target]) => {
                  const confidence = confidences[source] || 0
                  const isConflict = conflicts.some(c => c.field === source)

                  return (
                    <tr key={source} className={isConflict ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{source}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingField === source ? (
                          <select
                            autoFocus
                            value={target}
                            onChange={e => {
                              setMapping(prev => ({ ...prev, [source]: e.target.value }))
                              setEditingField(null)
                            }}
                            onBlur={() => setEditingField(null)}
                            className="px-3 py-1 border rounded-lg text-sm w-full"
                          >
                            <option value="ignore">— Ignore —</option>
                            <optgroup label="Profiles">
                              <option value="profiles.full_name">profiles.full_name</option>
                              <option value="profiles.first_name">profiles.first_name</option>
                              <option value="profiles.last_name">profiles.last_name</option>
                              <option value="profiles.email">profiles.email</option>
                              <option value="profiles.phone">profiles.phone</option>
                              <option value="profiles.company">profiles.company</option>
                              <option value="profiles.job_title">profiles.job_title</option>
                              <option value="profiles.address_line1">profiles.address_line1</option>
                              <option value="profiles.city">profiles.city</option>
                              <option value="profiles.state">profiles.state</option>
                              <option value="profiles.zip">profiles.zip</option>
                            </optgroup>
                            <optgroup label="Membership">
                              <option value="member_organizations.organization_name">member_organizations.organization_name</option>
                              <option value="member_organizations.joined_at">member_organizations.joined_at</option>
                              <option value="member_organizations.expires_at">member_organizations.expires_at</option>
                              <option value="member_organizations.external_id">member_organizations.external_id</option>
                            </optgroup>
                            <optgroup label="Donations">
                              <option value="donations.amount_cents">donations.amount_cents</option>
                              <option value="donations.donor_name">donations.donor_name</option>
                              <option value="donations.donor_email">donations.donor_email</option>
                            </optgroup>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                            {getTargetIcon(target)}
                            {target}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getConfidenceColor(confidence)}`}
                              style={{ width: `${confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">
                            {Math.round(confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditingField(source)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conflicts Sidebar */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Conflicts ({conflicts.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              AI found multiple possible matches
            </p>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {conflicts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No conflicts!</p>
                <p className="text-sm text-gray-500 mt-1">Ready to import</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {conflicts.map(conflict => (
                  <div key={conflict.field} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="font-medium text-gray-900">{conflict.field}</p>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      Multiple possible matches detected
                    </p>
                    
                    <div className="space-y-2">
                      {conflict.proposals.map((prop, i) => (
                        <button
                          key={i}
                          onClick={() => resolveConflict(conflict.field, prop.targetPath)}
                          className="w-full text-left px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            {getTargetIcon(prop.targetPath)}
                            {prop.targetPath}
                          </span>
                          <span className="text-gray-500">
                            {Math.round(prop.confidence * 100)}%
                          </span>
                        </button>
                      ))}
                      
                      <button
                        onClick={() => askAIForSuggestion(conflict.field)}
                        className="w-full text-left px-3 py-2 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 text-sm flex items-center gap-2 text-purple-800"
                      >
                        <Sparkles className="w-4 h-4" />
                        Ask AI for best match
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unmapped Fields */}
      {unmapped.length > 0 && (
        <div className="bg-gray-50 rounded-xl border p-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <X className="w-5 h-5 text-gray-400" />
            Unmapped Fields ({unmapped.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These fields will be skipped during import
          </p>
          <div className="flex flex-wrap gap-2">
            {unmapped.map(field => (
              <span key={field} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Import Button */}
      <div className="sticky bottom-8 flex justify-end">
        <button
          onClick={handleImport}
          disabled={importing || conflicts.length > 0}
          className="inline-flex items-center gap-3 px-10 py-5 bg-green-600 text-white text-xl font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
        >
          {importing ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Importing... {importProgress}%
            </>
          ) : conflicts.length > 0 ? (
            <>
              <AlertTriangle className="w-6 h-6" />
              Resolve {conflicts.length} Conflicts First
            </>
          ) : (
            <>
              <ChevronRight className="w-6 h-6" />
              Start Import ({session?.detected_row_count?.toLocaleString()} records)
            </>
          )}
        </button>
      </div>
    </div>
  )
}
