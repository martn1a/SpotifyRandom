export default function ExploreTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-6">
      <div className="w-20 h-20 bg-card-raised rounded-full flex items-center justify-center border border-border-subtle">
        <span className="text-3xl">🔭</span>
      </div>
      <div>
        <h2 className="font-black text-xl mb-2">Explore</h2>
        <p className="text-ink-secondary text-sm max-w-xs">
          Curated mood and genre playlists are coming soon.
        </p>
      </div>
      <div className="px-5 py-2.5 bg-accent/10 border border-accent/20 rounded-2xl">
        <span className="text-accent text-xs font-bold uppercase tracking-widest">Coming Soon</span>
      </div>
    </div>
  )
}
