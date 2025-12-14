'use client'

import * as React from 'react'
import { FileText, Clock, CheckCircle, AlertCircle, ChevronRight, Star } from 'lucide-react'

type Assignment = {
  id: string
  application: {
    id: string
    project_title: string
    organization_name: string
    requested_amount: number
    submitted_at: string
  }
  status: 'pending' | 'in_progress' | 'completed'
  due_date: string
  has_conflict: boolean
}

export default function ReviewerDashboard() {
  const [assignments, setAssignments] = React.useState<Assignment[]>([
    {
      id: '1',
      application: {
        id: 'app1',
        project_title: 'Community Recycling Education Program',
        organization_name: 'Green Future Initiative',
        requested_amount: 25000,
        submitted_at: '2024-01-15',
      },
      status: 'pending',
      due_date: '2024-02-15',
      has_conflict: false,
    },
    {
      id: '2',
      application: {
        id: 'app2',
        project_title: 'Rural Composting Infrastructure',
        organization_name: 'Sustainable Agriculture Coalition',
        requested_amount: 50000,
        submitted_at: '2024-01-18',
      },
      status: 'in_progress',
      due_date: '2024-02-20',
      has_conflict: false,
    },
    {
      id: '3',
      application: {
        id: 'app3',
        project_title: 'Youth Environmental Leaders Program',
        organization_name: 'EcoGen Foundation',
        requested_amount: 15000,
        submitted_at: '2024-01-20',
      },
      status: 'completed',
      due_date: '2024-02-10',
      has_conflict: false,
    },
  ])

  const [selectedAssignment, setSelectedAssignment] = React.useState<Assignment | null>(null)
  const [scores, setScores] = React.useState<Record<string, number>>({})
  const [comments, setComments] = React.useState('')
  const [recommendation, setRecommendation] = React.useState<string>('')

  const criteria = [
    { id: 'innovation', label: 'Innovation & Creativity', description: 'How innovative is the proposed approach?' },
    { id: 'impact', label: 'Community Impact', description: 'What is the potential impact on the community?' },
    { id: 'feasibility', label: 'Feasibility', description: 'How realistic is the project plan and timeline?' },
    { id: 'budget', label: 'Budget Justification', description: 'Is the budget reasonable and well-justified?' },
    { id: 'sustainability', label: 'Sustainability', description: 'Will the project have lasting effects?' },
  ]

  const pendingCount = assignments.filter(a => a.status === 'pending').length
  const completedCount = assignments.filter(a => a.status === 'completed').length

  if (selectedAssignment) {
    return (
      <div>
        <button
          onClick={() => setSelectedAssignment(null)}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          ← Back to Assignments
        </button>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedAssignment.application.project_title}</h1>
              <p className="text-gray-600">{selectedAssignment.application.organization_name}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                ${selectedAssignment.application.requested_amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Requested Amount</div>
            </div>
          </div>

          {selectedAssignment.has_conflict && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Potential Conflict of Interest Detected</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Please review and confirm you have no conflict before proceeding.
              </p>
            </div>
          )}

          <div className="prose max-w-none">
            <h3>Project Summary</h3>
            <p>This application proposes a comprehensive community recycling education program 
               targeting schools and community centers across three counties. The program includes 
               curriculum development, teacher training, and hands-on workshops.</p>
            
            <h3>Goals & Objectives</h3>
            <ul>
              <li>Reach 5,000 students in Year 1</li>
              <li>Train 50 teachers as recycling ambassadors</li>
              <li>Establish 20 school recycling programs</li>
            </ul>
          </div>
        </div>

        {/* Scoring Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Score Application</h2>
          
          <div className="space-y-6">
            {criteria.map(criterion => (
              <div key={criterion.id}>
                <label className="block font-medium text-gray-900 mb-1">{criterion.label}</label>
                <p className="text-sm text-gray-500 mb-2">{criterion.description}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => setScores({ ...scores, [criterion.id]: score })}
                      className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center font-bold transition-colors ${
                        scores[criterion.id] === score
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label className="block font-medium text-gray-900 mb-2">Comments</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="Provide detailed feedback on this application..."
            />
          </div>

          <div className="mt-6">
            <label className="block font-medium text-gray-900 mb-2">Recommendation</label>
            <div className="flex gap-4">
              {['fund', 'fund_with_conditions', 'decline'].map(rec => (
                <button
                  key={rec}
                  onClick={() => setRecommendation(rec)}
                  className={`px-6 py-3 rounded-lg border-2 font-medium transition-colors ${
                    recommendation === rec
                      ? rec === 'fund' 
                        ? 'border-green-600 bg-green-600 text-white'
                        : rec === 'decline'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-yellow-600 bg-yellow-600 text-white'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {rec === 'fund' ? '✓ Fund' : rec === 'fund_with_conditions' ? '⚡ Fund with Conditions' : '✗ Decline'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button className="px-6 py-3 border rounded-lg text-gray-600 hover:bg-gray-50">
              Save Draft
            </button>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Submit Review
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Assignments</h1>
        <p className="text-gray-600 mt-1">Review and score grant applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-sm text-gray-500">Pending Review</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{assignments.length}</div>
              <div className="text-sm text-gray-500">Total Assigned</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment List */}
      <div className="bg-white rounded-xl border divide-y">
        {assignments.map(assignment => (
          <div
            key={assignment.id}
            onClick={() => setSelectedAssignment(assignment)}
            className="p-6 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                assignment.status === 'completed' ? 'bg-green-100' :
                assignment.status === 'in_progress' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {assignment.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <FileText className={`w-6 h-6 ${
                    assignment.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{assignment.application.project_title}</h3>
                <p className="text-sm text-gray-500">{assignment.application.organization_name}</p>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-green-600 font-medium">
                    ${assignment.application.requested_amount.toLocaleString()}
                  </span>
                  <span className="text-gray-400">Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {assignment.has_conflict && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  Conflict Check
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm ${
                assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {assignment.status === 'in_progress' ? 'In Progress' : 
                 assignment.status === 'completed' ? 'Completed' : 'Pending'}
              </span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
