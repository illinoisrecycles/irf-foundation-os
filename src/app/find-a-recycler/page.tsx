'use client'

import * as React from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Search, MapPin, Filter, Phone, Globe, Mail, Building2, Recycle } from 'lucide-react'

type Member = {
  id: string
  name: string
  description: string
  services: string[]
  materials: string[]
  city: string
  state: string
  phone: string
  email: string
  website: string
  distance?: number
}

export default function FindARecyclerPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [zipCode, setZipCode] = React.useState('')
  const [radius, setRadius] = React.useState('50')
  const [selectedServices, setSelectedServices] = React.useState<string[]>([])
  const [showFilters, setShowFilters] = React.useState(false)

  const services = ['Residential Hauling', 'Commercial Hauling', 'MRF Processing', 'Composting', 'E-Waste', 'Consulting']
  const materials = ['Paper/Cardboard', 'Plastics', 'Glass', 'Metals', 'Electronics', 'Organics']

  const members: Member[] = [
    { id: '1', name: 'Green Recycling Co', description: 'Full-service MRF processing residential and commercial recyclables.', services: ['MRF Processing', 'Commercial Hauling'], materials: ['Paper/Cardboard', 'Plastics', 'Glass', 'Metals'], city: 'Chicago', state: 'IL', phone: '(312) 555-0100', email: 'info@greenrecycling.com', website: 'greenrecycling.com', distance: 12 },
    { id: '2', name: 'Metro Waste Solutions', description: 'Residential and commercial waste hauling serving the greater Chicago area.', services: ['Residential Hauling', 'Commercial Hauling'], materials: ['Paper/Cardboard', 'Plastics', 'Glass', 'Metals', 'Organics'], city: 'Naperville', state: 'IL', phone: '(630) 555-0200', email: 'service@metrowaste.com', website: 'metrowaste.com', distance: 28 },
    { id: '3', name: 'EcoTech Recyclers', description: 'Specialized electronics recycling and data destruction. R2 certified.', services: ['E-Waste'], materials: ['Electronics'], city: 'Aurora', state: 'IL', phone: '(630) 555-0300', email: 'info@ecotech.com', website: 'ecotech.com', distance: 35 },
    { id: '4', name: 'Prairie Compost', description: 'Commercial composting facility accepting food waste and yard waste.', services: ['Composting'], materials: ['Organics'], city: 'Joliet', state: 'IL', phone: '(815) 555-0400', email: 'info@prairiecompost.com', website: 'prairiecompost.com', distance: 42 },
  ]

  const filteredMembers = members.filter(m => {
    const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.city.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesServices = selectedServices.length === 0 || selectedServices.some(s => m.services.includes(s))
    return matchesSearch && matchesServices
  })

  const toggleService = (s: string) => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const clearFilters = () => { setSelectedServices([]); setZipCode(''); setSearchQuery('') }
  const activeFilterCount = selectedServices.length + (zipCode ? 1 : 0)

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm mb-4">
              <Recycle className="w-4 h-4" /> Illinois Recycling Foundation
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Find a Recycler</h1>
            <p className="text-xl text-green-100">Connect with recycling professionals across Illinois</p>
          </div>

          {/* Search */}
          <div className="bg-white rounded-2xl p-2 shadow-2xl max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by name, city, or service..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-lg" />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="ZIP" value={zipCode} onChange={(e) => setZipCode(e.target.value)}
                    className="w-24 pl-10 pr-2 py-4 text-gray-900 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <select value={radius} onChange={(e) => setRadius(e.target.value)} className="px-3 py-4 text-gray-900 rounded-xl border">
                  <option value="25">25 mi</option>
                  <option value="50">50 mi</option>
                  <option value="100">100 mi</option>
                </select>
                <button onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-6 py-4 rounded-xl font-medium ${showFilters || activeFilterCount > 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  <Filter className="w-5 h-5" /> Filters
                  {activeFilterCount > 0 && <span className="w-6 h-6 bg-white text-green-600 rounded-full text-sm font-bold flex items-center justify-center">{activeFilterCount}</span>}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 p-6 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                  {activeFilterCount > 0 && <button onClick={clearFilters} className="text-sm text-green-600">Clear all</button>}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {services.map(s => (
                      <button key={s} onClick={() => toggleService(s)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${selectedServices.includes(s) ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border hover:border-green-500'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-gray-600 mb-6"><span className="font-semibold text-gray-900">{filteredMembers.length}</span> recyclers found</p>

        <div className="space-y-4">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-2xl border-2 border-transparent hover:border-green-200 p-6 hover:shadow-lg transition-all">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-10 h-10 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                      <div className="flex items-center gap-2 text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{member.city}, {member.state}</span>
                        {member.distance && <span className="text-green-600 font-medium">· {member.distance} mi</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={`tel:${member.phone}`} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><Phone className="w-5 h-5 text-gray-600" /></a>
                      <a href={`mailto:${member.email}`} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><Mail className="w-5 h-5 text-gray-600" /></a>
                      <a href={`https://${member.website}`} target="_blank" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><Globe className="w-5 h-5 text-gray-600" /></a>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-3">{member.description}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {member.services.map(s => <span key={s} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">{s}</span>)}
                  </div>
                  {member.materials.length > 0 && (
                    <div className="text-sm text-gray-500 mt-3"><span className="font-medium">Accepts:</span> {member.materials.join(', ')}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-16">
            <Recycle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No recyclers found</h3>
            <button onClick={clearFilters} className="text-green-600 font-medium">Clear filters</button>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
