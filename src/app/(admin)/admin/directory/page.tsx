'use client'

import * as React from 'react'
import { Building2, Search, Filter, Grid, List, MapPin, Globe, Eye, EyeOff, Settings } from 'lucide-react'

export default function DirectoryPage() {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  
  const members = [
    { id: '1', name: 'Waste Management Inc.', city: 'Springfield', state: 'IL', industry: 'Hauler', visible: true },
    { id: '2', name: 'Green Recycling Co', city: 'Chicago', state: 'IL', industry: 'MRF', visible: true },
    { id: '3', name: 'EcoMaterials LLC', city: 'Peoria', state: 'IL', industry: 'Manufacturer', visible: false },
    { id: '4', name: 'City of Champaign', city: 'Champaign', state: 'IL', industry: 'Municipality', visible: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Member Directory</h1>
          <p className="text-gray-600 mt-1">Manage public directory listings</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            Directory Settings
          </button>
          <a href="/directory" target="_blank" className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Eye className="w-4 h-4" />
            View Public Directory
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total Listings</p>
          <p className="text-2xl font-bold">{members.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Visible</p>
          <p className="text-2xl font-bold text-green-600">{members.filter(m => m.visible).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Hidden</p>
          <p className="text-2xl font-bold text-gray-600">{members.filter(m => !m.visible).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="text-2xl font-bold">8</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search directory..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <select className="px-4 py-2 border rounded-lg">
          <option>All Categories</option>
          <option>Hauler</option>
          <option>MRF</option>
          <option>Manufacturer</option>
          <option>Municipality</option>
        </select>
        <select className="px-4 py-2 border rounded-lg">
          <option>All Visibility</option>
          <option>Visible</option>
          <option>Hidden</option>
        </select>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}>
            <Grid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Directory Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {members.map((member) => (
            <div key={member.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-gray-500" />
                </div>
                <button className={`p-2 rounded ${member.visible ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
                  {member.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <h3 className="font-medium text-gray-900 mt-3">{member.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <MapPin className="w-3 h-3" />
                {member.city}, {member.state}
              </div>
              <span className="inline-block mt-2 px-2 py-1 bg-gray-100 rounded text-xs">{member.industry}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{member.name}</td>
                  <td className="px-6 py-4 text-gray-600">{member.city}, {member.state}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{member.industry}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${member.visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {member.visible ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
