/**
 * @crumb
 * @id frontend-page-email
 * @area UI/Pages
 * @intent Email page placeholder — reserved route for future email inbox/composer integration
 * @responsibilities Render stub placeholder UI at /email route; no data, no logic
 * @contracts Email() → JSX; no Supabase queries; no auth dependency
 * @in none
 * @out Static placeholder heading; no interactive elements
 * @err none — page has no logic that can fail
 * @hazard This is a stub — any logic added here in future will have zero architectural context unless crumb is updated; high risk of inconsistent patterns
 * @hazard No auth guard at page level — relies entirely on ProtectedRoute in App.tsx; if route registration changes, page becomes publicly accessible
 * @shared-edges frontend/src/App.tsx→ROUTES to /email
 * @trail email#1 | User navigates to /email → stub renders → no further action possible
 * @prompt Implement email inbox view (sent emails, replies). Connect to activities table email type. Add compose button linking to ComposeEmailModal. Consider Gmail/Outlook thread grouping. VV design applied: void-950 page bg, vv-section-title "Outreach", font-display heading, dark:text-white/50 subtitle.
 */
export default function Email() {
  return (
    <div className="min-h-full bg-gray-50 dark:bg-void-950 p-6 space-y-6">
      <div>
        <p className="vv-section-title mb-1">Outreach</p>
        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
          Email
        </h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
          Send and track email outreach
        </p>
      </div>
    </div>
  )
}
