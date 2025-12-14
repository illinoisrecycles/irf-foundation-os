'use client'

import * as React from 'react'
import { Brain, TrendingDown, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, Loader2 } from 'lucide-react'

type ChurnPrediction = {
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
  recommendations: string[]
}

type Props = {
  memberId: string
  memberName: string
}

export default function MemberAIInsights({ memberId, memberName }: Props) {
  const [prediction, setPrediction] = React.useState<ChurnPrediction | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchPrediction = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ai/churn-prediction?member_id=${memberId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)
      setPrediction(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch prediction')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchPrediction()
  }, [memberId])

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <TrendingUp className="w-5 h-5" />
      case 'medium': return <TrendingDown className="w-5 h-5" />
      case 'high':
      case 'critical': return <AlertTriangle className="w-5 h-5" />
      default: return <Brain className="w-5 h-5" />
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">AI Insights</h3>
          </div>
          <button onClick={fetchPrediction} className="text-purple-600 hover:text-purple-800">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!prediction) return null

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
        </div>
        <button onClick={fetchPrediction} className="text-purple-600 hover:text-purple-800">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Risk Score */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="text-sm text-gray-500 mb-1">Churn Risk Score</div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-gray-900">{prediction.riskScore}</div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getRiskColor(prediction.riskLevel)}`}>
              {getRiskIcon(prediction.riskLevel)}
              {prediction.riskLevel.charAt(0).toUpperCase() + prediction.riskLevel.slice(1)} Risk
            </span>
          </div>
        </div>
        <div className="w-24 h-24 relative">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="40" fill="none"
              stroke={prediction.riskLevel === 'low' ? '#22c55e' : prediction.riskLevel === 'medium' ? '#eab308' : prediction.riskLevel === 'high' ? '#f97316' : '#ef4444'}
              strokeWidth="8"
              strokeDasharray={`${prediction.riskScore * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{prediction.riskScore}%</span>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {prediction.factors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Risk Factors
          </h4>
          <ul className="space-y-1">
            {prediction.factors.map((factor, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-orange-500 mt-1">•</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            AI Recommendations
          </h4>
          <ul className="space-y-2">
            {prediction.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm bg-white rounded-lg p-3 border border-purple-100 flex items-start gap-2">
                <span className="text-purple-500 font-bold">{idx + 1}.</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
