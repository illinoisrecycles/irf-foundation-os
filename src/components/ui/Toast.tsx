'use client'

import { create } from 'zustand'
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }))
    
    // Auto remove after duration
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      }, duration)
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  }
}))

export function useToast() {
  const { addToast } = useToastStore()
  
  return {
    success: (message: string, title?: string) => 
      addToast({ type: 'success', message, title }),
    error: (message: string, title?: string) => 
      addToast({ type: 'error', message, title, duration: 8000 }),
    info: (message: string, title?: string) => 
      addToast({ type: 'info', message, title }),
    warning: (message: string, title?: string) => 
      addToast({ type: 'warning', message, title }),
    custom: (toast: Omit<Toast, 'id'>) => addToast(toast)
  }
}

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
}

const styles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-200' },
  error: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-200' },
  info: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200' },
  warning: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-200' }
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-3 max-w-md">
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        const style = styles[toast.type]
        
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border rounded-xl shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right duration-300`}
            role="alert"
          >
            <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="font-semibold text-gray-900 text-sm">{toast.title}</p>
              )}
              <p className="text-gray-700 text-sm">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Convenience component to add to layout
export function Toaster() {
  return <ToastContainer />
}
