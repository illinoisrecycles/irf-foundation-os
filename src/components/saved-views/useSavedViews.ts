'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// SAVED VIEWS HOOK
// Manages saved views per user+org (no hardcoded IDs)
// ============================================================================

export type SavedView = {
  id: string
  name: string
  view_type: string
  filters: Record<string, any>
  columns?: string[]
  sort?: { column: string; direction: 'asc' | 'desc' }
  is_default?: boolean
  is_shared?: boolean
  created_at: string
}

type UseSavedViewsOptions = {
  viewType: string
}

export function useSavedViews({ viewType }: UseSavedViewsOptions) {
  const [views, setViews] = useState<SavedView[]>([])
  const [activeView, setActiveView] = useState<SavedView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch views from API (which uses session context)
  const fetchViews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/saved-views?view_type=${viewType}`)
      if (!res.ok) throw new Error('Failed to fetch views')
      
      const data = await res.json()
      setViews(data.views || [])
      
      // Set default view if exists
      const defaultView = data.views?.find((v: SavedView) => v.is_default)
      if (defaultView) setActiveView(defaultView)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [viewType])

  useEffect(() => {
    fetchViews()
  }, [fetchViews])

  const saveView = useCallback(async (view: Omit<SavedView, 'id' | 'created_at'>) => {
    try {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...view, view_type: viewType }),
      })
      
      if (!res.ok) throw new Error('Failed to save view')
      
      const data = await res.json()
      setViews(prev => [...prev, data.view])
      return data.view
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [viewType])

  const updateView = useCallback(async (id: string, updates: Partial<SavedView>) => {
    try {
      const res = await fetch(`/api/saved-views/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      if (!res.ok) throw new Error('Failed to update view')
      
      const data = await res.json()
      setViews(prev => prev.map(v => v.id === id ? data.view : v))
      if (activeView?.id === id) setActiveView(data.view)
      return data.view
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [activeView])

  const deleteView = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/saved-views/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete view')
      
      setViews(prev => prev.filter(v => v.id !== id))
      if (activeView?.id === id) setActiveView(null)
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [activeView])

  const setDefault = useCallback(async (id: string) => {
    // Unset current default
    const currentDefault = views.find(v => v.is_default)
    if (currentDefault && currentDefault.id !== id) {
      await updateView(currentDefault.id, { is_default: false })
    }
    // Set new default
    await updateView(id, { is_default: true })
  }, [views, updateView])

  return {
    views,
    activeView,
    setActiveView,
    loading,
    error,
    saveView,
    updateView,
    deleteView,
    setDefault,
    refresh: fetchViews,
  }
}
