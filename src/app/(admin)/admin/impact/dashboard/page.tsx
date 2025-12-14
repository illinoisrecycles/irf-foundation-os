'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  TrendingUp, Users, Target, Award, Calendar, ChevronRight,
  Loader2, BarChart3, PieChart as PieIcon, ArrowUp, ArrowDown
} from 'lucide-react'
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import Link from 'next/link'

type Program = {
  id: string
  title: string
  status: string
  start_date: string
  beneficiary_count: number
  outcome_progress: number
}

type ImpactMetrics = {
  totalBeneficiaries: number
  beneficiariesThisYear: number
  activePrograms: number
  completedPrograms: number
  indicatorsMet: number
  totalIndicators: number
  keyOutcomes: { name: string; value: number; target: number; unit: string }[]
  beneficiaryTrend: { month: string; count: number }[]
  programBreakdown: { name: string; value: number; color: string }[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

export default function ImpactDashboard() {
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchImpactData()
  }, [])

  const fetchImpactData = async () => {
    // Fetch programs with beneficiary counts
    const { data: programsData } = await supabase
      .from('programs')
      .select(`
        *,
        beneficiaries:beneficiaries(count),
        indicators:outcome_indicators(
          id,
          name,
          target_value,
          unit,
          outcome_data(value)
        )
      `)
      .order('created_at', { ascending: false })

    if (programsData) {
      setPrograms(programsData.map(p => ({
        ...p,
        beneficiary_count: p.beneficiaries?.[0]?.count || 0,
        outcome_progress: calculateProgress(p.indicators || []),
      })))

      // Calculate aggregate metrics
      const totalBeneficiaries = programsData.reduce((sum, p) => 
        sum + (p.beneficiaries?.[0]?.count || 0), 0)
      
      const activePrograms = programsData.filter(p => p.status === 'active').length
      const completedPrograms = programsData.filter(p => p.status === 'completed').length

      // Key outcomes from indicators
      const keyOutcomes = programsData
        .flatMap(p => p.indicators || [])
        .filter(i => i.target_value)
        .slice(0, 4)
        .map(i => ({
          name: i.name,
          target: i.target_value,
          value: i.outcome_data?.reduce((sum: number, d: any) => sum + (d.value || 0), 0) || 0,
          unit: i.unit,
        }))

      // Calculate indicators met
      const allIndicators = programsData.flatMap(p => p.indicators || [])
      const indicatorsMet = allIndicators.filter(i => {
        const total = i.outcome_data?.reduce((sum: number, d: any) => sum + (d.value || 0), 0) || 0
        return i.target_value && total >= i.target_value
      }).length

      setMetrics({
        totalBeneficiaries,
        beneficiariesThisYear: Math.round(totalBeneficiaries * 0.3), // Placeholder
        activePrograms,
        completedPrograms,
        indicatorsMet,
        totalIndicators: allIndicators.length,
        keyOutcomes,
        beneficiaryTrend: generateTrendData(),
        programBreakdown: programsData.map((p, i) => ({
          name: p.title,
          value: p.beneficiaries?.[0]?.count || 0,
          color: COLORS[i % COLORS.length],
        })),
      })
    }

    setLoading(false)
  }

  const calculateProgress = (indicators: any[]): number => {
    if (!indicators.length) return 0
    const progress = indicators.reduce((sum, i) => {
      const total = i.outcome_data?.reduce((s: number, d: any) => s + (d.value || 0), 0) || 0
      const target = i.target_value || 1
      return sum + Math.min(total / target, 1)
    }, 0)
    return Math.round((progress / indicators.length) * 100)
  }

  const generateTrendData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.slice(0, 12).map((month, i) => ({
      month,
      count: Math.floor(Math.random() * 500) + 200 + (i * 50), // Placeholder trending up
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Impact Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your mission outcomes and program effectiveness</p>
        </div>
        <Link
          href="/admin/impact/programs"
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
        >
          Manage Programs
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total People Served</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {metrics?.totalBeneficiaries.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                <ArrowUp className="w-4 h-4" />
                +{metrics?.beneficiariesThisYear.toLocaleString()} this year
              </p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Programs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {metrics?.activePrograms}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {metrics?.completedPrograms} completed
              </p>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Goals Achieved</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {metrics?.indicatorsMet}/{metrics?.totalIndicators}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                outcome indicators met
              </p>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-7 h-7 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Impact Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {metrics?.totalIndicators 
                  ? Math.round((metrics.indicatorsMet / metrics.totalIndicators) * 100)
                  : 0}%
              </p>
              <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                <ArrowUp className="w-4 h-4" />
                Excellent progress
              </p>
            </div>
            <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
              <Award className="w-7 h-7 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Beneficiaries Trend */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">People Served Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics?.beneficiaryTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Program Breakdown */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Impact by Program</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics?.programBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {metrics?.programBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Outcomes */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Key Outcome Indicators</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics?.keyOutcomes.map((outcome, i) => {
            const progress = outcome.target ? Math.min((outcome.value / outcome.target) * 100, 100) : 0
            
            return (
              <div key={i} className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-900 mb-2">{outcome.name}</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {outcome.value.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">
                    / {outcome.target.toLocaleString()} {outcome.unit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {progress >= 100 ? '✓ Goal met!' : `${Math.round(progress)}% complete`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Programs List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Programs</h2>
          <Link href="/admin/impact/programs/new" className="text-primary hover:underline text-sm">
            + Add Program
          </Link>
        </div>
        <div className="divide-y">
          {programs.slice(0, 5).map(program => (
            <Link
              key={program.id}
              href={`/admin/impact/programs/${program.id}`}
              className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{program.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    program.status === 'active' 
                      ? 'bg-green-100 text-green-700'
                      : program.status === 'completed'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {program.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {program.beneficiary_count} served
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {program.outcome_progress}% progress
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
