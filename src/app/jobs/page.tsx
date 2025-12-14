'use client'

import * as React from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Briefcase, MapPin, Clock, DollarSign, Building2 } from 'lucide-react'

type Job = {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary: string
  posted: string
}

export default function JobsPage() {
  const jobs: Job[] = [
    { id: '1', title: 'MRF Operations Manager', company: 'Green Recycling Co', location: 'Chicago, IL', type: 'Full-time', salary: '$65,000 - $85,000', posted: '2 days ago' },
    { id: '2', title: 'Recycling Coordinator', company: 'City of Springfield', location: 'Springfield, IL', type: 'Full-time', salary: '$45,000 - $55,000', posted: '1 week ago' },
    { id: '3', title: 'Route Driver', company: 'Metro Waste Solutions', location: 'Naperville, IL', type: 'Full-time', salary: '$22 - $28/hr', posted: '3 days ago' },
    { id: '4', title: 'Sustainability Consultant', company: 'EcoAdvisors LLC', location: 'Remote', type: 'Contract', salary: '$75 - $100/hr', posted: '5 days ago' },
  ]

  return (
    <PublicLayout>
      <div className="bg-blue-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Job Board</h1>
          <p className="text-xl text-blue-100">Find your next opportunity in recycling</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                      <Building2 className="w-4 h-4" />
                      <span>{job.company}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-gray-600 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{job.salary}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{job.posted}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">{job.type}</span>
                    </div>
                  </div>
                </div>
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
