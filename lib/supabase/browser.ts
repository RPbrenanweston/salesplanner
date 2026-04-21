'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: true },
    )
  }
  return _client!
}

export type BrowserClient = ReturnType<typeof getSupabaseBrowser>
