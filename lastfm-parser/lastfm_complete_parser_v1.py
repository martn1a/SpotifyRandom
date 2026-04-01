#!/usr/bin/env python3
"""
=== Last.fm Complete Stats Parser v1 ===

Konvertiert alle 4 Last.fm Stats Exports zu strukturiertem JSON.

INPUT FILES:
  1. lastfmstats-fadgad.csv (FATGAT)
     Format: Artist;Album;AlbumId;Track;Date#fadgad
     Content: Vollständige Scrobble-History mit Unix Timestamps (ms)
  
  2. lastfmstats-albums-export.csv
     Format: Artist;Name;Scrobbles;Rank
     Content: Album Stats (Rank, Play Count)
  
  3. lastfmstats-artists-export.csv
     Format: Name;Tracks;Scrobbles;Rank
     Content: Artist Stats (Rank, Unique Tracks, Total Plays)
  
  4. lastfmstats-tracks-export.csv
     Format: Artist;Name;Scrobbles;Rank
     Content: Track Stats (Rank, Play Count)

OUTPUT:
  lastfm_complete_stats.json
  Struktur: { fatgad, albums, artists, tracks, metadata }
  
FUNKTIONALITÄT:
  - Alle 4 CSVs parsen (RAW Export, keine Berechnung)
  - 1:1 Mapping zu JSON
  - Validierung + Fehlerbehandlung
  - Statistik-Auswertung zur Kontrolle
  
KEINE AGGREGATION:
  - Parser bleibt schlank (nur Parsen)
  - Alle Carousels-Berechnungen in der App
  - RAW Daten für App-seitige Intelligenz
"""

import json
import csv
import sys
from pathlib import Path
from datetime import datetime

# ============================================================================
# CONFIG
# ============================================================================

INPUT_FILES = {
    "fatgad": "lastfmstats-fadgad.csv",
    "albums": "lastfmstats-albums-export.csv",
    "artists": "lastfmstats-artists-export.csv",
    "tracks": "lastfmstats-tracks-export.csv"
}

OUTPUT_FILE = "lastfm_complete_stats.json"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_fatgad(filepath):
    """Parse FATGAT (Full Artist Track Genre Album Timestamp)"""
    scrobbles = []
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            for row in reader:
                artist = row.get('Artist', '').strip()
                album = row.get('Album', '').strip()
                album_id = row.get('AlbumId', '').strip()
                track = row.get('Track', '').strip()
                date_str = row.get('Date#fadgad', '').strip()
                
                # Validierung
                if not artist or not track:
                    continue
                
                # Timestamp zu Integer
                try:
                    timestamp_ms = int(date_str)
                except ValueError:
                    continue
                
                scrobble = {
                    "artist": artist,
                    "album": album if album else None,
                    "albumId": album_id if album_id else None,
                    "track": track,
                    "timestamp": timestamp_ms
                }
                scrobbles.append(scrobble)
    
    except Exception as e:
        print(f"❌ Error parsing FATGAT: {e}")
        sys.exit(1)
    
    return scrobbles


def parse_albums(filepath):
    """Parse Album Stats Export"""
    albums = []
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            for row in reader:
                artist = row.get('Artist', '').strip()
                name = row.get('Name', '').strip()
                scrobbles_str = row.get('Scrobbles', '').strip()
                rank_str = row.get('Rank', '').strip()
                
                # Validierung
                if not artist or not name:
                    continue
                
                try:
                    plays = int(scrobbles_str)
                    my_rank = int(rank_str)
                except ValueError:
                    continue
                
                album = {
                    "artist": artist,
                    "album": name,
                    "plays": plays,
                    "myRank": my_rank
                }
                albums.append(album)
    
    except Exception as e:
        print(f"❌ Error parsing Albums: {e}")
        sys.exit(1)
    
    return albums


def parse_artists(filepath):
    """Parse Artist Stats Export"""
    artists = []
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            for row in reader:
                name = row.get('Name', '').strip()
                tracks_str = row.get('Tracks', '').strip()
                scrobbles_str = row.get('Scrobbles', '').strip()
                rank_str = row.get('Rank', '').strip()
                
                # Validierung
                if not name:
                    continue
                
                try:
                    tracks = int(tracks_str)
                    plays = int(scrobbles_str)
                    my_rank = int(rank_str)
                except ValueError:
                    continue
                
                # Berechnung (Parser-Ebene)
                plays_per_track = plays / tracks if tracks > 0 else 0
                
                # Kategorisierung
                if plays_per_track < 1.5:
                    discovery_type = "obsession"
                elif plays_per_track > 3:
                    discovery_type = "diverse"
                else:
                    discovery_type = "casual"
                
                artist = {
                    "artist": name,
                    "tracks": tracks,
                    "plays": plays,
                    "myRank": my_rank,
                    "playsPerTrack": round(plays_per_track, 2),
                    "discoveryType": discovery_type
                }
                artists.append(artist)
    
    except Exception as e:
        print(f"❌ Error parsing Artists: {e}")
        sys.exit(1)
    
    return artists


def parse_tracks(filepath):
    """Parse Track Stats Export"""
    tracks = []
    
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            for row in reader:
                artist = row.get('Artist', '').strip()
                name = row.get('Name', '').strip()
                scrobbles_str = row.get('Scrobbles', '').strip()
                rank_str = row.get('Rank', '').strip()
                
                # Validierung
                if not artist or not name:
                    continue
                
                try:
                    plays = int(scrobbles_str)
                    my_rank = int(rank_str)
                except ValueError:
                    continue
                
                track = {
                    "artist": artist,
                    "track": name,
                    "plays": plays,
                    "myRank": my_rank
                }
                tracks.append(track)
    
    except Exception as e:
        print(f"❌ Error parsing Tracks: {e}")
        sys.exit(1)
    
    return tracks

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*70)
    print("🎵 Last.fm Complete Stats Parser v1")
    print("="*70 + "\n")
    
    # --- INPUT VALIDIERUNG ---
    for source, filename in INPUT_FILES.items():
        input_path = Path(filename)
        if not input_path.exists():
            print(f"❌ Error: {filename} nicht gefunden")
            sys.exit(1)
    
    print("📂 Input Files:")
    for source, filename in INPUT_FILES.items():
        print(f"   {source:12} → {filename}")
    print(f"\n📂 Output: {OUTPUT_FILE}\n")
    
    # --- PARSING ---
    print("⏳ Parsing all files...\n")
    
    print("  [1/4] FATGAT (Scrobble History)...", end="", flush=True)
    fatgad = parse_fatgad(INPUT_FILES["fatgad"])
    print(f" ✅ {len(fatgad)} scrobbles")
    
    print("  [2/4] Albums...", end="", flush=True)
    albums = parse_albums(INPUT_FILES["albums"])
    print(f" ✅ {len(albums)} albums")
    
    print("  [3/4] Artists...", end="", flush=True)
    artists = parse_artists(INPUT_FILES["artists"])
    print(f" ✅ {len(artists)} artists")
    
    print("  [4/4] Tracks...", end="", flush=True)
    tracks = parse_tracks(INPUT_FILES["tracks"])
    print(f" ✅ {len(tracks)} tracks\n")
    
    # --- JSON EXPORT ---
    print("💾 Exporting JSON...\n")
    
    output_data = {
        "metadata": {
            "source": "Last.fm Stats Exports (4 files)",
            "parsedAt": datetime.now().isoformat(),
            "counts": {
                "scrobbles": len(fatgad),
                "albums": len(albums),
                "artists": len(artists),
                "tracks": len(tracks)
            }
        },
        "fatgad": fatgad,
        "albums": albums,
        "artists": artists,
        "tracks": tracks
    }
    
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"✅ JSON Export erfolgreich: {OUTPUT_FILE}\n")
    except Exception as e:
        print(f"❌ Error beim JSON-Export: {e}")
        sys.exit(1)
    
    # --- STATISTIK & KONTROLLE ---
    print("="*70)
    print("📊 STATISTIK & KONTROLLE")
    print("="*70 + "\n")
    
    # FATGAT Stats
    if fatgad:
        timestamps = [s['timestamp'] for s in fatgad]
        min_ts = min(timestamps)
        max_ts = max(timestamps)
        min_date = datetime.fromtimestamp(min_ts / 1000).strftime("%Y-%m-%d")
        max_date = datetime.fromtimestamp(max_ts / 1000).strftime("%Y-%m-%d")
        
        unique_albums = len(set(s['album'] for s in fatgad if s['album']))
        unique_artists = len(set(s['artist'] for s in fatgad))
        unique_tracks = len(set((s['artist'], s['track']) for s in fatgad))
        
        print(f"  🎧 FATGAD (Scrobble History):")
        print(f"     Total Scrobbles:     {len(fatgad):,}")
        print(f"     Date Range:          {min_date} → {max_date}")
        print(f"     Unique Albums:       {unique_albums:,}")
        print(f"     Unique Artists:      {unique_artists:,}")
        print(f"     Unique Tracks:       {unique_tracks:,}\n")
    
    # Albums Stats
    if albums:
        total_plays = sum(a['plays'] for a in albums)
        avg_plays = total_plays / len(albums)
        top_album = max(albums, key=lambda x: x['plays'])
        
        print(f"  💿 Albums:")
        print(f"     Total Albums:        {len(albums):,}")
        print(f"     Total Plays:         {total_plays:,}")
        print(f"     Ø Plays/Album:       {avg_plays:.1f}")
        print(f"     Top Album (Rank 1):  {top_album['album']} — {top_album['artist']}")
        print(f"     Plays Range:         {min(a['plays'] for a in albums)}–{max(a['plays'] for a in albums)}\n")
    
    # Artists Stats
    if artists:
        total_plays = sum(a['plays'] for a in artists)
        avg_tracks = sum(a['tracks'] for a in artists) / len(artists)
        top_artist = max(artists, key=lambda x: x['plays'])
        
        obsessions = len([a for a in artists if a['discoveryType'] == 'obsession'])
        diverse = len([a for a in artists if a['discoveryType'] == 'diverse'])
        casual = len([a for a in artists if a['discoveryType'] == 'casual'])
        
        print(f"  🎤 Artists:")
        print(f"     Total Artists:       {len(artists):,}")
        print(f"     Total Plays:         {total_plays:,}")
        print(f"     Ø Tracks/Artist:     {avg_tracks:.1f}")
        print(f"     Top Artist (Rank 1): {top_artist['artist']} ({top_artist['plays']} plays, {top_artist['tracks']} tracks)")
        print(f"     Discovery Types:")
        print(f"       - Obsession:       {obsessions} ({obsessions/len(artists)*100:.1f}%)")
        print(f"       - Diverse:         {diverse} ({diverse/len(artists)*100:.1f}%)")
        print(f"       - Casual:          {casual} ({casual/len(artists)*100:.1f}%)\n")
    
    # Tracks Stats
    if tracks:
        total_plays = sum(t['plays'] for t in tracks)
        avg_plays = total_plays / len(tracks)
        top_track = max(tracks, key=lambda x: x['plays'])
        
        print(f"  🎵 Tracks:")
        print(f"     Total Tracks:        {len(tracks):,}")
        print(f"     Total Plays:         {total_plays:,}")
        print(f"     Ø Plays/Track:       {avg_plays:.1f}")
        print(f"     Top Track (Rank 1):  {top_track['track']} — {top_track['artist']} ({top_track['plays']}×)")
        print(f"     Plays Range:         {min(t['plays'] for t in tracks)}–{max(t['plays'] for t in tracks)}\n")
    
    print("="*70)
    print("✅ Parser erfolgreich abgeschlossen")
    print("="*70 + "\n")
    print(f"📋 JSON ready für App-Import: {OUTPUT_FILE}\n")

if __name__ == "__main__":
    main()
