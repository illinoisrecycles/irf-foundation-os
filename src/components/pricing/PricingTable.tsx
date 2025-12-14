'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'

const plans = [
  {
    name: 'Individual',
    price: { monthly: 15, yearly: 150 },
    description: 'Perfect for students, educators, and enthusiasts.',
    features: [
      'Digital Membership Card',
      'Monthly Newsletter',
      'Vote in Board Elections',
      'Community Forum Access',
      'Member-Only Resources',
    ],
  },
  {
    name: 'Professional',
    price: { monthly: 45, yearly: 450 },
    isPopular: true,
    description: 'For active industry professionals and leaders.',
    features: [
      'All Individual Features',
      'Conference Discounts (20%)',
      'Listed in Public Directory',
      'Access to Job Board',
      'Grant Eligibility',
      'Networking Events Access',
      'Certificate of Membership',
    ],
  },
  {
    name: 'Corporate',
    price: { monthly: 199, yearly: 1990 },
    description: 'For organizations driving circular economy.',
    features: [
      'Up to 5 Professional Seats',
      'Logo on Website',
      'Exhibitor Priority',
      'API Access',
      'Dedicated Account Manager',
      'Custom Training Sessions',
      'Sponsorship Opportunities',
    ],
  },
]

export function PricingTable() {
  const [isYearly, setIsYearly] = useState(true)

  return (
    <div className="py-12 max-w-6xl mx-auto px-4">
      <div className="text-center mb-12 space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">Invest in the Future of Recycling</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Your membership dues fund critical research, advocacy efforts, and community programs. 
          Join 2,800+ members making a difference today.
        </p>
        
        {/* Toggle Switch */}
        <div className="flex justify-center items-center gap-3 mt-6">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <button 
            onClick={() => setIsYearly(!isYearly)}
            className="relative w-14 h-7 rounded-full bg-secondary border-2 border-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Toggle billing period"
          >
            <div 
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-primary shadow-sm transition-transform duration-200 ${
                isYearly ? 'translate-x-7' : 'translate-x-0'
              }`} 
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Yearly 
            <span className="text-green-600 text-xs ml-1.5 font-bold bg-green-100 px-1.5 py-0.5 rounded-full">
              Save 15%
            </span>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan, index) => (
          <div 
            key={plan.name} 
            className={`relative flex flex-col p-8 rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 ${
              plan.isPopular 
                ? 'border-primary ring-2 ring-primary shadow-lg scale-105 z-10' 
                : 'shadow-sm hover:border-primary/50'
            }`}
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
          >
            {plan.isPopular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-lg flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Most Popular
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{plan.description}</p>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">
                ${isYearly ? plan.price.yearly : plan.price.monthly}
              </span>
              <span className="text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
            </div>

            {isYearly && (
              <p className="text-xs text-muted-foreground mb-4">
                That&apos;s just ${(plan.price.yearly / 12).toFixed(0)}/month billed annually
              </p>
            )}

            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button 
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                plan.isPopular 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {plan.isPopular ? 'Get Started' : `Choose ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground mb-4">Trusted by organizations across Illinois</p>
        <div className="flex justify-center items-center gap-8 opacity-60">
          <div className="h-8 w-24 bg-muted rounded" />
          <div className="h-8 w-20 bg-muted rounded" />
          <div className="h-8 w-28 bg-muted rounded" />
          <div className="h-8 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}
