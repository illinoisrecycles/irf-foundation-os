import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use anon key for public widgets
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/widgets/[embedKey]
 * 
 * Returns embeddable HTML widget based on configuration.
 * Supports: impact_counter, donation_form, event_list, volunteer_signup
 */
export async function GET(
  req: Request,
  { params }: { params: { embedKey: string } }
) {
  const { embedKey } = params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'html' // html, json, js

  // Fetch widget configuration
  const { data: widget, error } = await supabase
    .from('embed_widgets')
    .select('*, organization:organizations(*)')
    .eq('embed_key', embedKey)
    .eq('is_active', true)
    .single()

  if (error || !widget) {
    return new NextResponse('Widget not found', { status: 404 })
  }

  // CORS check
  const origin = req.headers.get('origin') || ''
  if (widget.allowed_domains?.length > 0) {
    const allowed = widget.allowed_domains.some((domain: string) => 
      origin.includes(domain)
    )
    if (!allowed && origin) {
      return new NextResponse('Domain not allowed', { status: 403 })
    }
  }

  // Update view count
  await supabase
    .from('embed_widgets')
    .update({ 
      view_count: (widget.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString()
    })
    .eq('id', widget.id)

  // Fetch data based on widget type
  let content: string
  let data: any

  switch (widget.widget_type) {
    case 'impact_counter':
      data = await getImpactData(widget.organization.id, widget.config)
      content = generateImpactCounterHTML(data, widget)
      break

    case 'donation_thermometer':
      data = await getDonationProgress(widget.organization.id, widget.config)
      content = generateThermometerHTML(data, widget)
      break

    case 'event_list':
      data = await getUpcomingEvents(widget.organization.id, widget.config)
      content = generateEventListHTML(data, widget)
      break

    case 'volunteer_opportunities':
      data = await getVolunteerOpportunities(widget.organization.id, widget.config)
      content = generateVolunteerHTML(data, widget)
      break

    default:
      return new NextResponse('Unknown widget type', { status: 400 })
  }

  // Return based on format
  const headers: HeadersInit = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300', // 5 minute cache
  }

  if (format === 'json') {
    return NextResponse.json(data, { headers })
  }

  if (format === 'js') {
    const jsContent = `
(function() {
  var container = document.getElementById('foundationos-widget-${embedKey}') || document.currentScript.parentNode;
  container.innerHTML = ${JSON.stringify(content)};
})();
`
    return new NextResponse(jsContent, {
      headers: { ...headers, 'Content-Type': 'application/javascript' }
    })
  }

  // Default: HTML
  return new NextResponse(content, {
    headers: { ...headers, 'Content-Type': 'text/html' }
  })
}

/**
 * Data Fetchers
 */

async function getImpactData(orgId: string, config: any) {
  // Use RPC function for aggregated metrics
  const { data } = await supabase.rpc('get_public_impact_metrics', { p_org_id: orgId })
  
  return {
    people_served: data?.people_served || config.people_served || 0,
    volunteer_hours: data?.volunteer_hours || config.volunteer_hours || 0,
    events_held: data?.events_held || config.events_held || 0,
    custom_metric: config.custom_metric_value || 0,
    custom_metric_label: config.custom_metric_label || '',
    ...config.overrides,
  }
}

async function getDonationProgress(orgId: string, config: any) {
  const { data: donations } = await supabase
    .from('donations')
    .select('amount_cents')
    .eq('organization_id', orgId)
    .gte('created_at', config.start_date || new Date().getFullYear() + '-01-01')

  const raised = donations?.reduce((sum, d) => sum + (d.amount_cents || 0), 0) || 0
  const goal = config.goal_cents || 10000000 // $100k default

  return {
    raised: raised / 100,
    goal: goal / 100,
    percentage: Math.min(100, Math.round((raised / goal) * 100)),
    donor_count: donations?.length || 0,
    campaign_name: config.campaign_name || 'Annual Fund',
  }
}

async function getUpcomingEvents(orgId: string, config: any) {
  const { data } = await supabase
    .from('events')
    .select('id, title, date_start, location, is_virtual, price_cents')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .gte('date_start', new Date().toISOString())
    .order('date_start')
    .limit(config.limit || 5)

  return { events: data || [] }
}

async function getVolunteerOpportunities(orgId: string, config: any) {
  const { data } = await supabase
    .from('volunteer_opportunities')
    .select('id, title, date_start, location, required_volunteers, signed_up_count')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .gte('date_start', new Date().toISOString())
    .order('date_start')
    .limit(config.limit || 5)

  return { opportunities: data || [] }
}

/**
 * HTML Generators
 */

function generateImpactCounterHTML(data: any, widget: any) {
  const config = widget.config
  const org = widget.organization
  const primaryColor = org.primary_color || '#166534'
  const bgColor = config.background_color || '#f0fdf4'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: ${bgColor}; padding: 24px; border-radius: 16px; text-align: center;
            max-width: ${config.max_width || '400px'}; margin: 0 auto;">
  <h3 style="color: #374151; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">
    ${config.title || 'Our Impact'}
  </h3>
  
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
    ${data.people_served ? `
    <div style="background: white; padding: 16px; border-radius: 12px;">
      <p style="font-size: 36px; font-weight: bold; color: ${primaryColor}; margin: 0;">
        ${data.people_served.toLocaleString()}
      </p>
      <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">People Served</p>
    </div>
    ` : ''}
    
    ${data.volunteer_hours ? `
    <div style="background: white; padding: 16px; border-radius: 12px;">
      <p style="font-size: 36px; font-weight: bold; color: ${primaryColor}; margin: 0;">
        ${data.volunteer_hours.toLocaleString()}
      </p>
      <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">Volunteer Hours</p>
    </div>
    ` : ''}
    
    ${data.custom_metric ? `
    <div style="background: white; padding: 16px; border-radius: 12px; grid-column: span 2;">
      <p style="font-size: 48px; font-weight: bold; color: ${primaryColor}; margin: 0;">
        ${data.custom_metric.toLocaleString()}
      </p>
      <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px;">${data.custom_metric_label}</p>
    </div>
    ` : ''}
  </div>
  
  ${config.show_powered_by !== false ? `
  <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0 0;">
    Powered by <a href="https://foundationos.org" style="color: #9ca3af;">FoundationOS</a>
  </p>
  ` : ''}
</div>
`
}

function generateThermometerHTML(data: any, widget: any) {
  const primaryColor = widget.organization.primary_color || '#166534'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: white; padding: 24px; border-radius: 16px; border: 1px solid #e5e7eb;
            max-width: ${widget.config.max_width || '350px'}; margin: 0 auto;">
  <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">
    ${data.campaign_name}
  </h3>
  
  <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">
    ${data.donor_count} donors have contributed
  </p>
  
  <div style="position: relative; background: #e5e7eb; border-radius: 999px; height: 24px; overflow: hidden;">
    <div style="background: ${primaryColor}; height: 100%; width: ${data.percentage}%; 
                border-radius: 999px; transition: width 1s ease;"></div>
    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                 font-size: 12px; font-weight: 600; color: ${data.percentage > 50 ? 'white' : '#374151'};">
      ${data.percentage}%
    </span>
  </div>
  
  <div style="display: flex; justify-content: space-between; margin-top: 12px;">
    <span style="font-size: 24px; font-weight: bold; color: ${primaryColor};">
      $${data.raised.toLocaleString()}
    </span>
    <span style="font-size: 16px; color: #6b7280; align-self: flex-end;">
      of $${data.goal.toLocaleString()} goal
    </span>
  </div>
  
  <a href="${widget.config.donate_url || '#'}" 
     style="display: block; background: ${primaryColor}; color: white; text-align: center;
            padding: 14px; border-radius: 10px; margin-top: 20px; text-decoration: none;
            font-weight: 600; font-size: 16px;">
    Donate Now
  </a>
</div>
`
}

function generateEventListHTML(data: any, widget: any) {
  const events = data.events || []
  const primaryColor = widget.organization.primary_color || '#166534'

  if (events.length === 0) {
    return `<div style="text-align: center; padding: 20px; color: #6b7280;">No upcoming events</div>`
  }

  const eventItems = events.map((event: any) => `
    <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
      <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
        ${event.title}
      </h4>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
        📅 ${new Date(event.date_start).toLocaleDateString('en-US', { 
          weekday: 'short', month: 'short', day: 'numeric' 
        })}
        ${event.is_virtual ? ' • 🖥️ Virtual' : event.location ? ` • 📍 ${event.location}` : ''}
      </p>
      ${event.price_cents === 0 ? `<span style="font-size: 12px; color: ${primaryColor};">Free</span>` : ''}
    </div>
  `).join('')

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;
            max-width: ${widget.config.max_width || '400px'}; margin: 0 auto;">
  <div style="background: ${primaryColor}; color: white; padding: 16px;">
    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Upcoming Events</h3>
  </div>
  ${eventItems}
  <a href="${widget.config.events_url || '#'}" 
     style="display: block; text-align: center; padding: 14px; color: ${primaryColor};
            text-decoration: none; font-weight: 500;">
    View All Events →
  </a>
</div>
`
}

function generateVolunteerHTML(data: any, widget: any) {
  const opps = data.opportunities || []
  const primaryColor = widget.organization.primary_color || '#166534'

  if (opps.length === 0) {
    return `<div style="text-align: center; padding: 20px; color: #6b7280;">No current opportunities</div>`
  }

  const oppItems = opps.map((opp: any) => {
    const spotsLeft = (opp.required_volunteers || 0) - (opp.signed_up_count || 0)
    return `
    <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
      <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
        ${opp.title}
      </h4>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">
        📅 ${new Date(opp.date_start).toLocaleDateString()}
        ${opp.location ? ` • 📍 ${opp.location}` : ''}
      </p>
      ${spotsLeft > 0 ? `
        <span style="font-size: 12px; color: ${primaryColor};">${spotsLeft} spots left</span>
      ` : `
        <span style="font-size: 12px; color: #ef4444;">Full</span>
      `}
    </div>
  `
  }).join('')

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;
            max-width: ${widget.config.max_width || '400px'}; margin: 0 auto;">
  <div style="background: ${primaryColor}; color: white; padding: 16px;">
    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">🙋 Volunteer With Us</h3>
  </div>
  ${oppItems}
  <a href="${widget.config.volunteer_url || '#'}" 
     style="display: block; text-align: center; padding: 14px; color: ${primaryColor};
            text-decoration: none; font-weight: 500;">
    See All Opportunities →
  </a>
</div>
`
}
