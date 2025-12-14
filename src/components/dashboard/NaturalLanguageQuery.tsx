'use client'

import * as React from 'react'
import { Search, Sparkles, Loader2, ArrowRight, MessageSquare, X, ChevronRight } from 'lucide-react'

type QueryResult = {
  answer: string
  data?: any[]
  chartType?: 'bar' | 'line' | 'pie' | 'table'
  sql?: string
}

const EXAMPLE_QUERIES = [
  "How many members joined this month?",
  "What's our retention rate this year?",
  "Show me top 10 donors by total giving",
  "Which events had the most attendance?",
  "How many members are at risk of churning?",
  "What's our revenue breakdown by type?",
]

type Props = {
  organizationId: string
}

export default function NaturalLanguageQuery({ organizationId }: Props) {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showExamples, setShowExamples] = React.useState(true)

  const handleSubmit = async (e?: React.FormEvent, queryOverride?: string) => {
    e?.preventDefault()
    const q = queryOverride || query
    if (!q.trim()) return

    setLoading(true)
    setError(null)
    setShowExamples(false)

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, organization_id: organizationId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Query failed')
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Ask Your Data</h2>
          <p className="text-sm text-gray-500">Ask questions in plain English</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-4">
        <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your organization..."
          className="w-full pl-12 pr-24 py-4 rounded-xl border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 text-lg"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </form>

      {showExamples && (
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLE_QUERIES.slice(0, 4).map((example, idx) => (
            <button
              key={idx}
              onClick={() => { setQuery(example); handleSubmit(undefined, example) }}
              className="px-3 py-1.5 bg-white rounded-full text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-4">{error}</div>}

      {result && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-lg text-gray-900">{result.answer}</p>
            <button onClick={() => { setResult(null); setQuery(''); setShowExamples(true) }} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {result.data && result.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(result.data[0]).map(key => (
                      <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">{key.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.data.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, cidx) => (
                        <td key={cidx} className="px-3 py-2 text-gray-600">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
