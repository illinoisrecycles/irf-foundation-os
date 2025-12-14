// ============================================================================
// ZOOM INTEGRATION - Deep integration for virtual events
// ============================================================================

type ZoomTokens = {
  access_token: string
  refresh_token: string
  expires_at: Date
}

type ZoomMeeting = {
  id: number
  join_url: string
  password: string
  start_url: string
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================
export async function getZoomAccessToken(
  orgSettings: {
    zoom_client_id: string | null
    zoom_client_secret: string | null
    zoom_access_token: string | null
    zoom_refresh_token: string | null
    zoom_token_expires_at: string | null
  },
  supabase: any,
  orgId: string
): Promise<string | null> {
  if (!orgSettings.zoom_client_id || !orgSettings.zoom_client_secret) {
    console.log('[Zoom] Not configured for this organization')
    return null
  }

  // Check if token is still valid
  if (orgSettings.zoom_access_token && orgSettings.zoom_token_expires_at) {
    const expiresAt = new Date(orgSettings.zoom_token_expires_at)
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) { // 5 min buffer
      return orgSettings.zoom_access_token
    }
  }

  // Refresh the token
  if (!orgSettings.zoom_refresh_token) {
    console.error('[Zoom] No refresh token available')
    return null
  }

  try {
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${orgSettings.zoom_client_id}:${orgSettings.zoom_client_secret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: orgSettings.zoom_refresh_token,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Update tokens in database
    await supabase
      .from('organizations')
      .update({
        zoom_access_token: tokens.access_token,
        zoom_refresh_token: tokens.refresh_token,
        zoom_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', orgId)

    return tokens.access_token
  } catch (err) {
    console.error('[Zoom] Token refresh error:', err)
    return null
  }
}

// ============================================================================
// MEETING MANAGEMENT
// ============================================================================
export async function createZoomMeeting(
  accessToken: string,
  event: {
    title: string
    description?: string
    start_date: string
    end_date?: string
    timezone?: string
  }
): Promise<ZoomMeeting | null> {
  try {
    const startTime = new Date(event.start_date)
    const endTime = event.end_date ? new Date(event.end_date) : new Date(startTime.getTime() + 60 * 60 * 1000)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: event.title,
        type: 2, // Scheduled meeting
        start_time: startTime.toISOString(),
        duration,
        timezone: event.timezone || 'America/Chicago',
        agenda: event.description,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false,
          registrants_email_notification: false, // We handle this ourselves
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Zoom] Create meeting failed:', error)
      return null
    }

    const meeting = await response.json()
    return {
      id: meeting.id,
      join_url: meeting.join_url,
      password: meeting.password,
      start_url: meeting.start_url,
    }
  } catch (err) {
    console.error('[Zoom] Create meeting error:', err)
    return null
  }
}

export async function createZoomWebinar(
  accessToken: string,
  event: {
    title: string
    description?: string
    start_date: string
    end_date?: string
    timezone?: string
  }
): Promise<ZoomMeeting | null> {
  try {
    const startTime = new Date(event.start_date)
    const endTime = event.end_date ? new Date(event.end_date) : new Date(startTime.getTime() + 60 * 60 * 1000)
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    const response = await fetch('https://api.zoom.us/v2/users/me/webinars', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: event.title,
        type: 5, // Scheduled webinar
        start_time: startTime.toISOString(),
        duration,
        timezone: event.timezone || 'America/Chicago',
        agenda: event.description,
        settings: {
          host_video: true,
          panelists_video: true,
          practice_session: true,
          registrants_email_notification: false,
          approval_type: 0, // Automatic approval
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Zoom] Create webinar failed:', error)
      return null
    }

    const webinar = await response.json()
    return {
      id: webinar.id,
      join_url: webinar.join_url,
      password: webinar.password,
      start_url: webinar.start_url,
    }
  } catch (err) {
    console.error('[Zoom] Create webinar error:', err)
    return null
  }
}

export async function addZoomRegistrant(
  accessToken: string,
  meetingId: string,
  registrant: {
    email: string
    first_name: string
    last_name: string
  }
): Promise<{ join_url: string } | null> {
  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrant),
    })

    if (!response.ok) {
      console.error('[Zoom] Add registrant failed:', await response.text())
      return null
    }

    const result = await response.json()
    return { join_url: result.join_url }
  } catch (err) {
    console.error('[Zoom] Add registrant error:', err)
    return null
  }
}

export async function getZoomRecordings(
  accessToken: string,
  meetingId: string
): Promise<{ recording_files: { download_url: string; file_type: string }[] } | null> {
  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) return null
    return await response.json()
  } catch (err) {
    console.error('[Zoom] Get recordings error:', err)
    return null
  }
}

// ============================================================================
// WEBHOOK PAYLOAD TYPES
// ============================================================================
export type ZoomWebhookPayload = {
  event: string
  payload: {
    account_id: string
    object: {
      id: string | number
      uuid?: string
      host_id?: string
      topic?: string
      start_time?: string
      participant?: {
        id?: string
        user_id?: string
        user_name?: string
        email?: string
        join_time?: string
        leave_time?: string
      }
    }
  }
}

export function parseZoomWebhook(body: any): ZoomWebhookPayload {
  return body as ZoomWebhookPayload
}
