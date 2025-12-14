'use client'

import * as React from 'react'
import { Briefcase, Plus, Search, Eye, Edit, Trash2, CheckCircle, Clock, XCircle, MapPin, DollarSign, Building2 } from 'lucide-react'

export default function JobsPage() {
  const jobs = [
    { id: '1', title: 'Recycling Program Manager', company: 'City of Springfield', location: 'Springfield, IL', type: 'full_time', status: 'published', posted: '2024-03-10', applications: 12 },
    { id: '2', title: 'MRF Operations Supervisor', company: 'Green Recycling Co', location: 'Chicago, IL', type: 'full_time', status: 'published', posted: '2024-03-08', applications: 8 },
    { id: '3', title: 'Environmental Consultant', company: 'EcoMaterials LLC', location: 'Remote', type: 'contract', status: 'draft', posted: null, applications: 0 },
    { id: '4', title: 'Route Driver', company: 'Waste Management Inc.', location: 'Peoria, IL', type: 'full_time', status: 'expired', posted: '2024-02-01', applications: 24 },
  ]

  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    published: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    draft: { color: 'bg-gray-100 text-gray-800', icon: Clock },
    expired: { color: 'bg-red-100 text-red-800', icon: XCircle },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Board</h1>
          <p className="text-gray-600 mt-1">Manage job postings for members</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Post Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Active Listings</p>
          <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'published').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total Applications</p>
          <p className="text-2xl font-bold">{jobs.reduce((sum, j) => sum + j.applications, 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Draft</p>
          <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'draft').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Expired</p>
          <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'expired').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search jobs..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <select className="px-4 py-2 border rounded-lg">
          <option>All Statuses</option>
          <option>Published</option>
          <option>Draft</option>
          <option>Expired</option>
        </select>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((job) => {
              const status = statusConfig[job.status]
              const StatusIcon = status.icon
              return (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{job.title}</div>
                    <div className="text-sm text-gray-500 capitalize">{job.type.replace('_', ' ')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {job.company}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{job.applications}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-2 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-2 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
