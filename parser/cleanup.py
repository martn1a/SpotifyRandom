#!/usr/bin/env python3
"""
cleanup.py — Spotify Library Cleanup Script

Usage:
  python cleanup.py --export    # fetch Spotify library → merge with Last.fm → save cleanup_data.json
  python cleanup.py --dry-run   # instant analysis using cleanup_data.json, shows what would be removed
  python cleanup.py --run       # show summary → confirm → delete from Spotify
"""

import sys
import os
import re
import json
import time
from pathlib import Path
from datetime import datetime, timezone

# ─── TUNE THESE ──────────────────────────────────────────────────────
KEEP_ADDED_WITHIN_DAYS    = 365   # albums added < N days ago → always keep
KEEP_IF_LISTEN_COUNT_GTE  = 1     # albums with ≥ N full listens (parser sessions) → keep
KEEP_IF_SCROBBLE_COVERAGE = 0.30  # rawScrobbles / trackCount ≥ this → keep  (0.0 = disabled)
KEEP_IF_LAST_HEARD_DAYS   = 0     # last scrobble < N days ago → keep  (0 = disabled)
# ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
LASTFM_PATH  = SCRIPT_DIR.parent / 'public' / 'lastfm-data.json'
DATA_PATH    = SCRIPT_DIR / 'cleanup_data.json'
CLIENT_ID    = 'ed48e32b12fd4b01ad0dbdf383cb3ff6'
REDIRECT_URI = 'http://localhost:8888/callback'
SCOPES       = 'user-library-read user-library-modify'

CONFIG = {
    'keep_added_within_days':    KEEP_ADDED_WITHIN_DAYS,
    'keep_if_listen_count_gte':  KEEP_IF_LISTEN_COUNT_GTE,
    'keep_if_scrobble_coverage': KEEP_IF_SCROBBLE_COVERAGE,
    'keep_if_last_heard_days':   KEEP_IF_LAST_HEARD_DAYS,
}


# ─── Core: normalize ─────────────────────────────────────────────────

def normalize_key(artist: str, album: str) -> str:
    """Lowercase + strip bracket suffixes — matches the React app's normalizeAlbumKey()."""
    artist = artist.lower().strip()
    album  = album.lower().strip()
    while True:
        stripped = re.sub(r'\s*(\([^)]*\)|\[[^\]]*\])\s*$', '', album).strip()
        if stripped == album:
            break
        album = stripped
    return f'{artist}||{album}'


# ─── Core: keep logic ────────────────────────────────────────────────

def should_keep(album: dict, config: dict) -> tuple:
    """
    Returns (keep: bool, reasons: list[str]).
    An album is kept if it satisfies at least one criterion.
    """
    reasons = []
    now = time.time()

    # Criterion 1: recently added to Spotify library
    added_at = album.get('added_at')
    if added_at:
        added_ts = datetime.fromisoformat(added_at.replace('Z', '+00:00')).timestamp()
        if (now - added_ts) / 86400 <= config['keep_added_within_days']:
            reasons.append('recently_added')

    # Criterion 2: fully listened through N+ times (parser session algorithm)
    # threshold=0 disables this criterion (consistent with coverage/last_heard)
    listen_count = album.get('listenCount', 0) or 0
    if config['keep_if_listen_count_gte'] > 0 and listen_count >= config['keep_if_listen_count_gte']:
        reasons.append('listen_count')

    # Criterion 3: lifetime scrobble coverage (looser than session algorithm)
    coverage_threshold = config['keep_if_scrobble_coverage']
    if coverage_threshold > 0:
        track_count   = album.get('trackCount') or album.get('total_tracks') or 0
        raw_scrobbles = album.get('rawScrobbles', 0) or 0
        if track_count > 0 and raw_scrobbles / track_count >= coverage_threshold:
            reasons.append('scrobble_coverage')

    # Criterion 4: heard recently (even without full session)
    if config['keep_if_last_heard_days'] > 0:
        last_heard = album.get('lastHeard')
        if last_heard:
            if (now - last_heard / 1000) / 86400 <= config['keep_if_last_heard_days']:
                reasons.append('last_heard')

    return bool(reasons), reasons


# ─── Env / auth ──────────────────────────────────────────────────────

def load_env():
    env_path = SCRIPT_DIR / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"\'')


def get_spotipy():
    import spotipy
    from spotipy.oauth2 import SpotifyOAuth
    secret = os.getenv('SPOTIPY_CLIENT_SECRET')
    if not secret:
        print('ERROR: SPOTIPY_CLIENT_SECRET not set in parser/.env')
        sys.exit(1)
    return spotipy.Spotify(auth_manager=SpotifyOAuth(
        client_id=CLIENT_ID,
        client_secret=secret,
        redirect_uri=REDIRECT_URI,
        scope=SCOPES,
        cache_path=str(SCRIPT_DIR / '.spotipyoauthcache'),
    ))


# ─── Export ──────────────────────────────────────────────────────────

def fetch_spotify_library(sp) -> list:
    albums = []
    offset = 0
    while True:
        result = sp.current_user_saved_albums(limit=50, offset=offset)
        items  = result['items']
        if not items:
            break
        for item in items:
            a = item['album']
            albums.append({
                'spotify_id':   a['id'],
                'name':         a['name'],
                'artist':       a['artists'][0]['name'] if a['artists'] else '',
                'added_at':     item['added_at'],
                'total_tracks': a['total_tracks'],
            })
        offset += len(items)
        print(f'  Fetched {len(albums)} albums...', end='\r')
        if len(items) < 50:
            break
    print()
    return albums


def merge_with_lastfm(spotify_albums: list, lastfm_data: dict) -> tuple:
    lfm_albums = lastfm_data.get('albums', {})
    merged  = []
    matched = 0

    for sp in spotify_albums:
        key = normalize_key(sp['artist'], sp['name'])
        lfm = lfm_albums.get(key)
        rec = dict(sp)

        if lfm:
            rec.update({
                'lfm_matched':  True,
                'listenCount':  lfm.get('listenCount', 0),
                'rawScrobbles': lfm.get('rawScrobbles', 0),
                'trackCount':   lfm.get('trackCount') or sp['total_tracks'],
                'lastHeard':    lfm.get('lastHeard'),
                'firstHeard':   lfm.get('firstHeard'),
                'sessionCount': lfm.get('sessionCount', 0),
            })
            matched += 1
        else:
            rec.update({
                'lfm_matched':  False,
                'listenCount':  0,
                'rawScrobbles': 0,
                'trackCount':   sp['total_tracks'],
                'lastHeard':    None,
                'firstHeard':   None,
                'sessionCount': 0,
            })

        merged.append(rec)

    return merged, matched


def cmd_export():
    load_env()
    print('Authenticating with Spotify...')
    sp = get_spotipy()

    print('Fetching Spotify library...')
    spotify_albums = fetch_spotify_library(sp)
    print(f'  Total: {len(spotify_albums):,} albums')

    print('Loading Last.fm data...')
    lastfm_data = json.loads(LASTFM_PATH.read_text(encoding='utf-8'))

    print('Merging...')
    merged, matched = merge_with_lastfm(spotify_albums, lastfm_data)
    unmatched = len(merged) - matched

    DATA_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f'\nExport complete → {DATA_PATH.name}')
    print(f'  Matched with Last.fm: {matched:,} / {len(merged):,}  ({matched/len(merged)*100:.0f}%)')
    print(f'  No Last.fm data:      {unmatched:,}  (treated as 0 scrobbles)')


# ─── Entry point ─────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('--export', '--dry-run', '--run'):
        print(__doc__)
        sys.exit(1)
    mode = sys.argv[1]
    if mode == '--export':
        cmd_export()
    elif mode == '--dry-run':
        print('--dry-run not yet implemented')
    elif mode == '--run':
        print('--run not yet implemented')


if __name__ == '__main__':
    main()
