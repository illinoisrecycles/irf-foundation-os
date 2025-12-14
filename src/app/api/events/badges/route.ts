import { NextResponse } from 'next/server'
import { generateEventBadges, generateBadgePDF, BadgeData } from '@/lib/events/badges'

// GET - Generate badges PDF for an event
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  try {
    const pdfBytes = await generateEventBadges(eventId)
    
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="badges-${eventId}.pdf"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - Generate custom badges
export async function POST(req: Request) {
  const { badges } = await req.json()

  if (!badges?.length) {
    return NextResponse.json({ error: 'badges array required' }, { status: 400 })
  }

  try {
    const pdfBytes = await generateBadgePDF(badges as BadgeData[])
    
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="badges.pdf"',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
