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
