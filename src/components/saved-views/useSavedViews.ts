'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SavedView, SavedViewModule, TableViewState } from '@/lib/saved-views/types'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
const DEV_PROFILE_ID = process.env.NEXT_PUBLIC_DEV_PROFILE_ID || '00000000-0000-0000-0000-000000000000'

export function useSavedViews(module: SavedViewModule) {
  const qc = useQueryClient()

  const viewsQuery = useQuery({
    queryKey: ['saved-views', module],
    queryFn: async () => {
      const res = await fetch(`/api/saved-views?orgId=${encodeURIComponent(ORG_ID)}&module=${module}`)
      if (!res.ok) throw new Error('Failed to fetch saved views')
      return (await res.json()) as { views: SavedView[] }
    },
  })

  const createView = useMutation({
    mutationFn: async (input: { 
      name: string
      state: TableViewState
      is_shared?: boolean
      is_default?: boolean 
    }) => {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: ORG_ID,
          module,
          name: input.name,
          state: input.state,
          is_shared: !!input.is_shared,
          is_default: !!input.is_default,
          created_by_profile_id: DEV_PROFILE_ID,
        }),
      })
      if (!res.ok) throw new Error('Failed to create view')
      return (await res.json()) as { view: SavedView }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', module] }),
  })

  const updateView = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<SavedView> }) => {
      const res = await fetch(`/api/saved-views/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.patch),
      })
      if (!res.ok) throw new Error('Failed to update view')
      return (await res.json()) as { view: SavedView }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', module] }),
  })

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/saved-views/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete view')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', module] }),
  })

  return {
    views: viewsQuery.data?.views ?? [],
    isLoading: viewsQuery.isLoading,
    createView,
    updateView,
    deleteView,
  }
}
