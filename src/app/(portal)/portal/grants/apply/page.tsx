'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileText, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

// ============================================================================
// GRANT APPLICATION PORTAL
// Public-facing grant application form
// ============================================================================

type GrantProgram = {
  id: string
  name: string
  description: string
  deadline?: string
  max_amount_cents?: number
  form_fields: FormField[]
}

type FormField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'checkbox' | 'file' | 'date'
  required?: boolean
  options?: string[]
  placeholder?: string
  description?: string
}

export default function GrantApplyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('program')
  
  const [step, setStep] = React.useState<'form' | 'review' | 'submitting' | 'success' | 'error'>('form')
  const [program, setProgram] = React.useState<GrantProgram | null>(null)
  const [formData, setFormData] = React.useState<Record<string, any>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch program details
  React.useEffect(() => {
    if (!programId) {
      setError('No grant program specified')
      setLoading(false)
      return
    }

    fetch(`/api/grants/programs/${programId}`)
      .then(res => res.ok ? res.json() : Promise.reject('Program not found'))
      .then(data => {
        setProgram(data.program)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Failed to load program')
        setLoading(false)
      })
  }, [programId])

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    const missingRequired = program?.form_fields
      .filter(f => f.required && !formData[f.id])
      .map(f => f.label)

    if (missingRequired?.length) {
      setError(`Please fill in: ${missingRequired.join(', ')}`)
      return
    }

    setStep('submitting')
    setError(null)

    try {
      const res = await fetch('/api/grants/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: programId,
          form_data: formData,
          applicant_name: formData.applicant_name || formData.organization_name,
          applicant_email: formData.email,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }

      setStep('success')
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!program) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Program Not Found</h1>
          <p className="text-muted-foreground">{error || 'This grant program is not available.'}</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for applying to {program.name}. We'll review your application and get back to you soon.
          </p>
          <a 
            href="/portal"
            className="inline-flex px-6 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Return to Portal
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          <p className="text-muted-foreground mt-2">{program.description}</p>
          {program.deadline && (
            <p className="text-sm text-orange-600 mt-2">
              Deadline: {new Date(program.deadline).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {program.form_fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              {field.description && (
                <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : field.type === 'select' ? (
                <select
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select...</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData[field.id] || false}
                    onChange={(e) => handleChange(field.id, e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{field.placeholder}</span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              )}
            </div>
          ))}

          <div className="pt-4">
            <button
              type="submit"
              disabled={step === 'submitting'}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
