'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  X,
  Building2,
  Users,
  CreditCard,
  Workflow,
  Upload,
  BookOpen,
  Sparkles
} from 'lucide-react'

// ============================================================================
// ONBOARDING CHECKLIST
// First-run checklist to guide users through setup
// ============================================================================

type OnboardingStep = {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  completed: boolean
  category: 'setup' | 'import' | 'configure' | 'launch'
}

const ONBOARDING_STEPS: Omit<OnboardingStep, 'completed'>[] = [
  {
    id: 'create_org',
    title: 'Create your organization',
    description: 'Set up your organization profile with name, logo, and contact info',
    icon: <Building2 className="w-5 h-5" />,
    href: '/admin/settings/organization',
    category: 'setup',
  },
  {
    id: 'invite_team',
    title: 'Invite team members',
    description: 'Add colleagues and assign roles (admin, finance, staff)',
    icon: <Users className="w-5 h-5" />,
    href: '/admin/settings/team',
    category: 'setup',
  },
  {
    id: 'connect_stripe',
    title: 'Connect payment processing',
    description: 'Link your Stripe account to accept payments and donations',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/admin/integrations',
    category: 'setup',
  },
  {
    id: 'setup_chart_of_accounts',
    title: 'Set up chart of accounts',
    description: 'Configure your GL accounts for bookkeeping',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/admin/bookkeeping',
    category: 'configure',
  },
  {
    id: 'import_members',
    title: 'Import your members',
    description: 'Upload your existing member list from CSV',
    icon: <Upload className="w-5 h-5" />,
    href: '/admin/import',
    category: 'import',
  },
  {
    id: 'create_automation',
    title: 'Create your first automation',
    description: 'Set up automatic workflows for common tasks',
    icon: <Workflow className="w-5 h-5" />,
    href: '/admin/automation',
    category: 'configure',
  },
  {
    id: 'connect_bank',
    title: 'Connect your bank account',
    description: 'Link your bank for automatic transaction import',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/admin/integrations',
    category: 'configure',
  },
  {
    id: 'create_event',
    title: 'Create your first event',
    description: 'Set up an event with registration and check-in',
    icon: <Sparkles className="w-5 h-5" />,
    href: '/admin/events',
    category: 'launch',
  },
]

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = React.useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const res = await fetch('/api/onboarding/status')
      if (!res.ok) return { completed: [], dismissed: false }
      return res.json() as Promise<{ completed: string[]; dismissed: boolean }>
    },
  })

  const dismiss = useMutation({
    mutationFn: async () => {
      await fetch('/api/onboarding/dismiss', { method: 'POST' })
    },
    onSuccess: () => {
      setDismissed(true)
      qc.invalidateQueries({ queryKey: ['onboarding-status'] })
    },
  })

  const markComplete = useMutation({
    mutationFn: async (stepId: string) => {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-status'] }),
  })

  if (isLoading || dismissed || data?.dismissed) return null

  const completedSteps = data?.completed || []
  const steps: OnboardingStep[] = ONBOARDING_STEPS.map(s => ({
    ...s,
    completed: completedSteps.includes(s.id),
  }))

  const completedCount = steps.filter(s => s.completed).length
  const progress = Math.round((completedCount / steps.length) * 100)

  // If all done, show congratulations then auto-dismiss
  if (completedCount === steps.length) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Setup complete!</h3>
            <p className="text-sm text-green-700">
              You've completed all onboarding steps. You're ready to go!
            </p>
          </div>
          <button
            onClick={() => dismiss.mutate()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Get Started with FoundationOS</h3>
          <p className="text-sm text-muted-foreground">
            Complete these steps to set up your organization
          </p>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Dismiss checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">{completedCount} of {steps.length} complete</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y">
        {steps.map((step) => (
          <a
            key={step.id}
            href={step.href}
            className={`flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors ${
              step.completed ? 'opacity-60' : ''
            }`}
          >
            <div className={`p-2 rounded-lg ${
              step.completed 
                ? 'bg-green-100 text-green-600' 
                : 'bg-primary/10 text-primary'
            }`}>
              {step.completed ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${step.completed ? 'line-through' : ''}`}>
                {step.title}
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            {!step.completed && (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// Compact version for sidebar
export function OnboardingProgress() {
  const { data } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const res = await fetch('/api/onboarding/status')
      if (!res.ok) return { completed: [], dismissed: false }
      return res.json()
    },
  })

  if (data?.dismissed) return null

  const completedCount = data?.completed?.length || 0
  const totalSteps = ONBOARDING_STEPS.length
  const progress = Math.round((completedCount / totalSteps) * 100)

  if (progress === 100) return null

  return (
    <div className="px-3 py-2">
      <div className="text-xs text-muted-foreground mb-1">
        Setup: {completedCount}/{totalSteps}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
