export default function Header({ onLogout }) {
  return (
    <header className="h-12 flex items-center justify-between px-4 bg-card border-b border-border-subtle flex-shrink-0">
      <span className="text-base font-medium text-ink tracking-tight">
        Album Discovery
      </span>
      {onLogout && (
        <button
          onClick={onLogout}
          className="text-xs text-ink-muted active:text-ink transition-colors"
        >
          Sign out
        </button>
      )}
    </header>
  )
}
