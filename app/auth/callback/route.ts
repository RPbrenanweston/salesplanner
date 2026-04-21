import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?error=Missing+auth+code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error?.message ?? 'Session exchange failed')}`
    )
  }

  const appId = process.env.SALES_PLANNER_APP_ID
  if (!appId) {
    return NextResponse.redirect(`${origin}/auth/error?error=SALES_PLANNER_APP_ID+not+configured`)
  }

  const userId = data.session.user.id
  const admin = getSupabaseAdmin()

  // Stamp app_id into app_metadata (server-authoritative — users cannot spoof this)
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { app_id: appId },
  })

  if (updateError) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(updateError.message)}`
    )
  }

  // Ensure the user has an app_memberships row
  const { error: membershipError } = await admin
    .from('app_memberships')
    .upsert({ user_id: userId, app_id: appId }, { onConflict: 'user_id,app_id' })

  if (membershipError) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(membershipError.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
