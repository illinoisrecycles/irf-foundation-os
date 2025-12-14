'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { usePathname, useRouter } from 'next/navigation'
import { baseCommands } from '@/lib/commands/registry'
import type { AppRole, CommandItem } from '@/lib/commands/types'
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Gift, 
  Settings,
  Inbox,
  FileText,
  CreditCard
} from 'lucide-react'

type EntityHit = { 
  kind: 'member' | 'event' | 'donation'
  id: string
  title: string
  subtitle?: string
  href: string 
}

function getDefaultOrgId() {
  return process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
}

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  inbox: <Inbox className="h-4 w-4" />,
  members: <Users className="h-4 w-4" />,
  events: <Calendar className="h-4 w-4" />,
  donations: <Gift className="h-4 w-4" />,
  payments: <CreditCard className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  default: <FileText className="h-4 w-4" />,
}

function getIcon(id: string) {
  if (id.includes('dashboard')) return iconMap.dashboard
  if (id.includes('inbox')) return iconMap.inbox
  if (id.includes('member')) return iconMap.members
  if (id.includes('event')) return iconMap.events
  if (id.includes('donation')) return iconMap.donations
  if (id.includes('payment')) return iconMap.payments
  if (id.includes('setting')) return iconMap.settings
  return iconMap.default
}

export function CommandPalette({ role = 'admin' }: { role?: AppRole }) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [entities, setEntities] = React.useState<EntityHit[]>([])
  const pathname = usePathname()
  const router = useRouter()
  const orgId = getDefaultOrgId()

  // Keyboard shortcut
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k'
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Filter commands by role
  const commands = React.useMemo(() => {
    const allowed = (item: CommandItem) => !item.roles || item.roles.includes(role)
    return baseCommands.filter(allowed)
  }, [role])

  // Search entities (debounced)
  React.useEffect(() => {
    if (!open) return
    if (!q.trim()) {
      setEntities([])
      return
    }

    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&scope=all&orgId=${encodeURIComponent(orgId)}`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const data = (await res.json()) as { results: EntityHit[] }
        setEntities(data.results || [])
      } catch {
        // Ignore abort errors
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [q, open, orgId])

  const ctx = React.useMemo(() => ({
    orgId,
    role,
    pathname,
    routerPush: (href: string) => router.push(href),
  }), [orgId, role, pathname, router])

  const handleSelect = async (item: CommandItem) => {
    setOpen(false)
    setQ('')
    if (item.type === 'link') {
      router.push(item.href)
    } else {
      await item.run(ctx)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button 
        onClick={() => setOpen(true)}
        className="relative h-9 w-64 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary text-left flex items-center justify-between transition-colors"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 opacity-50" />
          Search...
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
          <Dialog.Content className="fixed left-1/2 top-24 z-50 w-[92vw] max-w-2xl -translate-x-1/2 rounded-xl border bg-background shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <Command className="w-full" shouldFilter={true}>
              <div className="flex items-center border-b px-4">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Command.Input
                  value={q}
                  onValueChange={setQ}
                  placeholder="Search members, events, donations... or type a command"
                  className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                {/* Navigation Commands */}
                <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {commands.filter(c => c.id.startsWith('nav.')).map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.title} ${(c.keywords || []).join(' ')}`}
                      className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted transition-colors"
                      onSelect={() => handleSelect(c)}
                    >
                      {getIcon(c.id)}
                      {c.title}
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Quick Actions */}
                <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {commands.filter(c => c.type === 'action').map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.title} ${(c.keywords || []).join(' ')}`}
                      className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted transition-colors"
                      onSelect={() => handleSelect(c)}
                    >
                      {getIcon(c.id)}
                      {c.title}
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Search Results */}
                {entities.length > 0 && (
                  <Command.Group heading="Search Results" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {entities.map((e) => (
                      <Command.Item
                        key={`${e.kind}:${e.id}`}
                        value={`${e.title} ${e.subtitle ?? ''}`}
                        className="flex cursor-pointer select-none flex-col rounded-lg px-3 py-2.5 aria-selected:bg-muted transition-colors"
                        onSelect={() => {
                          setOpen(false)
                          setQ('')
                          router.push(e.href)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground capitalize">{e.kind}</span>
                          <span className="text-sm font-medium">{e.title}</span>
                        </div>
                        {e.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{e.subtitle}</div>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
                <span>Type to search • Use ↑↓ to navigate • Enter to select</span>
                <span>ESC to close</span>
              </div>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
