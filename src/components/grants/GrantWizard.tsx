'use client'

import React, { useState } from 'react'
import { Check, Upload, FileText, ChevronRight, ChevronLeft, Save, AlertCircle } from 'lucide-react'

const steps = ['Eligibility', 'Project Details', 'Budget', 'Documents', 'Review']

type FormData = {
  organizationName: string
  ein: string
  contactName: string
  contactEmail: string
  projectTitle: string
  projectDescription: string
  requestedAmount: string
  totalBudget: string
  timeline: string
}

export function GrantWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    ein: '',
    contactName: '',
    contactEmail: '',
    projectTitle: '',
    projectDescription: '',
    requestedAmount: '',
    totalBudget: '',
    timeline: '',
  })

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFiles([...files, ...Array.from(e.dataTransfer.files)])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)])
    }
  }

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Eligibility
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-lg font-medium">Organization Information</h3>
              <p className="text-sm text-muted-foreground">Please provide your organization details to verify eligibility.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name *</label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => updateFormData('organizationName', e.target.value)}
                  placeholder="Illinois Recycling Foundation"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">EIN / Tax ID *</label>
                <input
                  type="text"
                  value={formData.ein}
                  onChange={(e) => updateFormData('ein', e.target.value)}
                  placeholder="XX-XXXXXXX"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Contact Name *</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => updateFormData('contactName', e.target.value)}
                  placeholder="John Smith"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Email *</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateFormData('contactEmail', e.target.value)}
                  placeholder="john@example.org"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Eligibility Requirements</p>
                <ul className="mt-1 list-disc list-inside text-blue-700">
                  <li>Must be a registered 501(c)(3) nonprofit organization</li>
                  <li>Must operate within the State of Illinois</li>
                  <li>Projects must focus on recycling, waste reduction, or circular economy</li>
                </ul>
              </div>
            </div>
          </div>
        )

      case 1: // Project Details
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-lg font-medium">Project Details</h3>
              <p className="text-sm text-muted-foreground">Tell us about your proposed project.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Title *</label>
                <input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => updateFormData('projectTitle', e.target.value)}
                  placeholder="Community Recycling Education Initiative"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Description *</label>
                <textarea
                  value={formData.projectDescription}
                  onChange={(e) => updateFormData('projectDescription', e.target.value)}
                  placeholder="Describe your project goals, target audience, and expected outcomes..."
                  rows={6}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-muted-foreground">Maximum 2,000 characters</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Timeline *</label>
                <input
                  type="text"
                  value={formData.timeline}
                  onChange={(e) => updateFormData('timeline', e.target.value)}
                  placeholder="e.g., January 2025 - December 2025 (12 months)"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )

      case 2: // Budget
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-lg font-medium">Budget Information</h3>
              <p className="text-sm text-muted-foreground">Provide your project budget details.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount Requested *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="text"
                    value={formData.requestedAmount}
                    onChange={(e) => updateFormData('requestedAmount', e.target.value)}
                    placeholder="10,000"
                    className="w-full h-10 rounded-lg border bg-background pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Maximum award: $25,000</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Project Budget *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="text"
                    value={formData.totalBudget}
                    onChange={(e) => updateFormData('totalBudget', e.target.value)}
                    placeholder="15,000"
                    className="w-full h-10 rounded-lg border bg-background pl-7 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Budget Categories</h4>
              <div className="space-y-3">
                {['Personnel', 'Equipment/Supplies', 'Marketing/Outreach', 'Administrative', 'Other'].map((category) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm">{category}</span>
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full h-8 rounded border bg-background pl-5 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 3: // Documents
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Upload Supporting Documents</h3>
              <p className="text-sm text-muted-foreground">Please provide your IRS 501(c)(3) letter and detailed budget spreadsheet.</p>
            </div>

            {/* Drag & Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium">Drag & drop files here, or click to select</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, DOC, XLS up to 50MB each</p>
            </div>

            {/* Required Documents Checklist */}
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Required Documents</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${files.some(f => f.name.toLowerCase().includes('501')) ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'}`}>
                    {files.some(f => f.name.toLowerCase().includes('501')) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm">IRS 501(c)(3) Determination Letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${files.some(f => f.name.toLowerCase().includes('budget')) ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'}`}>
                    {files.some(f => f.name.toLowerCase().includes('budget')) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm">Detailed Budget Spreadsheet</span>
                </div>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Uploaded Files</h4>
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded border">
                        <FileText className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setFiles(files.filter((_, index) => index !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 4: // Review
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-lg font-medium">Review Your Application</h3>
              <p className="text-sm text-muted-foreground">Please review all information before submitting.</p>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                  Organization
                </h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Name:</dt>
                  <dd className="font-medium">{formData.organizationName || '—'}</dd>
                  <dt className="text-muted-foreground">EIN:</dt>
                  <dd className="font-medium">{formData.ein || '—'}</dd>
                  <dt className="text-muted-foreground">Contact:</dt>
                  <dd className="font-medium">{formData.contactName || '—'}</dd>
                  <dt className="text-muted-foreground">Email:</dt>
                  <dd className="font-medium">{formData.contactEmail || '—'}</dd>
                </dl>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                  Project
                </h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Title:</dt>
                  <dd className="font-medium col-span-1">{formData.projectTitle || '—'}</dd>
                  <dt className="text-muted-foreground">Timeline:</dt>
                  <dd className="font-medium">{formData.timeline || '—'}</dd>
                </dl>
                {formData.projectDescription && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{formData.projectDescription}</p>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                  Budget
                </h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Amount Requested:</dt>
                  <dd className="font-medium text-lg">${formData.requestedAmount || '0'}</dd>
                  <dt className="text-muted-foreground">Total Budget:</dt>
                  <dd className="font-medium">${formData.totalBudget || '0'}</dd>
                </dl>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
                  Documents
                </h4>
                <p className="text-sm text-muted-foreground">{files.length} file(s) uploaded</p>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Before Submitting</p>
                <p className="text-yellow-700">By submitting this application, you certify that all information provided is accurate and complete. Applications cannot be edited after submission.</p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-card rounded-2xl shadow-sm border overflow-hidden">
      {/* Header & Progress */}
      <div className="bg-secondary/30 p-8 border-b">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">2025 Innovation Grant</h2>
            <p className="text-muted-foreground">Application ID: GR-2025-{Math.random().toString(36).substring(2, 6).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background px-3 py-1.5 rounded-full border">
            <Save className="h-4 w-4" />
            Auto-saved
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="absolute top-4 left-0 w-full h-1 bg-muted -z-10" />
          <div 
            className="absolute top-4 left-0 h-1 bg-primary -z-10 transition-all duration-500" 
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }} 
          />
          <div className="flex justify-between">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div 
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i < currentStep ? 'bg-primary text-primary-foreground' :
                    i === currentStep ? 'bg-primary text-primary-foreground scale-110 ring-4 ring-primary/20' : 
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 min-h-[450px]">
        {renderStepContent()}
      </div>

      {/* Footer Controls */}
      <div className="bg-secondary/30 p-6 border-t flex justify-between">
        <button 
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button 
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105"
        >
          {currentStep === steps.length - 1 ? 'Submit Application' : 'Continue'} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
