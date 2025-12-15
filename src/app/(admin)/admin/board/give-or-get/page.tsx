'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  DollarSign, Users, TrendingUp, Target, Plus, Edit2, 
  ChevronDown, CheckCircle, AlertTriangle, Clock, Loader2
} from 'lucide-react'

type BoardMember = {
  id: string
  board_member_id: string
  board_member_name: string
  board_member_email: string
  fiscal_year: number
  personal_giving_commitment_cents: number
  personal_giving_actual_cents: number
  solicited_giving_commitment_cents: number
  solicited_giving_actual_cents: number
  total_commitment_cents: number
  total_actual_cents: number
  completion_percent: number
  progress_status: string
  solicitation_count: number
  successful_solicitations: number
}

export default function BoardGiveOrGetPage() {
  const [members, setMembers] = useState<BoardMember[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [fiscalYear])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('board_fundraising_summary')
      .select('*')
      .eq('fiscal_year', fiscalYear)
      .order('completion_percent', { ascending: false })

    if (!error) {
      setMembers(data || [])
    }
    setLoading(false)
  }

  // Calculate totals
  const totals = members.reduce((acc, m) => ({
    commitment: acc.commitment + (m.total_commitment_cents || 0),
    actual: acc.actual + (m.total_actual_cents || 0),
    personal_commitment: acc.personal_commitment + (m.personal_giving_commitment_cents || 0),
    personal_actual: acc.personal_actual + (m.personal_giving_actual_cents || 0),
    solicited_commitment: acc.solicited_commitment + (m.solicited_giving_commitment_cents || 0),
    solicited_actual: acc.solicited_actual + (m.solicited_giving_actual_cents || 0),
  }), { commitment: 0, actual: 0, personal_commitment: 0, personal_actual: 0, solicited_commitment: 0, solicited_actual: 0 })

  const overallProgress = totals.commitment > 0 
    ? Math.round((totals.actual / totals.commitment) * 100) 
    : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'on_track': return <TrendingUp className="w-5 h-5 text-blue-600" />
      case 'behind': return <Clock className="w-5 h-5 text-yellow-600" />
      default: return <AlertTriangle className="w-5 h-5 text-red-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-800'
      case 'on_track': return 'bg-blue-100 text-blue-800'
      case 'behind': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-red-100 text-red-800'
    }
  }

  const formatCurrency = (cents: number) => {
    return '$' + (cents / 100).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Board Give or Get</h1>
          <p className="text-gray-600 mt-1">Track board member fundraising commitments and progress</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[2025, 2024, 2023].map(year => (
              <option key={year} value={year}>FY {year}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Commitment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commitment</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.commitment)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Raised</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.actual)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overall Progress</p>
              <p className="text-2xl font-bold text-gray-900">{overallProgress}%</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, overallProgress)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Board Members</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {members.filter(m => m.progress_status === 'complete').length} at 100%
          </p>
        </div>
      </div>

      {/* Personal vs Solicited Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-4">Personal Giving</h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-blue-900">{formatCurrency(totals.personal_actual)}</p>
              <p className="text-sm text-blue-700">of {formatCurrency(totals.personal_commitment)} goal</p>
            </div>
            <div className="text-4xl font-bold text-blue-400">
              {totals.personal_commitment > 0 
                ? Math.round((totals.personal_actual / totals.personal_commitment) * 100)
                : 0}%
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
          <h3 className="font-semibold text-purple-900 mb-4">Solicited Giving</h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-purple-900">{formatCurrency(totals.solicited_actual)}</p>
              <p className="text-sm text-purple-700">of {formatCurrency(totals.solicited_commitment)} goal</p>
            </div>
            <div className="text-4xl font-bold text-purple-400">
              {totals.solicited_commitment > 0 
                ? Math.round((totals.solicited_actual / totals.solicited_commitment) * 100)
                : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No fundraising commitments set for FY {fiscalYear}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Add First Commitment
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Board Member</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">Personal</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">Solicited</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">Total</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Progress</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{member.board_member_name}</p>
                      <p className="text-sm text-gray-500">{member.board_member_email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(member.personal_giving_actual_cents)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of {formatCurrency(member.personal_giving_commitment_cents)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(member.solicited_giving_actual_cents)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of {formatCurrency(member.solicited_giving_commitment_cents)}
                        {member.solicitation_count > 0 && (
                          <span className="ml-1">
                            ({member.successful_solicitations}/{member.solicitation_count})
                          </span>
                        )}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(member.total_actual_cents)}
                    </p>
                    <p className="text-sm text-gray-500">
                      of {formatCurrency(member.total_commitment_cents)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full max-w-[120px] mx-auto">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{member.completion_percent}%</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            member.completion_percent >= 100 ? 'bg-green-500' :
                            member.completion_percent >= 75 ? 'bg-blue-500' :
                            member.completion_percent >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, member.completion_percent)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.progress_status)}`}>
                      {getStatusIcon(member.progress_status)}
                      {member.progress_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedMember(member)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || selectedMember) && (
        <CommitmentModal
          member={selectedMember}
          fiscalYear={fiscalYear}
          onClose={() => {
            setShowAddModal(false)
            setSelectedMember(null)
          }}
          onSaved={() => {
            setShowAddModal(false)
            setSelectedMember(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function CommitmentModal({ 
  member, 
  fiscalYear,
  onClose, 
  onSaved 
}: { 
  member: BoardMember | null
  fiscalYear: number
  onClose: () => void
  onSaved: () => void 
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    board_member_id: member?.board_member_id || '',
    personal_commitment: member ? member.personal_giving_commitment_cents / 100 : 0,
    personal_actual: member ? member.personal_giving_actual_cents / 100 : 0,
    solicited_commitment: member ? member.solicited_giving_commitment_cents / 100 : 0,
    solicited_actual: member ? member.solicited_giving_actual_cents / 100 : 0,
  })
  const [boardMembers, setBoardMembers] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!member) {
      // Fetch available board members
      supabase
        .from('board_members')
        .select('id, profile:profiles(full_name, email)')
        .eq('is_active', true)
        .then(({ data }) => setBoardMembers(data || []))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const data = {
      board_member_id: form.board_member_id || member?.board_member_id,
      fiscal_year: fiscalYear,
      personal_giving_commitment_cents: Math.round(form.personal_commitment * 100),
      personal_giving_actual_cents: Math.round(form.personal_actual * 100),
      solicited_giving_commitment_cents: Math.round(form.solicited_commitment * 100),
      solicited_giving_actual_cents: Math.round(form.solicited_actual * 100),
    }

    if (member) {
      await supabase
        .from('board_fundraising_commitments')
        .update(data)
        .eq('id', member.id)
    } else {
      await supabase
        .from('board_fundraising_commitments')
        .insert(data)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {member ? `Update ${member.board_member_name}` : 'Add Commitment'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!member && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Board Member
              </label>
              <select
                value={form.board_member_id}
                onChange={e => setForm({ ...form, board_member_id: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Select board member...</option>
                {boardMembers.map((bm: any) => (
                  <option key={bm.id} value={bm.id}>
                    {bm.profile?.full_name || bm.profile?.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Giving Goal
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={form.personal_commitment}
                  onChange={e => setForm({ ...form, personal_commitment: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Giving Actual
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={form.personal_actual}
                  onChange={e => setForm({ ...form, personal_actual: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Solicited Giving Goal
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={form.solicited_commitment}
                  onChange={e => setForm({ ...form, solicited_commitment: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Solicited Giving Actual
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={form.solicited_actual}
                  onChange={e => setForm({ ...form, solicited_actual: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Commitment</span>
              <span className="font-medium">${(form.personal_commitment + form.solicited_commitment).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Total Actual</span>
              <span className="font-medium">${(form.personal_actual + form.solicited_actual).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t">
              <span className="text-gray-600">Progress</span>
              <span className="font-bold text-primary">
                {(form.personal_commitment + form.solicited_commitment) > 0
                  ? Math.round(((form.personal_actual + form.solicited_actual) / (form.personal_commitment + form.solicited_commitment)) * 100)
                  : 0}%
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
