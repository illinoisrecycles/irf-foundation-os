'use client'

import * as React from 'react'
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, X } from 'lucide-react'

// ============================================================================
// SMART CSV IMPORTER
// AI-assisted CSV import with column mapping
// ============================================================================

type ImportType = 'members' | 'transactions' | 'donations' | 'contacts'

type ColumnMapping = {
  sourceColumn: string
  targetField: string
  sampleValues: string[]
}

type ImporterProps = {
  importType?: ImportType
  onComplete?: (result: { imported: number; errors: number }) => void
}

const FIELD_DEFINITIONS: Record<ImportType, { field: string; label: string; required?: boolean }[]> = {
  members: [
    { field: 'email', label: 'Email', required: true },
    { field: 'first_name', label: 'First Name' },
    { field: 'last_name', label: 'Last Name' },
    { field: 'company', label: 'Company/Organization' },
    { field: 'title', label: 'Job Title' },
    { field: 'phone', label: 'Phone' },
    { field: 'member_type', label: 'Member Type' },
    { field: 'status', label: 'Status' },
  ],
  transactions: [
    { field: 'date', label: 'Date', required: true },
    { field: 'amount', label: 'Amount', required: true },
    { field: 'description', label: 'Description' },
    { field: 'merchant', label: 'Merchant/Payee' },
    { field: 'category', label: 'Category' },
    { field: 'reference', label: 'Reference/Check #' },
  ],
  donations: [
    { field: 'email', label: 'Donor Email', required: true },
    { field: 'amount', label: 'Amount', required: true },
    { field: 'date', label: 'Date' },
    { field: 'first_name', label: 'First Name' },
    { field: 'last_name', label: 'Last Name' },
    { field: 'fund', label: 'Fund/Campaign' },
    { field: 'notes', label: 'Notes' },
  ],
  contacts: [
    { field: 'email', label: 'Email', required: true },
    { field: 'first_name', label: 'First Name' },
    { field: 'last_name', label: 'Last Name' },
    { field: 'phone', label: 'Phone' },
    { field: 'company', label: 'Company' },
    { field: 'tags', label: 'Tags' },
  ],
}

export function SmartCSVImporter({ importType = 'members', onComplete }: ImporterProps) {
  const [step, setStep] = React.useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload')
  const [file, setFile] = React.useState<File | null>(null)
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Record<string, string>[]>([])
  const [mappings, setMappings] = React.useState<Record<string, string>>({})
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<{ imported: number; errors: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const fields = FIELD_DEFINITIONS[importType]

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setError(null)

    try {
      const text = await uploadedFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row')
      }

      const headerRow = parseCSVLine(lines[0])
      setHeaders(headerRow)

      const dataRows = lines.slice(1, 101).map(line => {
        const values = parseCSVLine(line)
        const row: Record<string, string> = {}
        headerRow.forEach((h, i) => {
          row[h] = values[i] || ''
        })
        return row
      })
      setRows(dataRows)

      // Auto-map columns based on name similarity
      const autoMappings: Record<string, string> = {}
      fields.forEach(({ field }) => {
        const match = headerRow.find(h => 
          h.toLowerCase().replace(/[_\s]/g, '') === field.toLowerCase().replace(/[_\s]/g, '') ||
          h.toLowerCase().includes(field.toLowerCase())
        )
        if (match) {
          autoMappings[field] = match
        }
      })
      setMappings(autoMappings)

      setStep('mapping')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)

    try {
      // Transform rows based on mappings
      const transformedData = rows.map(row => {
        const transformed: Record<string, any> = {}
        Object.entries(mappings).forEach(([field, sourceColumn]) => {
          if (sourceColumn && row[sourceColumn] !== undefined) {
            transformed[field] = row[sourceColumn]
          }
        })
        return transformed
      })

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_type: importType,
          data: transformedData,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await res.json()
      setResult({ imported: data.processed, errors: data.errors })
      setStep('complete')
      onComplete?.({ imported: data.processed, errors: data.errors })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setRows([])
    setMappings({})
    setResult(null)
    setError(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Progress steps */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          {['Upload', 'Map Columns', 'Preview', 'Import'].map((label, i) => {
            const stepIndex = ['upload', 'mapping', 'preview', 'importing'].indexOf(step)
            const isActive = i === stepIndex
            const isComplete = i < stepIndex || step === 'complete'

            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isComplete ? 'bg-green-100 text-green-600' :
                    isActive ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isComplete ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-sm ${isActive ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </div>
                {i < 3 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <div className="p-6">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload your CSV file</h3>
            <p className="text-gray-500 mb-6">
              We'll help you map columns to the correct fields
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
              <Upload className="w-5 h-5" />
              <span>Choose File</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Map Columns</h3>
            <p className="text-gray-500 mb-6">
              Match your CSV columns to the correct fields. We've auto-detected some mappings.
            </p>

            <div className="space-y-4">
              {fields.map(({ field, label, required }) => (
                <div key={field} className="flex items-center gap-4">
                  <label className="w-40 text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={mappings[field] || ''}
                    onChange={(e) => setMappings(prev => ({ ...prev, [field]: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  >
                    <option value="">— Select column —</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {mappings[field] && rows[0] && (
                    <span className="text-sm text-gray-400 w-40 truncate">
                      e.g. "{rows[0][mappings[field]]}"
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={reset} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!fields.filter(f => f.required).every(f => mappings[f.field])}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview Import</h3>
            <p className="text-gray-500 mb-6">
              Review the first few rows before importing. {rows.length} total rows will be imported.
            </p>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {fields.filter(f => mappings[f.field]).map(({ field, label }) => (
                      <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {fields.filter(f => mappings[f.field]).map(({ field }) => (
                        <td key={field} className="px-4 py-3 text-sm text-gray-900">
                          {row[mappings[field]] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setStep('mapping')} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Import {rows.length} Rows
              </button>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && result && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Import Complete!</h3>
            <p className="text-gray-500 mb-6">
              Successfully imported {result.imported} records
              {result.errors > 0 && ` (${result.errors} errors)`}
            </p>
            <button
              onClick={reset}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple CSV line parser (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}
