'use client'

import * as React from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Search, MapPin, Building2, Filter } from 'lucide-react'

type Member = {
  id: string
  name: string
  type: string
  city: string
  state: string
  description: string
}

export default function DirectoryPage() {
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')

  const members: Member[] = [
    { id: '1', name: 'Green Recycling Co', type: 'MRF', city: 'Chicago', state: 'IL', description: 'Full-service recycling facility' },
    { id: '2', name: 'Metro Waste Solutions', type: 'Hauler', city: 'Naperville', state: 'IL', description: 'Residential and commercial hauling' },
    { id: '3', name: 'EcoTech Recyclers', type: 'E-Waste', city: 'Aurora', state: 'IL', description: 'Electronics recycling specialist' },
    { id: '4', name: 'Prairie Compost', type: 'Composting', city: 'Joliet', state: 'IL', description: 'Commercial composting facility' },
    { id: '5', name: 'Sustainable Consulting', type: 'Consultant', city: 'Springfield', state: 'IL', description: 'Recycling program development' },
  ]

  const types = ['All', 'MRF', 'Hauler', 'E-Waste', 'Composting', 'Consultant']

  const filtered = members.filter(m => {
    const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.city.toLowerCase().includes(search.toLowerCase())
    const matchesType = !typeFilter || typeFilter === 'All' || m.type === typeFilter
    return matchesSearch && matchesType
  })

  return (
    <PublicLayout>
      <div className="bg-green-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Member Directory</h1>
          <p className="text-xl text-green-100">Connect with recycling professionals across Illinois</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 border rounded-lg"
          >
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {filtered.map(member => (
            <div key={member.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{member.city}, {member.state}</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-sm">{member.type}</span>
                  </div>
                  <p className="text-gray-600 mt-2">{member.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No members found matching your search.</div>
        )}
      </div>
    </PublicLayout>
  )
}
