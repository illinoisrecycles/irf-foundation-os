import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  await supabase.auth.getUser()

  // Inject org context for API/admin/portal routes
  const pathname = request.nextUrl.pathname
  const shouldAttachOrg =
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/portal')

  if (shouldAttachOrg) {
    const activeOrgId = request.cookies.get('active_org_id')?.value
    if (activeOrgId) {
      const requestHeaders = new Headers(request.headers)
      if (!requestHeaders.get('x-org-id')) {
        requestHeaders.set('x-org-id', activeOrgId)
      }
      
      // Create response with modified headers
      const next = NextResponse.next({ request: { headers: requestHeaders } })
      
      // Copy cookies from session refresh
      for (const c of response.cookies.getAll()) {
        next.cookies.set(c)
      }
      
      return next
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
