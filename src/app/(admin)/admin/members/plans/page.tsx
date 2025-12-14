'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Users,
  DollarSign,
  Calendar,
  Check,
  X,
  Star
} from 'lucide-react'

const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

type MembershipPlan = {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: 'month' | 'year'
  features: string[]
  is_active: boolean
  is_default: boolean
  sort_order: number
  stripe_price_id: string | null
  member_count?: number
}

const planSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price_cents: z.number().min(0, 'Price must be positive'),
  billing_interval: z.enum(['month', 'year']),
  features: z.array(z.string()),
  is_active: z.boolean(),
  is_default: z.boolean(),
})

type PlanFormData = z.infer<typeof planSchema>

// Mock data for demo
const mockPlans: MembershipPlan[] = [
  {
    id: '1',
    name: 'Individual',
    description: 'Perfect for students and enthusiasts',
    price_cents: 15000,
    billing_interval: 'year',
    features: ['Digital Membership Card', 'Monthly Newsletter', 'Vote in Elections', 'Community Access'],
    is_active: true,
    is_default: false,
    sort_order: 1,
    stripe_price_id: 'price_123',
    member_count: 845,
  },
  {
    id: '2',
    name: 'Professional',
    description: 'For active industry professionals',
    price_cents: 45000,
    billing_interval: 'year',
    features: ['All Individual Features', 'Conference Discounts (20%)', 'Listed in Directory', 'Job Board Access', 'Grant Eligibility'],
    is_active: true,
    is_default: true,
    sort_order: 2,
    stripe_price_id: 'price_456',
    member_count: 1250,
  },
  {
    id: '3',
    name: 'Corporate',
    description: 'For organizations driving impact',
    price_cents: 199900,
    billing_interval: 'year',
    features: ['Up to 5 Professional Seats', 'Logo on Website', 'Exhibitor Priority', 'API Access', 'Dedicated Account Manager'],
    is_active: true,
    is_default: false,
    sort_order: 3,
    stripe_price_id: 'price_789',
    member_count: 156,
  },
]

export default function MembershipPlansPage() {
  const queryClient = useQueryClient()
  const [editingPlan, setEditingPlan] = React.useState<MembershipPlan | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const plans = mockPlans // Replace with real query

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      price_cents: 0,
      billing_interval: 'year',
      features: [],
      is_active: true,
      is_default: false,
    },
  })

  const [featureInput, setFeatureInput] = React.useState('')
  const [features, setFeatures] = React.useState<string[]>([])

  const openCreateDialog = () => {
    setEditingPlan(null)
    form.reset({
      name: '',
      description: '',
      price_cents: 0,
      billing_interval: 'year',
      features: [],
      is_active: true,
      is_default: false,
    })
    setFeatures([])
    setIsDialogOpen(true)
  }

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan)
    form.reset({
      name: plan.name,
      description: plan.description || '',
      price_cents: plan.price_cents,
      billing_interval: plan.billing_interval,
      features: plan.features,
      is_active: plan.is_active,
      is_default: plan.is_default,
    })
    setFeatures(plan.features)
    setIsDialogOpen(true)
  }

  const addFeature = () => {
    if (featureInput.trim()) {
      setFeatures([...features, featureInput.trim()])
      setFeatureInput('')
    }
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const onSubmit = (data: PlanFormData) => {
    console.log('Saving plan:', { ...data, features })
    // API call here
    setIsDialogOpen(false)
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const totalMembers = plans.reduce((sum, p) => sum + (p.member_count || 0), 0)
  const totalRevenue = plans.reduce((sum, p) => sum + (p.price_cents * (p.member_count || 0)), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            Membership Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            {plans.length} plan{plans.length !== 1 ? 's' : ''} • Configure pricing and benefits
          </p>
        </div>

        <button 
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" />
          Create Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{plans.length}</p>
              <p className="text-sm text-muted-foreground">Active Plans</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMembers.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Annual Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <div 
            key={plan.id}
            className={`relative rounded-xl border bg-card p-6 transition-all hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              plan.is_default ? 'ring-2 ring-primary' : ''
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {plan.is_default && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Star className="h-3 w-3" />
                Default
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
              </div>
              <button 
                onClick={() => openEditDialog(plan)}
                className="rounded-md p-2 hover:bg-muted/50 transition-colors"
              >
                <Edit className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold">{formatCurrency(plan.price_cents)}</span>
              <span className="text-muted-foreground">/{plan.billing_interval}</span>
            </div>

            <div className="space-y-2 mb-4">
              {plan.features.slice(0, 4).map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-green-600" />
                  </div>
                  {feature}
                </div>
              ))}
              {plan.features.length > 4 && (
                <p className="text-xs text-muted-foreground pl-6">
                  +{plan.features.length - 4} more features
                </p>
              )}
            </div>

            <div className="border-t pt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                {plan.member_count?.toLocaleString()} members
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {plan.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4">
              {editingPlan ? 'Edit Plan' : 'Create Plan'}
            </Dialog.Title>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Name *</label>
                <input
                  {...form.register('name')}
                  placeholder="e.g., Professional"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <input
                  {...form.register('description')}
                  placeholder="Brief description of this plan"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      {...form.register('price_cents', { 
                        setValueAs: (v) => Math.round(parseFloat(v) * 100) || 0 
                      })}
                      placeholder="150"
                      className="w-full h-10 rounded-lg border bg-background pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Billing Interval</label>
                  <select
                    {...form.register('billing_interval')}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="Add a feature..."
                    className="flex-1 h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2 mt-2">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-sm">{feature}</span>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...form.register('is_active')}
                    className="h-4 w-4 rounded border"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...form.register('is_default')}
                    className="h-4 w-4 rounded border"
                  />
                  <span className="text-sm">Default Plan</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
                >
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
