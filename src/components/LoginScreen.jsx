import { login } from '../lib/auth.js'

export default function LoginScreen({ error }) {
  return (
    <div className="h-dvh bg-page flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-medium text-ink tracking-tight">Album Discovery</h1>
          <p className="text-sm text-ink-secondary mt-2">
            Your Spotify library, enriched with 8 years of listening history
          </p>
        </div>

        {/* Connect button */}
        <button
          onClick={login}
          className="w-full bg-ink text-white text-sm font-medium py-3 px-6 rounded-xl
                     active:scale-[0.97] transition-transform"
        >
          Connect with Spotify
        </button>

        {/* Error state */}
        {error && (
          <p className="text-xs text-center text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

      </div>
    </div>
  )
}
