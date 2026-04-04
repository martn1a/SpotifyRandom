function fmtMetaDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default function Header({ onLogout, albumCount, lastfmMeta, onRefresh }) {
  const metaDate = fmtMetaDate(lastfmMeta?.generatedAt)

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-card border-b border-border-subtle flex-shrink-0">
      <div className="flex flex-col justify-center">
        <span className="text-base font-medium text-ink tracking-tight leading-tight">
          Album Discovery
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {albumCount > 0 && (
            <span className="text-[10px] text-ink-muted">{albumCount} albums</span>
          )}
          {metaDate && (
            <span className="text-[10px] text-ink-muted">· Last.fm: {metaDate}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-ink-muted text-base active:text-ink transition-colors"
            aria-label="Refresh library"
          >
            ↺
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="text-xs text-ink-muted active:text-ink transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
