# Spotify Library Cleanup Script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable Python script that dry-runs and executes Spotify library cleanup based on tunable keep/remove criteria.

**Architecture:** Single file `parser/cleanup.py` with three CLI modes (`--export`, `--dry-run`, `--run`). Export fetches Spotify library via Spotipy and merges with local `public/lastfm-data.json`, saving to `parser/cleanup_data.json`. Dry-run reads that file locally (instant). Run mode re-fetches live IDs before deleting.

**Tech Stack:** Python 3, spotipy 2.x, python-dotenv (optional — we inline env loading to match existing parser pattern)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `parser/requirements.txt` | Create | Python dependencies |
| `parser/tests/test_cleanup.py` | Create | Tests for pure functions |
| `parser/cleanup.py` | Create | Main script (all logic) |
| `.gitignore` | Modify | Ignore generated files |

---

### Task 1: Setup

**Files:**
- Create: `parser/requirements.txt`
- Modify: `.gitignore`

- [ ] **Step 1: Create requirements.txt**

```
# parser/requirements.txt
spotipy>=2.23.0
```

- [ ] **Step 2: Add generated files to .gitignore**

Append to `.gitignore` (root):

```
# Cleanup script outputs
parser/cleanup_data.json
parser/cleanup_dry_run_*.txt
parser/.spotipyoauthcache
```

- [ ] **Step 3: Verify spotipy is installed**

```bash
cd parser && pip install -r requirements.txt
```

Expected: `Successfully installed spotipy-2.x.x` or `Requirement already satisfied`

- [ ] **Step 4: Commit**

```bash
git add parser/requirements.txt .gitignore
git commit -m "chore: add cleanup script setup (requirements, gitignore)"
```

---

### Task 2: Core pure functions + tests

**Files:**
- Create: `parser/tests/__init__.py`
- Create: `parser/tests/test_cleanup.py`
- Create: `parser/cleanup.py` (stubs + core functions only)

- [ ] **Step 1: Create parser/tests/__init__.py (empty)**

```python
```

- [ ] **Step 2: Write failing tests**

Create `parser/tests/test_cleanup.py`:

```python
import sys
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from cleanup import normalize_key, should_keep

NOW = time.time()
MS  = 1000

BASE_CONFIG = {
    'keep_added_within_days':    365,
    'keep_if_listen_count_gte':  1,
    'keep_if_scrobble_coverage': 0.30,
    'keep_if_last_heard_days':   0,
}

def album(**kwargs):
    base = {
        'added_at':     '2010-01-01T00:00:00Z',
        'listenCount':  0,
        'rawScrobbles': 0,
        'trackCount':   10,
        'total_tracks': 10,
        'lastHeard':    None,
    }
    base.update(kwargs)
    return base


# ── normalize_key ────────────────────────────────────────────────────

def test_normalize_basic():
    assert normalize_key('Quantic', 'Magnetica') == 'quantic||magnetica'

def test_normalize_strips_deluxe():
    assert normalize_key('Artist', 'Album (Deluxe Edition)') == 'artist||album'

def test_normalize_strips_remastered():
    assert normalize_key('Artist', 'Album [Remastered 2011]') == 'artist||album'

def test_normalize_strips_dj_mix():
    assert normalize_key('Artist', 'Album (DJ Mix)') == 'artist||album'

def test_normalize_strips_anniversary():
    assert normalize_key('Artist', 'Album (Anniversary Edition)') == 'artist||album'

def test_normalize_lowercases_and_trims():
    assert normalize_key('  ARTIST  ', '  ALBUM  ') == 'artist||album'


# ── should_keep ──────────────────────────────────────────────────────

def test_keep_recently_added():
    recent = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    a = album(added_at=recent)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is True
    assert 'recently_added' in reasons

def test_remove_old_never_heard():
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=0)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is False
    assert reasons == []

def test_keep_by_listen_count():
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=2, rawScrobbles=14)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is True
    assert 'listen_count' in reasons

def test_not_kept_at_zero_listens():
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=0)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert 'listen_count' not in reasons

def test_keep_by_scrobble_coverage_at_threshold():
    # exactly 30% = 3/10 → kept
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=3, trackCount=10)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is True
    assert 'scrobble_coverage' in reasons

def test_remove_below_coverage():
    # 2/10 = 20% < 30%
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=2, trackCount=10)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is False

def test_coverage_disabled_when_zero():
    config = {**BASE_CONFIG, 'keep_if_scrobble_coverage': 0.0}
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=9, trackCount=10)
    keep, reasons = should_keep(a, config)
    assert keep is False
    assert 'scrobble_coverage' not in reasons

def test_keep_by_last_heard():
    config = {**BASE_CONFIG, 'keep_if_last_heard_days': 180}
    recent_ms = int((NOW - 30 * 86400) * MS)   # 30 days ago in ms
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=0, lastHeard=recent_ms)
    keep, reasons = should_keep(a, config)
    assert keep is True
    assert 'last_heard' in reasons

def test_last_heard_disabled_by_default():
    recent_ms = int((NOW - 30 * 86400) * MS)
    a = album(added_at='2018-01-01T00:00:00Z', listenCount=0, rawScrobbles=0, lastHeard=recent_ms)
    keep, reasons = should_keep(a, BASE_CONFIG)   # keep_if_last_heard_days=0
    assert 'last_heard' not in reasons

def test_multiple_reasons_all_recorded():
    recent = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    a = album(added_at=recent, listenCount=3, rawScrobbles=5, trackCount=10)
    keep, reasons = should_keep(a, BASE_CONFIG)
    assert keep is True
    assert 'recently_added' in reasons
    assert 'listen_count'   in reasons
```

- [ ] **Step 3: Run tests — verify they FAIL**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: `ImportError: No module named 'cleanup'` or similar

- [ ] **Step 4: Create parser/cleanup.py with the two core functions**

```python
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
    album  = re.sub(r'\s*[\(\[][^\)\]]*[\)\]]', '', album).strip()
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
    listen_count = album.get('listenCount', 0) or 0
    if listen_count >= config['keep_if_listen_count_gte']:
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
```

- [ ] **Step 5: Run tests — verify they PASS**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: all 16 tests PASS

- [ ] **Step 6: Commit**

```bash
git add parser/cleanup.py parser/tests/__init__.py parser/tests/test_cleanup.py
git commit -m "feat: cleanup script core functions (normalize_key, should_keep) with tests"
```

---

### Task 3: --export mode

**Files:**
- Modify: `parser/cleanup.py` (add export functions after the core functions)

- [ ] **Step 1: Add load_env, get_spotipy, fetch_spotify_library, merge_with_lastfm, cmd_export to cleanup.py**

Add the following after the `should_keep` function (before the `if __name__` block — keep the file in one piece):

```python
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
```

- [ ] **Step 2: Add main entry point stub at bottom of file**

```python
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
```

- [ ] **Step 3: Add SPOTIPY_CLIENT_SECRET to parser/.env**

Open `parser/.env` and add:
```
SPOTIPY_CLIENT_SECRET=<your_secret_from_spotify_dashboard>
```

Also add `http://localhost:8888/callback` as a Redirect URI in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) app settings if not already present.

- [ ] **Step 4: Manual test — run export**

```bash
cd parser && python cleanup.py --export
```

Expected:
```
Authenticating with Spotify...
[browser opens for OAuth — log in once]
Fetching Spotify library...
  Fetched 2949 albums...
  Total: 2,949 albums
Loading Last.fm data...
Merging...

Export complete → cleanup_data.json
  Matched with Last.fm: 2,341 / 2,949  (79%)
  No Last.fm data:        608  (treated as 0 scrobbles)
```

Verify `parser/cleanup_data.json` exists and has entries with `spotify_id`, `added_at`, `lfm_matched`, `listenCount`.

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add parser/cleanup.py
git commit -m "feat: cleanup script --export mode (Spotipy fetch + Last.fm merge)"
```

---

### Task 4: Analysis + output formatting

**Files:**
- Modify: `parser/cleanup.py` (add analyze, format helpers, format_report)

- [ ] **Step 1: Add analyze and format functions to cleanup.py** (insert before the `cmd_export` block)

```python
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
                keep_reasons[r] = keep_reasons.get(r, 0) + 1
            to_keep.append(album)
        else:
            if (album.get('rawScrobbles') or 0) == 0:
                remove_reasons['never_scrobbled'] += 1
            else:
                remove_reasons['low_coverage'] += 1
            to_remove.append(album)

    no_lfm = sum(1 for a in albums if not a.get('lfm_matched', True))

    return {
        'total':         len(albums),
        'to_keep':       to_keep,
        'to_remove':     to_remove,
        'keep_reasons':  keep_reasons,
        'remove_reasons': remove_reasons,
        'no_lfm_match':  no_lfm,
    }


def _fmt_coverage(album: dict) -> str:
    tc  = album.get('trackCount') or album.get('total_tracks') or 0
    sc  = album.get('rawScrobbles', 0) or 0
    if tc == 0:
        return '  n/a'
    return f'{sc / tc * 100:4.0f}%'


def _fmt_date_ms(ms) -> str:
    if not ms:
        return '          -'
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
```

- [ ] **Step 2: Verify tests still pass**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add parser/cleanup.py
git commit -m "feat: cleanup script analysis engine and report formatter"
```

---

### Task 5: --dry-run mode, --run mode, wire entry point

**Files:**
- Modify: `parser/cleanup.py` (add cmd_dry_run, cmd_run, update main)

- [ ] **Step 1: Add cmd_dry_run and cmd_run to cleanup.py** (replace the stubs in main with real implementations)

Add `cmd_dry_run` and `cmd_run` before the `main` function:

```python
# ─── Dry-run mode ────────────────────────────────────────────────────

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


# ─── Run mode ────────────────────────────────────────────────────────

def cmd_run():
    if not DATA_PATH.exists():
        print('ERROR: cleanup_data.json not found. Run --export first.')
        sys.exit(1)

    albums  = json.loads(DATA_PATH.read_text(encoding='utf-8'))
    results = analyze(albums, CONFIG)

    # Print summary only (not the full album list)
    summary = format_report(results, CONFIG)
    print(summary.split('ALBUMS TO REMOVE')[0])

    n = len(results['to_remove'])
    if n == 0:
        print('Nothing to remove with current settings.')
        return

    confirm = input(f'\nDelete {n:,} albums from Spotify? Type YES to confirm: ')
    if confirm.strip() != 'YES':
        print('Aborted.')
        return

    load_env()
    sp = get_spotipy()

    # Re-fetch live library so we have current IDs (safety against stale data)
    print('Re-fetching current Spotify library...')
    current        = fetch_spotify_library(sp)
    current_id_map = {normalize_key(a['artist'], a['name']): a['spotify_id'] for a in current}

    ids_to_delete = []
    for a in results['to_remove']:
        key = normalize_key(a.get('artist', ''), a.get('name', ''))
        sid = current_id_map.get(key) or a.get('spotify_id')
        if sid:
            ids_to_delete.append(sid)

    deleted = 0
    for i in range(0, len(ids_to_delete), 50):
        batch = ids_to_delete[i:i + 50]
        sp.current_user_saved_albums_delete(batch)
        deleted += len(batch)
        print(f'  Deleted {deleted} / {len(ids_to_delete)}...', end='\r')
        time.sleep(0.1)

    print(f'\nDone. Removed {deleted:,} albums from your Spotify library.')
```

- [ ] **Step 2: Update main() to call the real functions**

Replace the existing `main()`:

```python
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
```

- [ ] **Step 3: Run tests — confirm still passing**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: all PASS

- [ ] **Step 4: Manual test — dry-run**

```bash
cd parser && python cleanup.py --dry-run
```

Expected: full report printed to stdout + `cleanup_dry_run_YYYY-MM-DD_HH-MM.txt` saved.  
Verify the numbers look plausible (not 0, not 100%).

- [ ] **Step 5: Try different variable combinations**

In `cleanup.py`, change settings at the top and re-run `--dry-run` each time:

```python
# Test A — aggressive: only keep recently added + fully heard
KEEP_ADDED_WITHIN_DAYS    = 365
KEEP_IF_LISTEN_COUNT_GTE  = 1
KEEP_IF_SCROBBLE_COVERAGE = 0.0   # disabled

# Test B — loose: also save anything with ≥ 1 scrobble ever
KEEP_IF_SCROBBLE_COVERAGE = 0.10

# Test C — very loose: save anything with ≥ 20% coverage
KEEP_IF_SCROBBLE_COVERAGE = 0.20
```

Compare the `.txt` output files. Tune until the removal count feels right before doing a real run.

- [ ] **Step 6: Commit**

```bash
git add parser/cleanup.py
git commit -m "feat: cleanup script --dry-run and --run modes complete"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full test suite passes**

```bash
cd parser && python -m pytest tests/test_cleanup.py -v
```

Expected: 16/16 PASS

- [ ] **Step 2: Confirm --export → --dry-run pipeline works end-to-end**

```bash
cd parser
python cleanup.py --export   # re-run to get fresh data
python cleanup.py --dry-run  # verify report looks correct
```

Check in the output:
- Total album count matches your Spotify library size (~2,949)
- "Would REMOVE" is non-zero and non-100%
- At least one album appears in the remove list with plausible numbers

- [ ] **Step 3: Commit any final tweaks**

```bash
git add parser/cleanup.py
git commit -m "chore: cleanup script final polish"
```
