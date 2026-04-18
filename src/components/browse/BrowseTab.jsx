import LibraryTab from '../library/LibraryTab.jsx'
import StatsTab from '../stats/StatsTab.jsx'
import ExploreTab from '../explore/ExploreTab.jsx'

export default function BrowseTab({
  albums,
  getAlbumStats,
  lastfmMap,
  lastfmLoaded,
  onThisDay,
  genresLoading,
  saveLater,
  removeLater,
  isSaved,
  activeSubTab,
  onSubTabChange,
  libraryFilter,
  onClearFilter,
  onBadgeClick,
  carouselSettings,
  onUpdateCarouselSettings,
  selectedPlaylists,
  playlistAlbums,
  playlistsLoading,
  playlists,
}) {
  switch (activeSubTab) {
    case 'library':
      return (
        <LibraryTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          genresLoading={genresLoading}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          libraryFilter={libraryFilter}
          onClearFilter={onClearFilter}
          onBadgeClick={onBadgeClick}
        />
      )
    case 'insights':
      return (
        <StatsTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          lastfmMap={lastfmMap}
          lastfmLoaded={lastfmLoaded}
          onThisDay={onThisDay}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          onBadgeClick={onBadgeClick}
          carouselSettings={carouselSettings}
          onUpdateCarouselSettings={onUpdateCarouselSettings}
        />
      )
    case 'explore':
    default:
      return (
        <ExploreTab
          albums={albums}
          getAlbumStats={getAlbumStats}
          selectedPlaylists={selectedPlaylists}
          playlistAlbums={playlistAlbums}
          playlists={playlists}
          saveLater={saveLater}
          removeLater={removeLater}
          isSaved={isSaved}
          onBadgeClick={onBadgeClick}
        />
      )
  }
}
