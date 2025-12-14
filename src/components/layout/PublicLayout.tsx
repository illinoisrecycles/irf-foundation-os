'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Recycle } from 'lucide-react'

export default function PublicLayout({ children }: { children: ReactNode }) {
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
              <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
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
        {children}
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
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Membership</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/join" className="hover:text-white">Join IRF</Link></li>
                <li><Link href="/portal" className="hover:text-white">Member Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>Springfield, IL</li>
                <li>info@illinoisrecycles.org</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
            © {new Date().getFullYear()} Illinois Recycling Foundation
          </div>
        </div>
      </footer>
    </div>
  )
}
