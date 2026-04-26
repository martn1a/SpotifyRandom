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
KEEP_IF_SCROBBLE_COVERAGE = 0.0  # rawScrobbles / trackCount ≥ this → keep  (0.0 = disabled)
KEEP_IF_LAST_HEARD_DAYS   = 365     # last scrobble < N days ago → keep  (0 = disabled)
# ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
LASTFM_PATH  = SCRIPT_DIR.parent / 'public' / 'lastfm-data.json'
DATA_PATH    = SCRIPT_DIR / 'cleanup_data.json'
CLIENT_ID    = 'ed48e32b12fd4b01ad0dbdf383cb3ff6'
REDIRECT_URI = 'http://127.0.0.1:8888/callback'
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

    for album in spotify_albums:
        key = normalize_key(album['artist'], album['name'])
        lfm = lfm_albums.get(key)
        rec = dict(album)

        if lfm:
            rec.update({
                'lfm_matched':  True,
                'listenCount':  lfm.get('listenCount', 0),
                'rawScrobbles': lfm.get('rawScrobbles', 0),
                'trackCount':   lfm.get('trackCount') or album['total_tracks'],
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
                'trackCount':   album['total_tracks'],
                'lastHeard':    None,
                'firstHeard':   None,
                'sessionCount': 0,
            })

        merged.append(rec)

    return merged, matched


# ─── Analysis ────────────────────────────────────────────────────────

def analyze(albums: list, config: dict) -> dict:
    to_keep   = []
    to_remove = []
    keep_reasons   = {'recently_added': 0, 'listen_count': 0, 'scrobble_coverage': 0, 'last_heard': 0}
    remove_reasons = {'never_scrobbled': 0, 'low_coverage': 0}

    for album in albums:
        keep, reasons = should_keep(album, config)
        if keep:
            for r in reasons:
                keep_reasons[r] += 1
            to_keep.append(album)
        else:
            if (album.get('rawScrobbles') or 0) == 0:
                remove_reasons['never_scrobbled'] += 1
            else:
                remove_reasons['low_coverage'] += 1
            to_remove.append(album)

    no_lfm = sum(1 for a in albums if not a.get('lfm_matched', False))

    return {
        'total':          len(albums),
        'to_keep':        to_keep,
        'to_remove':      to_remove,
        'keep_reasons':   keep_reasons,
        'remove_reasons': remove_reasons,
        'no_lfm_match':   no_lfm,
    }


def _fmt_coverage(album: dict) -> str:
    tc = album.get('trackCount') or album.get('total_tracks') or 0
    sc = album.get('rawScrobbles', 0) or 0
    if tc == 0:
        return '  n/a'
    return f'{sc / tc * 100:4.0f}%'


def _fmt_date_ms(ms) -> str:
    if not ms:
        return '         -'
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime('%Y-%m-%d')


def format_report(results: dict, config: dict) -> str:
    total    = results['total']
    n_remove = len(results['to_remove'])
    n_keep   = len(results['to_keep'])
    kr       = results['keep_reasons']
    rr       = results['remove_reasons']
    cov_pct  = int(config['keep_if_scrobble_coverage'] * 100)

    settings = (
        f"added<{config['keep_added_within_days']}d"
        f" | listens≥{config['keep_if_listen_count_gte']}"
        f" | coverage≥{cov_pct}%"
        + (f" | last_heard<{config['keep_if_last_heard_days']}d"
           if config['keep_if_last_heard_days'] > 0 else '')
    )

    pct_remove = n_remove / total * 100 if total else 0
    pct_keep   = n_keep   / total * 100 if total else 0

    lines = [
        '=' * 62,
        '  SPOTIFY LIBRARY CLEANUP — DRY RUN',
        f'  Settings: {settings}',
        '=' * 62,
        f'  Total albums in library:   {total:>6,}',
        f'  No Last.fm data:           {results["no_lfm_match"]:>6,}  (treated as 0 scrobbles)',
        '',
        f'  Would REMOVE:  {n_remove:>6,}  ({pct_remove:.1f}%)',
        f'  Would KEEP:    {n_keep:>6,}  ({pct_keep:.1f}%)',
        '',
        '  Kept because (an album can satisfy multiple):',
        f'    Added recently  (<{config["keep_added_within_days"]}d):   {kr.get("recently_added", 0):>5,}',
        f'    Listened through (≥{config["keep_if_listen_count_gte"]}×):     {kr.get("listen_count", 0):>5,}',
        f'    Scrobble coverage (≥{cov_pct}%):  {kr.get("scrobble_coverage", 0):>5,}',
    ]
    if config['keep_if_last_heard_days'] > 0:
        lines.append(f'    Last heard (<{config["keep_if_last_heard_days"]}d):           {kr.get("last_heard", 0):>5,}')

    lines += [
        '',
        '  Remove breakdown:',
        f'    Never scrobbled (0):       {rr["never_scrobbled"]:>5,}',
        f'    Low coverage (<{cov_pct}%):       {rr["low_coverage"]:>5,}',
        '=' * 62,
    ]

    if results['to_remove']:
        CA, CB = 22, 26
        header = (
            f'{"Artist":<{CA}} | {"Album":<{CB}} | {"Added":10} | '
            f'{"Scrobbles":>9} | {"Cover":>5} | {"Listens":>7}'
        )
        lines += ['', f'ALBUMS TO REMOVE ({n_remove:,}):', header, '-' * len(header)]

        for a in sorted(results['to_remove'],
                        key=lambda x: (x.get('artist', '').lower(), x.get('name', '').lower())):
            lines.append(
                f'{(a.get("artist") or "")[:CA]:<{CA}} | '
                f'{(a.get("name")   or "")[:CB]:<{CB}} | '
                f'{(a.get("added_at") or "")[:10]:10} | '
                f'{(a.get("rawScrobbles") or 0):>9,} | '
                f'{_fmt_coverage(a):>5} | '
                f'{(a.get("listenCount") or 0):>7}'
            )

    return '\n'.join(lines)


def cmd_export():
    load_env()
    print('Authenticating with Spotify...')
    sp = get_spotipy()

    print('Fetching Spotify library...')
    spotify_albums = fetch_spotify_library(sp)
    print(f'  Total: {len(spotify_albums):,} albums')

    print('Loading Last.fm data...')
    if not LASTFM_PATH.exists():
        print(f'ERROR: Last.fm data not found at {LASTFM_PATH}')
        sys.exit(1)
    lastfm_data = json.loads(LASTFM_PATH.read_text(encoding='utf-8'))

    print('Merging...')
    merged, matched = merge_with_lastfm(spotify_albums, lastfm_data)
    unmatched = len(merged) - matched

    DATA_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f'\nExport complete → {DATA_PATH.name}')
    if merged:
        pct = f'{matched / len(merged) * 100:.0f}%'
        print(f'  Matched with Last.fm: {matched:,} / {len(merged):,}  ({pct})')
        print(f'  No Last.fm data:      {unmatched:,}  (treated as 0 scrobbles)')
    else:
        print('  No albums found in Spotify library.')


# ─── Commands ────────────────────────────────────────────────────────

def cmd_dry_run():
    if not DATA_PATH.exists():
        print('ERROR: cleanup_data.json not found. Run --export first.')
        sys.exit(1)
    albums  = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    results = analyze(albums, CONFIG)
    report  = format_report(results, CONFIG)
    print(report)
    ts       = datetime.now().strftime('%Y-%m-%d_%H-%M')
    out_path = SCRIPT_DIR / f'cleanup_dry_run_{ts}.txt'
    out_path.write_text(report, encoding='utf-8')
    print(f'\n[saved to: {out_path.name}]')


def cmd_run():
    if not DATA_PATH.exists():
        print('ERROR: cleanup_data.json not found. Run --export first.')
        sys.exit(1)
    albums  = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    results = analyze(albums, CONFIG)
    report  = format_report(results, CONFIG)
    print(report)

    to_remove = results['to_remove']
    if not to_remove:
        print('Nothing to remove.')
        return

    answer = input(f'\nDelete {len(to_remove):,} albums from Spotify? Type YES to confirm: ')
    if answer.strip() != 'YES':
        print('Aborted.')
        return

    load_env()
    sp = get_spotipy()

    # Re-fetch live IDs as a safety check against stale data
    print('Re-fetching current Spotify library for fresh IDs...')
    live_albums  = fetch_spotify_library(sp)
    live_id_set  = {a['spotify_id'] for a in live_albums}
    stale_ids    = [a['spotify_id'] for a in to_remove if a['spotify_id'] not in live_id_set]
    ids_to_delete = [a['spotify_id'] for a in to_remove if a['spotify_id'] in live_id_set]

    if stale_ids:
        print(f'  {len(stale_ids):,} albums no longer in library (already removed) — skipping')

    if not ids_to_delete:
        print('Nothing left to delete after stale check.')
        return

    print(f'Deleting {len(ids_to_delete):,} albums...')
    deleted = 0
    for i in range(0, len(ids_to_delete), 50):
        batch = ids_to_delete[i:i + 50]
        sp.current_user_saved_albums_delete(batch)
        deleted += len(batch)
        print(f'  {deleted:,} / {len(ids_to_delete):,} deleted...', end='\r')
    print(f'\nDone. Removed {deleted:,} albums from Spotify library.')


# ─── Entry point ─────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('--export', '--dry-run', '--run'):
        print(__doc__)
        sys.exit(1)
    mode = sys.argv[1]
    if mode == '--export':
        cmd_export()
    elif mode == '--dry-run':
        cmd_dry_run()
    elif mode == '--run':
        cmd_run()


if __name__ == '__main__':
    main()
