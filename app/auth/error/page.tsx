export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const message = searchParams.error
    ? decodeURIComponent(searchParams.error)
    : 'An unexpected error occurred during sign-in.'

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-sm w-full text-center space-y-4 p-8">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-semibold text-gray-900">Sign-in error</h1>
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{message}</p>
        <a
          href="/auth/login"
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </main>
  )
}
