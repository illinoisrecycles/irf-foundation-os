'use client'

import * as React from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { FileText, Download, Lock, Search } from 'lucide-react'

type Resource = {
  id: string
  title: string
  category: string
  type: string
  membersOnly: boolean
  downloads: number
}

export default function ResourcesPage() {
  const [search, setSearch] = React.useState('')

  const resources: Resource[] = [
    { id: '1', title: '2024 Illinois Recycling Guidelines', category: 'Guidelines', type: 'PDF', membersOnly: false, downloads: 342 },
    { id: '2', title: 'MRF Operations Best Practices', category: 'Best Practices', type: 'PDF', membersOnly: true, downloads: 156 },
    { id: '3', title: 'Contamination Reduction Toolkit', category: 'Toolkit', type: 'ZIP', membersOnly: true, downloads: 89 },
    { id: '4', title: 'Grant Writing Template', category: 'Templates', type: 'DOCX', membersOnly: true, downloads: 67 },
    { id: '5', title: 'Illinois Recycling Statistics 2024', category: 'Research', type: 'PDF', membersOnly: false, downloads: 234 },
  ]

  const filtered = resources.filter(r => 
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PublicLayout>
      <div className="bg-orange-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Resources</h1>
          <p className="text-xl text-orange-100">Guides, research, and best practices</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border rounded-lg"
          />
        </div>

        <div className="space-y-4">
          {filtered.map(resource => (
            <div key={resource.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <FileText className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{resource.title}</h3>
                      {resource.membersOnly && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          <Lock className="w-3 h-3" /> Members Only
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{resource.category}</span>
                      <span>{resource.type}</span>
                      <span>{resource.downloads} downloads</span>
                    </div>
                  </div>
                </div>
                <button className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  resource.membersOnly 
                    ? 'bg-gray-100 text-gray-600' 
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}>
                  <Download className="w-4 h-4" />
                  {resource.membersOnly ? 'Login to Download' : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
