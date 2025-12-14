'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Inbox, 
  Clock, 
  AlertCircle, 
  Calendar,
  CheckCircle2,
  Bell,
  MoreHorizontal,
  ChevronRight
} from 'lucide-react'

type WorkItem = {
  id: string
  type: 'task' | 'alert' | 'approval'
  module: string
  title: string
  body: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'snoozed' | 'done'
  due_at: string | null
  snoozed_until: string | null
  reference_type: string | null
  reference_id: string | null
  actions: Record<string, { label: string; href: string }>
  created_at: string
}

const tabs = [
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
  { id: 'week', label: 'This Week', icon: Calendar },
  { id: 'all', label: 'All', icon: Inbox },
] as const

const priorityColors = {
  low: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const moduleColors: Record<string, string> = {
  memberships: 'bg-purple-100 text-purple-700',
  donations: 'bg-green-100 text-green-700',
  events: 'bg-yellow-100 text-yellow-700',
  grants: 'bg-cyan-100 text-cyan-700',
  finance: 'bg-emerald-100 text-emerald-700',
  general: 'bg-gray-100 text-gray-700',
}

export default function InboxPage() {
  const [tab, setTab] = React.useState<'today' | 'overdue' | 'week' | 'all'>('today')
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['work-items', tab],
    queryFn: async () => {
      // No orgId param - derived from session via middleware
      const res = await fetch(`/api/work-items?tab=${tab}`)
      if (!res.ok) throw new Error('Failed to fetch work items')
      return (await res.json()) as { items: WorkItem[] }
    },
  })

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      if (!res.ok) throw new Error('Failed to update')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-items'] }),
  })

  const snooze = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const until = new Date()
      until.setDate(until.getDate() + days)
      const res = await fetch(`/api/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'snoozed', snoozed_until: until.toISOString() }),
      })
      if (!res.ok) throw new Error('Failed to snooze')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-items'] }),
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Inbox className="h-6 w-6 text-primary" />
            </div>
            Work Inbox
          </h1>
          <p className="text-muted-foreground mt-1">Everything that needs attention, in one queue.</p>
        </div>
        <button 
          onClick={() => qc.invalidateQueries({ queryKey: ['work-items'] })}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-4">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Work Items */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="font-semibold">Queue</h2>
          <span className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load work items</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">
              No items in this view. Check other tabs or enjoy the peace.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item, i) => (
              <div 
                key={item.id} 
                className="p-4 hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-left-2"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`rounded-lg p-2 ${
                    item.type === 'alert' ? 'bg-orange-100 text-orange-600' :
                    item.type === 'approval' ? 'bg-purple-100 text-purple-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Bell className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${moduleColors[item.module] || moduleColors.general}`}>
                        {item.module}
                      </span>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${priorityColors[item.priority]}`}>
                        {item.priority}
                      </span>
                      <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                        {item.type}
                      </span>
                    </div>

                    <h3 className="font-medium">{item.title}</h3>
                    {item.body && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
                    )}

                    {item.due_at && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {new Date(item.due_at).toLocaleDateString()} at {new Date(item.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {/* Primary Action */}
                    {item.actions?.primary && (
                      <a 
                        href={item.actions.primary.href}
                        className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
                      >
                        {item.actions.primary.label}
                        <ChevronRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => markDone.mutate(item.id)}
                      disabled={markDone.isPending}
                      className="rounded-md bg-green-100 text-green-700 px-3 py-1.5 text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      Done
                    </button>
                    <div className="relative group">
                      <button className="rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-popover shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          onClick={() => snooze.mutate({ id: item.id, days: 1 })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          Snooze 1 day
                        </button>
                        <button
                          onClick={() => snooze.mutate({ id: item.id, days: 3 })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          Snooze 3 days
                        </button>
                        <button
                          onClick={() => snooze.mutate({ id: item.id, days: 7 })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          Snooze 1 week
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
