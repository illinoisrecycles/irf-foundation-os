'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, User, Calendar, FileText, CreditCard, Settings,
  MessageSquare, Download, BarChart2, Bell, LogOut, Menu, X, ChevronDown
} from 'lucide-react'

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: BarChart2 },
  { href: '/portal/profile', label: 'Organization Profile', icon: Building2 },
  { href: '/portal/contacts', label: 'Contacts', icon: User },
  { href: '/portal/events', label: 'Events', icon: Calendar },
  { href: '/portal/invoices', label: 'Invoices & Payments', icon: CreditCard },
  { href: '/portal/resources', label: 'Resources', icon: Download },
  { href: '/portal/community', label: 'Community', icon: MessageSquare },
  { href: '/portal/directory', label: 'Directory Listing', icon: FileText },
]

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Mock member data - would come from auth context
  const member = {
    name: 'Green Recycling Co',
    plan: 'Business Premium',
    expires: '2025-03-15',
    logo: null,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal" className="font-bold text-xl text-green-700">
                IRF Member Portal
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              
              <div className="flex items-center gap-3 pl-4 border-l">
                {member.logo ? (
                  <img src={member.logo} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-green-600" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">{member.name}</div>
                  <div className="text-xs text-gray-500">{member.plan}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className={`w-64 flex-shrink-0 ${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
            <nav className="bg-white rounded-xl border p-4 sticky top-24">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/portal' && pathname.startsWith(item.href))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-6 pt-6 border-t">
                <Link
                  href="/portal/settings"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Settings className="w-5 h-5" />
                  Settings
                </Link>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>

              {/* Membership Status Card */}
              <div className="mt-6 p-4 bg-green-50 rounded-xl">
                <div className="text-xs text-green-600 font-medium uppercase tracking-wider">Membership</div>
                <div className="text-sm font-semibold text-green-800 mt-1">{member.plan}</div>
                <div className="text-xs text-green-600 mt-1">
                  Expires: {new Date(member.expires).toLocaleDateString()}
                </div>
                <Link
                  href="/portal/invoices"
                  className="mt-3 block text-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  Renew Now
                </Link>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
