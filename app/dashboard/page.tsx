import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const appId = user.app_metadata?.app_id as string | undefined

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">SalesPlanner</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Auth status</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">User ID</dt>
              <dd className="font-mono text-xs text-gray-600">{user.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">App ID</dt>
              <dd className={`font-mono text-xs ${appId ? 'text-green-600' : 'text-red-500'}`}>
                {appId ?? 'not stamped — check JWT hook + SALES_PLANNER_APP_ID'}
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-gray-400">
          Auth wired. Build the 5-screen planner next.
        </p>
      </div>
    </main>
  )
}
