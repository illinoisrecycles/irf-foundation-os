import { NextResponse } from 'next/server'
import { generateMemberCard, verifyMemberCard } from '@/lib/membership/cards'

// GET - Generate member card
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')

  if (!memberId) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }

  const card = await generateMemberCard(memberId)

  if (!card) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  return NextResponse.json(card)
}

// POST - Verify member card (from QR scan)
export async function POST(req: Request) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const result = await verifyMemberCard(token)
  return NextResponse.json(result)
}
