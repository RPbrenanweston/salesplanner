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
 * @prompt Implement email inbox view (sent emails, replies). Connect to activities table email type. Add compose button linking to ComposeEmailModal. Consider Gmail/Outlook thread grouping.
 */
export default function Email() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Email
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Send and track email outreach
      </p>
    </div>
  )
}
