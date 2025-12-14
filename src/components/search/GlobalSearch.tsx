'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  X, 
  User, 
  DollarSign, 
  Calendar, 
  FileText,
  Mail,
  Inbox,
  Building2,
  Loader2
} from 'lucide-react'

// ============================================================================
// GLOBAL SEARCH
// Search across members, payments, events, grants, work items, emails
// ============================================================================

type SearchResult = {
  id: string
  type: 'member' | 'payment' | 'event' | 'grant' | 'work_item' | 'email' | 'organization'
  title: string
  subtitle?: string
  url: string
  metadata?: Record<string, any>
}

type SearchResultsGrouped = {
  [key: string]: SearchResult[]
}

const typeIcons: Record<string, React.ReactNode> = {
  member: <User className="w-4 h-4" />,
  payment: <DollarSign className="w-4 h-4" />,
  event: <Calendar className="w-4 h-4" />,
  grant: <FileText className="w-4 h-4" />,
  work_item: <Inbox className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  organization: <Building2 className="w-4 h-4" />,
}

const typeLabels: Record<string, string> = {
  member: 'Members',
  payment: 'Payments',
  event: 'Events',
  grant: 'Grants',
  work_item: 'Work Items',
  email: 'Emails',
  organization: 'Organizations',
}

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut to open search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Search debounce
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setSelectedIndex(0)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].url)
      setOpen(false)
      setQuery('')
    }
  }

  // Group results by type
  const grouped: SearchResultsGrouped = React.useMemo(() => {
    return results.reduce((acc, result) => {
      if (!acc[result.type]) acc[result.type] = []
      acc[result.type].push(result)
      return acc
    }, {} as SearchResultsGrouped)
  }, [results])

  const handleSelect = (result: SearchResult) => {
    router.push(result.url)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-xs text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[10vh]">
          <div 
            className="w-full max-w-2xl bg-popover rounded-xl shadow-2xl border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search members, payments, events, grants..."
                className="flex-1 bg-transparent text-lg outline-none"
              />
              {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {query && !loading && results.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No results found for "{query}"</p>
                </div>
              )}

              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    {typeLabels[type] || type}
                  </div>
                  {items.map((result, i) => {
                    const globalIndex = results.findIndex(r => r.id === result.id)
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                          globalIndex === selectedIndex ? 'bg-muted/50' : ''
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-muted">
                          {typeIcons[result.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">↵</kbd> Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">esc</kbd> Close
              </span>
            </div>
          </div>
          
          {/* Click outside to close */}
          <div className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
