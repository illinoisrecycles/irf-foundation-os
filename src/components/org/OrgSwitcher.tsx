'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown, Plus, Settings } from 'lucide-react'

// ============================================================================
// ORG SWITCHER
// Switch between organizations the user is a member of
// ============================================================================

type Organization = {
  organization_id: string
  role: string
  organizations: {
    id: string
    name: string
    slug: string
  }
}

export function OrgSwitcher() {
  const [open, setOpen] = React.useState(false)
  const qc = useQueryClient()
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch user's organizations
  const { data, isLoading } = useQuery({
    queryKey: ['user-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/org/active')
      if (!res.ok) throw new Error('Failed to fetch organizations')
      return res.json() as Promise<{
        organizations: Organization[]
        activeOrganizationId: string | null
      }>
    },
  })

  // Switch organization
  const switchOrg = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch('/api/org/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (!res.ok) throw new Error('Failed to switch organization')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries()
      setOpen(false)
      // Reload to refresh all data with new org context
      window.location.reload()
    },
  })

  const organizations = data?.organizations || []
  const activeOrgId = data?.activeOrganizationId
  const activeOrg = organizations.find(o => o.organization_id === activeOrgId)

  if (isLoading) {
    return (
      <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
    )
  }

  if (organizations.length === 0) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors min-w-[200px]"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium truncate">
            {activeOrg?.organizations?.name || 'Select Organization'}
          </p>
          {activeOrg && (
            <p className="text-xs text-muted-foreground capitalize">{activeOrg.role}</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b">
            <p className="text-xs font-medium text-muted-foreground px-2">Your Organizations</p>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {organizations.map((org) => (
              <button
                key={org.organization_id}
                onClick={() => switchOrg.mutate(org.organization_id)}
                disabled={switchOrg.isPending}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  org.organization_id === activeOrgId 
                    ? 'bg-primary/10 text-primary' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.organizations?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{org.role}</p>
                </div>
                {org.organization_id === activeOrgId && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="p-2 border-t space-y-1">
            <a
              href="/admin/settings/organization"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Organization Settings
            </a>
            <a
              href="/admin/settings/team"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Invite Team Members
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for sidebars
export function OrgSwitcherCompact() {
  const { data } = useQuery({
    queryKey: ['user-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/org/active')
      if (!res.ok) return { organizations: [], activeOrganizationId: null }
      return res.json()
    },
  })

  const organizations = data?.organizations || []
  const activeOrgId = data?.activeOrganizationId
  const activeOrg = organizations.find((o: Organization) => o.organization_id === activeOrgId)

  if (!activeOrg) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium truncate">{activeOrg.organizations?.name}</span>
    </div>
  )
}
