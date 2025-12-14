'use client'

import Link from 'next/link'
import { Building2, Calendar, Users, FileText, ArrowRight, CheckCircle, Recycle } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="font-bold text-xl text-green-700 flex items-center gap-2">
              <Recycle className="w-6 h-6" />
              IRF
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-green-700 font-medium">Home</Link>
              <Link href="/find-a-recycler" className="text-gray-600 hover:text-gray-900">Find a Recycler</Link>
              <Link href="/directory" className="text-gray-600 hover:text-gray-900">Directory</Link>
              <Link href="/events" className="text-gray-600 hover:text-gray-900">Events</Link>
              <Link href="/jobs" className="text-gray-600 hover:text-gray-900">Jobs</Link>
              <Link href="/resources" className="text-gray-600 hover:text-gray-900">Resources</Link>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/portal" className="text-gray-600 hover:text-gray-900 text-sm">Member Login</Link>
              <Link href="/join" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                Join Now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-green-700 to-green-900 text-white py-24">
          <div className="max-w-6xl mx-auto px-4">
            <div className="max-w-3xl">
              <h1 className="text-5xl font-bold mb-6">
                Advancing Recycling Across Illinois
              </h1>
              <p className="text-xl text-green-100 mb-8">
                Join the Illinois Recycling Foundation and connect with recycling professionals, 
                access resources, and help build a more sustainable future.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link 
                  href="/join" 
                  className="px-8 py-4 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors"
                >
                  Become a Member
                </Link>
                <Link 
                  href="/find-a-recycler" 
                  className="px-8 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 transition-colors border border-green-500"
                >
                  Find a Recycler
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Why Join IRF?
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Connect with Illinois&apos;s leading recycling professionals and access exclusive resources
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Building2, title: 'Member Directory', description: 'Connect with 280+ organizations across Illinois' },
                { icon: Calendar, title: 'Events & Training', description: 'Conferences, webinars, and networking opportunities' },
                { icon: FileText, title: 'Resources', description: 'Guides, research, and best practices library' },
                { icon: Users, title: 'Community', description: 'Forums and discussion groups with peers' },
              ].map((feature, idx) => (
                <div key={idx} className="text-center p-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
                    <feature.icon className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 bg-green-700 text-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '280+', label: 'Member Organizations' },
                { value: '15+', label: 'Years of Service' },
                { value: '1,000+', label: 'Annual Event Attendees' },
                { value: '50+', label: 'Resources Available' },
              ].map((stat, idx) => (
                <div key={idx}>
                  <div className="text-4xl font-bold mb-2">{stat.value}</div>
                  <div className="text-green-100">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Membership Plans */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Membership Plans
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12">
              Choose the plan that fits your organization
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Individual', price: 75, features: ['Directory listing', 'Event discounts', 'Resource access', 'Newsletter'] },
                { name: 'Business', price: 250, features: ['Everything in Individual', 'Job board posting', 'Enhanced listing', 'Multiple contacts'], popular: true },
                { name: 'Municipality', price: 150, features: ['Everything in Individual', 'Government resources', 'Policy updates', 'Multiple contacts'] },
                { name: 'Nonprofit', price: 100, features: ['Everything in Individual', 'Nonprofit resources', 'Grant notifications', 'Volunteer network'] },
              ].map((plan, idx) => (
                <div key={idx} className={`bg-white rounded-2xl p-6 border-2 ${plan.popular ? 'border-green-500 shadow-lg' : 'border-gray-200'}`}>
                  {plan.popular && (
                    <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Most Popular</div>
                  )}
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-500">/year</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link 
                    href="/join"
                    className={`block w-full py-3 rounded-xl font-medium text-center transition-colors ${
                      plan.popular 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Join?</h2>
            <p className="text-xl text-green-100 mb-8">
              Become part of Illinois&apos;s recycling community today
            </p>
            <Link
              href="/join"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors"
            >
              Become a Member <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-white mb-4">Illinois Recycling Foundation</h3>
              <p className="text-sm">Advancing recycling and sustainable materials management across Illinois.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/find-a-recycler" className="hover:text-white">Find a Recycler</Link></li>
                <li><Link href="/directory" className="hover:text-white">Member Directory</Link></li>
                <li><Link href="/events" className="hover:text-white">Events</Link></li>
                <li><Link href="/jobs" className="hover:text-white">Job Board</Link></li>
                <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Membership</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/join" className="hover:text-white">Join IRF</Link></li>
                <li><Link href="/benefits" className="hover:text-white">Member Benefits</Link></li>
                <li><Link href="/portal" className="hover:text-white">Member Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>Springfield, IL</li>
                <li>info@illinoisrecycles.org</li>
                <li>(217) 555-0100</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
            © {new Date().getFullYear()} Illinois Recycling Foundation. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
