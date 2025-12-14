'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, AlertTriangle, CheckCircle2 } from 'lucide-react'

// ============================================================================
// REVIEWER SCORING COMPONENT
// Rubric-based scoring for grant applications
// ============================================================================

type RubricCriterion = {
  id: string
  name: string
  description: string
  max_score: number
  weight: number
}

type ReviewerScoringProps = {
  applicationId: string
  assignmentId: string
  rubric: RubricCriterion[]
  existingScores?: Record<string, number>
  existingComments?: string
  onComplete?: () => void
}

export function ReviewerScoring({
  applicationId,
  assignmentId,
  rubric,
  existingScores = {},
  existingComments = '',
  onComplete,
}: ReviewerScoringProps) {
  const [scores, setScores] = React.useState<Record<string, number>>(existingScores)
  const [comments, setComments] = React.useState(existingComments)
  const [hasConflict, setHasConflict] = React.useState(false)
  const qc = useQueryClient()

  const totalPossible = rubric.reduce((sum, c) => sum + c.max_score * c.weight, 0)
  const totalScore = rubric.reduce((sum, c) => sum + (scores[c.id] || 0) * c.weight, 0)
  const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0

  const submitReview = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/grants/assignments/${assignmentId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          comments,
          total_score: totalScore,
          has_conflict: hasConflict,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit review')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grant-application', applicationId] })
      onComplete?.()
    },
  })

  const allScored = rubric.every(c => scores[c.id] !== undefined)

  return (
    <div className="space-y-6">
      {/* COI Declaration */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={hasConflict}
            onChange={(e) => setHasConflict(e.target.checked)}
            className="mt-1 rounded"
          />
          <div>
            <p className="font-medium text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Conflict of Interest
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Check this if you have a potential conflict of interest with this applicant.
              Your review will still be recorded but flagged for the committee.
            </p>
          </div>
        </label>
      </div>

      {/* Rubric Scoring */}
      <div className="space-y-4">
        <h3 className="font-semibold">Evaluation Criteria</h3>
        
        {rubric.map((criterion) => (
          <div key={criterion.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium">{criterion.name}</h4>
                <p className="text-sm text-muted-foreground">{criterion.description}</p>
              </div>
              <span className="text-sm text-muted-foreground">
                Weight: {criterion.weight}x
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground w-8">0</span>
              <input
                type="range"
                min="0"
                max={criterion.max_score}
                value={scores[criterion.id] || 0}
                onChange={(e) => setScores(prev => ({
                  ...prev,
                  [criterion.id]: parseInt(e.target.value),
                }))}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8">{criterion.max_score}</span>
              <div className="w-16 text-center">
                <span className="text-lg font-bold">{scores[criterion.id] || 0}</span>
                <span className="text-sm text-muted-foreground">/{criterion.max_score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total Score */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Weighted Total</p>
            <p className="text-2xl font-bold">{totalScore} / {totalPossible}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Percentage</p>
            <p className={`text-2xl font-bold ${
              percentage >= 70 ? 'text-green-600' :
              percentage >= 50 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {percentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Review Comments
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Provide detailed feedback on the application..."
          rows={4}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {allScored ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              All criteria scored
            </span>
          ) : (
            `${Object.keys(scores).length} of ${rubric.length} criteria scored`
          )}
        </p>
        <button
          onClick={() => submitReview.mutate()}
          disabled={!allScored || submitReview.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Submit Review
        </button>
      </div>
    </div>
  )
}
