import OpenAI from 'openai'

// Lazy-load OpenAI to avoid build errors
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

// ============================================================================
// EMBEDDINGS
// ============================================================================
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getOpenAI()
  if (!openai) {
    console.log('[AI] OpenAI not configured, skipping embedding')
    return null
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit input size
    })
    return response.data[0].embedding
  } catch (err) {
    console.error('[AI] Embedding error:', err)
    return null
  }
}

// ============================================================================
// CHURN PREDICTION
// ============================================================================
export type ChurnPrediction = {
  riskScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
  recommendations: string[]
}

export async function predictChurnRisk(memberData: {
  memberName: string
  status: string
  joinedAt: string
  lastActivityDate: string | null
  engagementScore: number
  activitiesLast90Days: number
  eventsAttended: number
  totalDonations: number
  renewalHistory: { renewed: boolean; date: string }[]
}): Promise<ChurnPrediction> {
  const openai = getOpenAI()
  
  // Calculate basic risk factors first (works without AI)
  const factors: string[] = []
  let baseRiskScore = 0
  
  const daysSinceActivity = memberData.lastActivityDate 
    ? Math.floor((Date.now() - new Date(memberData.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
    : 365
  
  if (daysSinceActivity > 90) {
    factors.push(`No activity in ${daysSinceActivity} days`)
    baseRiskScore += 25
  }
  
  if (memberData.engagementScore < 30) {
    factors.push('Low engagement score')
    baseRiskScore += 20
  }
  
  if (memberData.activitiesLast90Days === 0) {
    factors.push('Zero activities in last 90 days')
    baseRiskScore += 15
  }
  
  if (memberData.eventsAttended === 0) {
    factors.push('Never attended an event')
    baseRiskScore += 10
  }
  
  // Check renewal history
  const failedRenewals = memberData.renewalHistory.filter(r => !r.renewed).length
  if (failedRenewals > 0) {
    factors.push(`${failedRenewals} past renewal failure(s)`)
    baseRiskScore += failedRenewals * 15
  }

  // If we have OpenAI, enhance with AI analysis
  if (openai) {
    try {
      const prompt = `Analyze this nonprofit member's churn risk:
Member: ${memberData.memberName}
Status: ${memberData.status}
Joined: ${memberData.joinedAt}
Engagement Score: ${memberData.engagementScore}/100
Activities Last 90 Days: ${memberData.activitiesLast90Days}
Events Attended: ${memberData.eventsAttended}
Total Donations: $${memberData.totalDonations}
Days Since Last Activity: ${daysSinceActivity}

Based on these factors, provide:
1. A churn risk score (0-100)
2. Top 3 risk factors
3. Top 3 personalized recommendations to retain this member

Respond in JSON format: { "score": number, "factors": string[], "recommendations": string[] }`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      })

      const aiResult = JSON.parse(response.choices[0].message.content || '{}')
      
      return {
        riskScore: Math.min(100, Math.max(0, aiResult.score || baseRiskScore)),
        riskLevel: getRiskLevel(aiResult.score || baseRiskScore),
        factors: aiResult.factors || factors,
        recommendations: aiResult.recommendations || getDefaultRecommendations(factors),
      }
    } catch (err) {
      console.error('[AI] Churn prediction error:', err)
    }
  }

  // Fallback without AI
  return {
    riskScore: Math.min(100, baseRiskScore),
    riskLevel: getRiskLevel(baseRiskScore),
    factors,
    recommendations: getDefaultRecommendations(factors),
  }
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 25) return 'low'
  if (score < 50) return 'medium'
  if (score < 75) return 'high'
  return 'critical'
}

function getDefaultRecommendations(factors: string[]): string[] {
  const recs: string[] = []
  if (factors.some(f => f.includes('activity'))) {
    recs.push('Send personalized re-engagement email')
  }
  if (factors.some(f => f.includes('event'))) {
    recs.push('Invite to upcoming events with personal outreach')
  }
  if (factors.some(f => f.includes('engagement'))) {
    recs.push('Assign staff member for personal check-in call')
  }
  if (recs.length === 0) {
    recs.push('Schedule membership satisfaction survey')
  }
  return recs
}

// ============================================================================
// CONTENT GENERATION
// ============================================================================
export async function generateBoardReportSummary(data: {
  period: string
  totalMembers: number
  newMembers: number
  churnedMembers: number
  retentionRate: number
  totalRevenue: number
  membershipRevenue: number
  eventRevenue: number
  donationRevenue: number
  expenses: number
  topEvents: { name: string; attendees: number }[]
  engagementHighlights: string[]
}): Promise<string> {
  const openai = getOpenAI()
  
  if (!openai) {
    // Generate basic summary without AI
    return `
**Executive Summary - ${data.period}**

Membership stands at ${data.totalMembers} members with ${data.newMembers} new joins and ${data.churnedMembers} departures, achieving a ${data.retentionRate}% retention rate.

Total revenue of $${(data.totalRevenue / 100).toLocaleString()} breaks down as:
- Membership dues: $${(data.membershipRevenue / 100).toLocaleString()}
- Event revenue: $${(data.eventRevenue / 100).toLocaleString()}  
- Donations: $${(data.donationRevenue / 100).toLocaleString()}

Net position: $${((data.totalRevenue - data.expenses) / 100).toLocaleString()}

${data.topEvents.length > 0 ? `Top event: ${data.topEvents[0].name} with ${data.topEvents[0].attendees} attendees.` : ''}
    `.trim()
  }

  try {
    const prompt = `Write a professional 2-3 paragraph executive summary for a nonprofit board report:

Period: ${data.period}
Members: ${data.totalMembers} total (${data.newMembers} new, ${data.churnedMembers} churned)
Retention Rate: ${data.retentionRate}%
Total Revenue: $${(data.totalRevenue / 100).toLocaleString()}
- Membership: $${(data.membershipRevenue / 100).toLocaleString()}
- Events: $${(data.eventRevenue / 100).toLocaleString()}
- Donations: $${(data.donationRevenue / 100).toLocaleString()}
Expenses: $${(data.expenses / 100).toLocaleString()}
Net: $${((data.totalRevenue - data.expenses) / 100).toLocaleString()}
Top Events: ${data.topEvents.map(e => `${e.name} (${e.attendees})`).join(', ')}

Write in a professional tone suitable for board members. Highlight achievements and areas needing attention.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    })

    return response.choices[0].message.content || ''
  } catch (err) {
    console.error('[AI] Board report generation error:', err)
    return `Executive summary generation failed. Please review the data manually.`
  }
}

// ============================================================================
// PERSONALIZED EMAIL DRAFTS
// ============================================================================
export async function generatePersonalizedEmail(params: {
  recipientName: string
  recipientType: 'member' | 'donor' | 'prospect'
  purpose: 'renewal' | 'thank_you' | 're_engagement' | 'event_invite'
  context: Record<string, any>
  tone?: 'formal' | 'friendly' | 'urgent'
}): Promise<{ subject: string; body: string }> {
  const openai = getOpenAI()
  
  const defaults: Record<string, { subject: string; body: string }> = {
    renewal: {
      subject: `Time to Renew Your Membership, ${params.recipientName}`,
      body: `Dear ${params.recipientName},\n\nYour membership is coming up for renewal. We value your continued support and hope you'll renew to maintain your member benefits.\n\nBest regards`,
    },
    thank_you: {
      subject: `Thank You, ${params.recipientName}!`,
      body: `Dear ${params.recipientName},\n\nThank you for your generous support. Your contribution makes a real difference in our mission.\n\nWith gratitude`,
    },
    re_engagement: {
      subject: `We Miss You, ${params.recipientName}!`,
      body: `Dear ${params.recipientName},\n\nWe noticed it's been a while since we've seen you. We'd love to reconnect and share what's new.\n\nWarmly`,
    },
    event_invite: {
      subject: `You're Invited: Special Event`,
      body: `Dear ${params.recipientName},\n\nWe'd like to personally invite you to our upcoming event. Based on your interests, we think you'd really enjoy it.\n\nHope to see you there`,
    },
  }

  if (!openai) {
    return defaults[params.purpose] || defaults.renewal
  }

  try {
    const prompt = `Generate a personalized email for a nonprofit:

Recipient: ${params.recipientName}
Type: ${params.recipientType}
Purpose: ${params.purpose}
Tone: ${params.tone || 'friendly'}
Context: ${JSON.stringify(params.context)}

Write a compelling subject line and email body (2-3 paragraphs). Be personal and specific to the context provided.

Respond in JSON: { "subject": "...", "body": "..." }`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    return JSON.parse(response.choices[0].message.content || '{}')
  } catch (err) {
    console.error('[AI] Email generation error:', err)
    return defaults[params.purpose] || defaults.renewal
  }
}

// ============================================================================
// SMART SEARCH / NATURAL LANGUAGE QUERY
// ============================================================================
export async function naturalLanguageToQuery(
  question: string,
  availableTables: string[]
): Promise<{ sql: string; explanation: string } | null> {
  const openai = getOpenAI()
  if (!openai) return null

  try {
    const prompt = `Convert this natural language question to a PostgreSQL query:

Question: "${question}"

Available tables: ${availableTables.join(', ')}

Important:
- Use only the tables listed
- Return safe SELECT queries only (no INSERT, UPDATE, DELETE)
- Include reasonable LIMIT clauses
- Use parameterized values where needed

Respond in JSON: { "sql": "...", "explanation": "..." }`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    // Security check - only allow SELECT
    if (!result.sql?.trim().toUpperCase().startsWith('SELECT')) {
      return null
    }

    return result
  } catch (err) {
    console.error('[AI] NL to query error:', err)
    return null
  }
}
