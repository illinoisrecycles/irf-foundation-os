export type SavedViewModule = 'members' | 'donations' | 'events' | 'payments' | 'grants'

export type TableViewState = {
  filters?: Array<{ id: string; value: unknown }>
  sorting?: Array<{ id: string; desc: boolean }>
  columnVisibility?: Record<string, boolean>
  columnOrder?: string[]
  pageSize?: number
  globalFilter?: string
}

export type SavedView = {
  id: string
  organization_id: string
  module: SavedViewModule
  name: string
  is_shared: boolean
  is_default: boolean
  state: TableViewState
  created_by_profile_id: string
  created_at: string
  updated_at: string
}
