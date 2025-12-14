'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, Calendar, Mail, FileText, DollarSign,
  Settings, Building2, Globe, Briefcase, Heart, CreditCard,
  Award, BarChart3, MessageSquare, Inbox, ChevronLeft, ChevronRight,
  Search, Bell, User, Menu, Recycle, Zap, Link2, Upload, BookOpen
} from 'lucide-react'

type NavItem = 
  | { type: 'divider'; name: string; href?: never; icon?: never }
  | { type?: never; name: string; href: string; icon: LucideIcon }

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Members', href: '/admin/members', icon: Users },
  { name: 'Directory', href: '/admin/directory', icon: Building2 },
  { name: 'Events', href: '/admin/events', icon: Calendar },
  { name: 'Email', href: '/admin/email', icon: Mail },
  { name: 'Community', href: '/admin/community', icon: MessageSquare },
  { name: 'Resources', href: '/admin/resources', icon: FileText },
  { name: 'Website', href: '/admin/website', icon: Globe },
  { name: 'Jobs', href: '/admin/jobs', icon: Briefcase },
  { name: 'Donations', href: '/admin/donations', icon: Heart },
  { name: 'Finances', href: '/admin/finances', icon: DollarSign },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Grants', href: '/admin/grants', icon: Award },
  { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { name: 'Social', href: '/admin/social', icon: MessageSquare },
  { name: 'Inbox', href: '/admin/inbox', icon: Inbox },
  { type: 'divider', name: 'Automation' },
  { name: 'Automation', href: '/admin/automation', icon: Zap },
  { name: 'Integrations', href: '/admin/integrations', icon: Link2 },
  { name: 'Import', href: '/admin/import', icon: Upload },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-white border-r flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b flex items-center justify-between">
          {!collapsed && (
            <Link href="/admin" className="font-bold text-xl text-green-700 flex items-center gap-2">
              <Recycle className="w-6 h-6" />
              IRF Admin
            </Link>
          )}
          {collapsed && <Recycle className="w-6 h-6 text-green-700 mx-auto" />}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-gray-100 rounded">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item, idx) =>
              item.type === 'divider' ? (
                <li key={idx} className="pt-4 pb-2">
                  {!collapsed && <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.name}</span>}
                  {collapsed && <div className="border-t my-2" />}
                </li>
              ) : (
                <li key={item.name}>
                  {(() => {
                    const Icon = item.icon
                    return (
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          pathname === item.href
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                        title={collapsed ? item.name : undefined}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && item.name}
                      </Link>
                    )
                  })()}
                </li>
              )
            )}
          </ul>
        </nav>

        <div className="p-4 border-t">
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-5 h-5" />
            {!collapsed && 'Settings'}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search... (⌘K)"
                className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-green-700" />
              </div>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
