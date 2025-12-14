'use client'

import * as React from 'react'
import { Search, Loader2, AlertCircle, Table } from 'lucide-react'

// ============================================================================
// NATURAL LANGUAGE QUERY COMPONENT
// AI-powered database queries - org context derived from session
// ============================================================================

type QueryResult = {
  columns: string[]
  rows: Record<string, any>[]
  explanation: string
  sql?: string
}

export default function NaturalLanguageQuery() {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [showSql, setShowSql] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
        // No organization_id - derived from session
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Query failed')
      }

      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const examples = [
    'Show me members who joined this month',
    'What are my top 10 donors by total amount?',
    'How many event registrations do we have this year?',
    'Show overdue payments',
    'Which members have low engagement scores?',
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ask a Question</h3>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your data..."
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
          </button>
        </div>
      </form>

      {/* Example queries */}
      <div className="flex flex-wrap gap-2 mb-4">
        {examples.map((example) => (
          <button
            key={example}
            onClick={() => setQuery(example)}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6">
          {/* Explanation */}
          <p className="text-gray-600 mb-4">{result.explanation}</p>

          {/* SQL toggle */}
          {result.sql && (
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-sm text-blue-600 hover:text-blue-700 mb-2"
            >
              {showSql ? 'Hide SQL' : 'Show SQL'}
            </button>
          )}
          {showSql && result.sql && (
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto mb-4">
              {result.sql}
            </pre>
          )}

          {/* Results table */}
          {result.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {result.columns.map((col) => (
                        <td key={col} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 50 && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing 50 of {result.rows.length} results
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Table className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 1000) {
      return value.toLocaleString()
    }
    return value.toString()
  }
  if (value instanceof Date) return value.toLocaleDateString()
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString()
  }
  return String(value)
}
