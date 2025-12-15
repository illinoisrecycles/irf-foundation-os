'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Upload, FileSpreadsheet, Users, Calendar, DollarSign, 
  Loader2, CheckCircle, Sparkles, ArrowRight, Database
} from 'lucide-react'

const SOURCE_SYSTEMS = [
  { id: 'wild_apricot', name: 'Wild Apricot', logo: '🌿' },
  { id: 'memberclicks', name: 'MemberClicks', logo: '🔗' },
  { id: 'imis', name: 'iMIS', logo: '📊' },
  { id: 'fonteva', name: 'Fonteva', logo: '💼' },
  { id: 'neon', name: 'Neon CRM', logo: '💡' },
  { id: 'bloomerang', name: 'Bloomerang', logo: '🌸' },
  { id: 'csv', name: 'CSV/Excel', logo: '📄' },
  { id: 'other', name: 'Other', logo: '📦' },
]

export default function MigrationWizardPage() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceSystem, setSourceSystem] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile)
      setError('')
    }
  }, [])

  const isValidFile = (f: File) => {
    const validTypes = ['.csv', '.xlsx', '.xls', '.json']
    return validTypes.some(ext => f.name.toLowerCase().endsWith(ext))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile)
      setError('')
    } else {
      setError('Please select a CSV, Excel, or JSON file')
    }
  }

  const handleUpload = async () => {
    if (!file || !sourceSystem) return
    
    setUploading(true)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceSystem', sourceSystem)

      const res = await fetch('/api/migrate/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(30)

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const { sessionId } = await res.json()
      
      setAnalyzing(true)
      setProgress(50)

      // Poll for analysis completion
      let attempts = 0
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 2000))
        
        const statusRes = await fetch(`/api/migrate/status/${sessionId}`)
        const status = await statusRes.json()
        
        setProgress(50 + Math.min(40, attempts * 2))

        if (status.status === 'ready_to_import' || status.status === 'needs_review') {
          router.push(`/admin/migrate/${sessionId}/preview`)
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Analysis failed')
        }

        attempts++
      }

      throw new Error('Analysis timed out')

    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-12 px-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Powered by Multi-LLM AI Ensemble
        </div>
        <h1 className="text-5xl font-bold text-gray-900">AI Migration Wizard</h1>
        <p className="text-xl text-gray-600 mt-4 max-w-2xl mx-auto">
          Import your members, events, and donations in minutes—our AI handles 95% of the work automatically
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-green-700">95%</div>
          <p className="text-green-800 mt-1">Auto-Mapped Fields</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-blue-700">4</div>
          <p className="text-blue-800 mt-1">AI Models Working Together</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-purple-700">&lt;5 min</div>
          <p className="text-purple-800 mt-1">Average Migration Time</p>
        </div>
      </div>

      {/* Main Upload Area */}
      {!uploading && !analyzing ? (
        <div className="space-y-8">
          {/* Source System Selection */}
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Where is your data coming from?
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SOURCE_SYSTEMS.map(system => (
                <button
                  key={system.id}
                  onClick={() => setSourceSystem(system.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    sourceSystem === system.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-3xl">{system.logo}</span>
                  <p className="mt-2 font-medium text-gray-900">{system.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div
            className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              file ? 'border-green-300 bg-green-50' : 'border-gray-300'
            }`}
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
          >
            {file ? (
              <div>
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">File Ready</h3>
                <p className="text-gray-600">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Drop your export file here
                </h3>
                <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                  Supports CSV, Excel (.xlsx), and JSON exports from any membership management system
                </p>
                <label className="cursor-pointer inline-flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-lg font-medium">
                  <FileSpreadsheet className="w-6 h-6" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Start Button */}
          <div className="text-center">
            <button
              onClick={handleUpload}
              disabled={!file || !sourceSystem}
              className="inline-flex items-center gap-3 px-12 py-5 bg-primary text-white text-xl font-bold rounded-2xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Sparkles className="w-6 h-6" />
              Start AI Migration
              <ArrowRight className="w-6 h-6" />
            </button>
            <p className="text-gray-500 mt-4">
              Your data is processed securely and never shared
            </p>
          </div>
        </div>
      ) : (
        /* Processing State */
        <div className="bg-white rounded-2xl border p-12">
          <div className="text-center mb-8">
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {analyzing ? 'AI is Analyzing Your Data' : 'Uploading...'}
            </h2>
            <p className="text-gray-600">
              {analyzing 
                ? 'Four AI models are working together to map your fields' 
                : 'Preparing your file for analysis'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Processing Steps */}
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon: Upload, label: 'Upload', done: progress >= 30 },
              { icon: Database, label: 'Parse Schema', done: progress >= 50 },
              { icon: Sparkles, label: 'AI Mapping', done: progress >= 80 },
              { icon: CheckCircle, label: 'Ready', done: progress >= 100 },
            ].map((step, i) => (
              <div 
                key={i}
                className={`p-4 rounded-xl text-center ${
                  step.done ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <step.icon className={`w-8 h-8 mx-auto mb-2 ${
                  step.done ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`font-medium ${
                  step.done ? 'text-green-800' : 'text-gray-600'
                }`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <Users className="w-10 h-10 text-green-600 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Members & Contacts</h3>
          <p className="text-gray-600 text-sm">
            Names, emails, addresses, membership types, join dates, renewal status
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <DollarSign className="w-10 h-10 text-blue-600 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Donations & Payments</h3>
          <p className="text-gray-600 text-sm">
            Gift amounts, donors, campaigns, funds, recurring gifts, tributes
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <Calendar className="w-10 h-10 text-purple-600 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Events & Registrations</h3>
          <p className="text-gray-600 text-sm">
            Event details, attendees, ticket types, check-ins, revenue
          </p>
        </div>
      </div>
    </div>
  )
}
