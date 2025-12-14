'use client'

import * as React from 'react'
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

type ColumnMapping = Record<string, string | null>
type PreviewRow = Record<string, string>

type ImporterProps = {
  importType: 'members' | 'donations' | 'events'
  organizationId: string
  onComplete?: (result: { success: number; errors: number }) => void
}

const TARGET_FIELDS: Record<string, { label: string; required?: boolean }[]> = {
  members: [
    { label: 'name', required: true },
    { label: 'email', required: true },
    { label: 'phone' },
    { label: 'address' },
    { label: 'city' },
    { label: 'state' },
    { label: 'zip' },
    { label: 'membership_type' },
    { label: 'joined_date' },
    { label: 'expires_date' },
  ],
  donations: [
    { label: 'donor_name', required: true },
    { label: 'email', required: true },
    { label: 'amount', required: true },
    { label: 'date' },
    { label: 'campaign' },
    { label: 'notes' },
  ],
  events: [
    { label: 'title', required: true },
    { label: 'start_date', required: true },
    { label: 'end_date' },
    { label: 'location' },
    { label: 'description' },
    { label: 'capacity' },
  ],
}

export default function SmartCSVImporter({ importType, organizationId, onComplete }: ImporterProps) {
  const [step, setStep] = React.useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload')
  const [file, setFile] = React.useState<File | null>(null)
  const [headers, setHeaders] = React.useState<string[]>([])
  const [suggestedMappings, setSuggestedMappings] = React.useState<ColumnMapping>({})
  const [mappings, setMappings] = React.useState<ColumnMapping>({})
  const [preview, setPreview] = React.useState<PreviewRow[]>([])
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState({ current: 0, total: 0 })
  const [result, setResult] = React.useState<{ success: number; errors: number; errorDetails: any[] } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const targetFields = TARGET_FIELDS[importType]

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setError(null)

    const formData = new FormData()
    formData.append('file', uploadedFile)
    formData.append('organization_id', organizationId)
    formData.append('import_type', importType)

    try {
      const response = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setJobId(data.job_id)
      setHeaders(data.headers)
      setSuggestedMappings(data.suggested_mappings)
      setMappings(data.suggested_mappings)
      setPreview(data.preview)
      setProgress({ current: 0, total: data.total_rows })
      setStep('mapping')
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    }
  }

  const handleImport = async () => {
    if (!jobId) return

    setStep('importing')

    try {
      // Parse CSV locally for import
      const text = await file!.text()
      const lines = text.split('\n').filter(l => l.trim())
      const dataRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
      })

      const response = await fetch('/api/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          column_mapping: mappings,
          data: dataRows,
        }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setResult({
        success: data.success_count,
        errors: data.error_count,
        errorDetails: data.errors || [],
      })
      setStep('complete')
      onComplete?.({ success: data.success_count, errors: data.error_count })
    } catch (err: any) {
      setError(err.message || 'Import failed')
      setStep('mapping')
    }
  }

  const getMappingConfidence = (header: string): 'high' | 'medium' | 'none' => {
    const suggested = suggestedMappings[header]
    if (!suggested) return 'none'
    const normalized = header.toLowerCase()
    if (normalized === suggested || normalized.includes(suggested)) return 'high'
    return 'medium'
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {['upload', 'mapping', 'preview', 'complete'].map((s, idx) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${
              step === s ? 'text-blue-600' : 
              ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > idx ? 'text-green-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-blue-600 text-white' :
                ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > idx ? 'bg-green-600 text-white' : 'bg-gray-200'
              }`}>
                {['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step) > idx ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className="text-sm font-medium capitalize">{s}</span>
            </div>
            {idx < 3 && <div className="flex-1 h-0.5 bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="text-center py-12">
          <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload CSV File</h3>
          <p className="text-gray-500 mb-6">Import your {importType} from a CSV file</p>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            <Upload className="w-5 h-5" />
            Choose File
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Map Your Columns</h3>
          <p className="text-gray-500 mb-6">We've detected {headers.length} columns. Please verify the mappings below.</p>

          <div className="space-y-4 mb-6">
            {headers.map(header => {
              const confidence = getMappingConfidence(header)
              return (
                <div key={header} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{header}</span>
                      {confidence === 'high' && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">Auto-matched</span>
                      )}
                      {confidence === 'medium' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">Suggested</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Sample: {preview[0]?.[header] || '(empty)'}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                  <select
                    value={mappings[header] || ''}
                    onChange={(e) => setMappings({ ...mappings, [header]: e.target.value || null })}
                    className="w-48 px-3 py-2 border rounded-lg"
                  >
                    <option value="">— Skip this column —</option>
                    {targetFields.map(field => (
                      <option key={field.label} value={field.label}>
                        {field.label} {field.required && '*'}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('upload')} className="px-6 py-3 border rounded-lg text-gray-600 hover:bg-gray-50">
              Back
            </button>
            <button onClick={() => setStep('preview')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Preview Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Preview Import</h3>
          <p className="text-gray-500 mb-6">Review the first 5 rows before importing {progress.total} records.</p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {Object.entries(mappings).filter(([_, v]) => v).map(([header, target]) => (
                    <th key={header} className="px-4 py-2 text-left font-medium text-gray-900">
                      {target}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    {Object.entries(mappings).filter(([_, v]) => v).map(([header]) => (
                      <td key={header} className="px-4 py-2 text-gray-600">
                        {row[header] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('mapping')} className="px-6 py-3 border rounded-lg text-gray-600 hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleImport} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Import {progress.total} Records
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="text-center py-12">
          <Loader2 className="w-16 h-16 mx-auto text-blue-600 animate-spin mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Importing...</h3>
          <p className="text-gray-500">Please wait while we import your data.</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && result && (
        <div className="text-center py-12">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
            result.errors === 0 ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            {result.errors === 0 ? (
              <Check className="w-8 h-8 text-green-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete</h3>
          <p className="text-gray-500 mb-4">
            Successfully imported <span className="font-semibold text-green-600">{result.success}</span> records.
            {result.errors > 0 && (
              <> <span className="font-semibold text-red-600">{result.errors}</span> errors.</>
            )}
          </p>

          {result.errorDetails.length > 0 && (
            <div className="text-left max-w-md mx-auto mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
              <div className="bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto text-sm">
                {result.errorDetails.slice(0, 10).map((err, idx) => (
                  <div key={idx} className="text-red-800">
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setStep('upload')
              setFile(null)
              setHeaders([])
              setMappings({})
              setPreview([])
              setResult(null)
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
