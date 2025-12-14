'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useSavedViews } from './useSavedViews'
import type { SavedViewModule, TableViewState } from '@/lib/saved-views/types'
import { ChevronDown, Save, Trash2, Star, Share2 } from 'lucide-react'

export function SavedViewsBar({
  module,
  currentState,
  onApply,
  activeViewId,
  onActiveViewChange,
}: {
  module: SavedViewModule
  currentState: TableViewState
  onApply: (state: TableViewState) => void
  activeViewId?: string | null
  onActiveViewChange?: (id: string | null) => void
}) {
  const { views, isLoading, createView, deleteView } = useSavedViews(module)
  const [name, setName] = React.useState('')
  const [showSaveInput, setShowSaveInput] = React.useState(false)

  const activeView = views.find(v => v.id === activeViewId)

  const handleSave = () => {
    if (!name.trim()) return
    createView.mutate(
      { name: name.trim(), state: currentState },
      {
        onSuccess: (data) => {
          setName('')
          setShowSaveInput(false)
          onActiveViewChange?.(data.view.id)
        },
      }
    )
  }

  const handleApply = (view: typeof views[0]) => {
    onApply(view.state)
    onActiveViewChange?.(view.id)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this view?')) {
      deleteView.mutate(id)
      if (activeViewId === id) {
        onActiveViewChange?.(null)
      }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
            {activeView ? (
              <>
                <Star className="h-4 w-4 text-primary" />
                {activeView.name}
              </>
            ) : (
              'All Items'
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content 
            className="min-w-64 rounded-xl border bg-popover p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-2"
            sideOffset={5}
          >
            {/* Default View */}
            <DropdownMenu.Item
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors ${
                !activeViewId ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                onApply({})
                onActiveViewChange?.(null)
              }}
            >
              All Items
            </DropdownMenu.Item>

            {views.length > 0 && <DropdownMenu.Separator className="my-2 h-px bg-border" />}

            {/* Saved Views */}
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
            ) : views.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No saved views yet</div>
            ) : (
              views.map((v) => (
                <DropdownMenu.Item
                  key={v.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors group ${
                    activeViewId === v.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleApply(v)}
                >
                  <div className="flex items-center gap-2">
                    {v.is_default && <Star className="h-3 w-3 text-yellow-500" />}
                    {v.is_shared && <Share2 className="h-3 w-3 text-blue-500" />}
                    <span>{v.name}</span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(v.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenu.Item>
              ))
            )}

            <DropdownMenu.Separator className="my-2 h-px bg-border" />

            {/* Save Current View */}
            {showSaveInput ? (
              <div className="px-2 py-2">
                <div className="text-xs text-muted-foreground mb-2">Save current filters as view</div>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="View name..."
                    className="flex-1 h-8 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') setShowSaveInput(false)
                    }}
                  />
                  <button
                    onClick={handleSave}
                    disabled={!name.trim() || createView.isPending}
                    className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  setShowSaveInput(true)
                }}
              >
                <Save className="h-4 w-4" />
                Save current view
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
