'use client'

import * as React from 'react'
import { FileSpreadsheet, Users, DollarSign, Calendar, Download, Upload } from 'lucide-react'
import SmartCSVImporter from '@/components/import/SmartCSVImporter'

export default function ImportPage() {
  const [selectedType, setSelectedType] = React.useState<'members' | 'donations' | 'events' | null>(null)
  const [showImporter, setShowImporter] = React.useState(false)

  const importTypes = [
    {
      id: 'members' as const,
      name: 'Members',
      description: 'Import member organizations with contacts',
      icon: Users,
      fields: ['name', 'email', 'phone', 'address', 'membership_type', 'joined_date', 'expires_date'],
    },
    {
      id: 'donations' as const,
      name: 'Donations',
      description: 'Import historical donation records',
      icon: DollarSign,
      fields: ['donor_name', 'email', 'amount', 'date', 'campaign', 'notes'],
    },
    {
      id: 'events' as const,
      name: 'Events',
      description: 'Import events from another system',
      icon: Calendar,
      fields: ['title', 'start_date', 'end_date', 'location', 'description'],
    },
  ]

  const handleComplete = (result: { success: number; errors: number }) => {
    console.log('Import complete:', result)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import Data</h1>
          <p className="text-gray-600 mt-1">Import data from CSV files or other systems</p>
        </div>
      </div>

      {!showImporter ? (
        <>
          {/* Import Type Selection */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {importTypes.map(type => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedType(type.id)
                  setShowImporter(true)
                }}
                className={`bg-white rounded-xl border p-6 text-left hover:border-blue-300 hover:shadow-md transition-all ${
                  selectedType === type.id ? 'border-blue-500 ring-2 ring-blue-100' : ''
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <type.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900">{type.name}</h3>
                </div>
                <p className="text-gray-500 text-sm mb-4">{type.description}</p>
                <div className="flex flex-wrap gap-2">
                  {type.fields.slice(0, 4).map(field => (
                    <span key={field} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {field}
                    </span>
                  ))}
                  {type.fields.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      +{type.fields.length - 4} more
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Sample Templates */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Download Sample Templates</h2>
            <p className="text-gray-500 text-sm mb-4">
              Use these templates to format your data before importing.
            </p>
            <div className="flex gap-4">
              {importTypes.map(type => (
                <button
                  key={type.id}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  {type.name} Template
                </button>
              ))}
            </div>
          </div>

          {/* Recent Imports */}
          <div className="mt-8 bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Imports</h2>
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>No recent imports</p>
            </div>
          </div>
        </>
      ) : (
        <div>
          <button
            onClick={() => setShowImporter(false)}
            className="mb-6 text-blue-600 hover:text-blue-800"
          >
            ← Back to Import Types
          </button>
          <SmartCSVImporter
            importType={selectedType!}
            organizationId="demo-org-id" // Replace with actual org ID
            onComplete={handleComplete}
          />
        </div>
      )}
    </div>
  )
}
