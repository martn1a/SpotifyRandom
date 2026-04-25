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
