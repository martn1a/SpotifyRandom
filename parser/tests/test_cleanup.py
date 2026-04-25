import sys
import time
import pytest
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


import io
from unittest.mock import patch, MagicMock
import json
import tempfile

# reuse BASE_CONFIG from top of file (already defined)

def _make_albums(n_keep=2, n_remove=2):
    """2 keepable (recently_added) + n_remove old/unheard albums."""
    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    old_iso = '2015-01-01T00:00:00Z'
    albums = []
    for i in range(n_keep):
        albums.append(album(artist=f'Keep Artist {i}', name=f'Keep Album {i}',
                            added_at=now_iso, listenCount=0, rawScrobbles=0,
                            trackCount=10, total_tracks=10))
    for i in range(n_remove):
        albums.append(album(artist=f'Remove Artist {i}', name=f'Remove Album {i}',
                            added_at=old_iso, listenCount=0, rawScrobbles=0,
                            trackCount=10, total_tracks=10))
    return albums


def test_cmd_dry_run_missing_file(tmp_path, monkeypatch):
    """--dry-run exits with error when cleanup_data.json is absent."""
    import cleanup
    monkeypatch.setattr(cleanup, 'DATA_PATH', tmp_path / 'nonexistent.json')
    with pytest.raises(SystemExit):
        cleanup.cmd_dry_run()


def test_cmd_dry_run_writes_report(tmp_path, monkeypatch):
    """--dry-run writes a txt file and prints report."""
    import cleanup
    albums = _make_albums()
    data_file = tmp_path / 'cleanup_data.json'
    data_file.write_text(json.dumps(albums), encoding='utf-8')
    monkeypatch.setattr(cleanup, 'DATA_PATH', data_file)
    monkeypatch.setattr(cleanup, 'SCRIPT_DIR', tmp_path)

    with patch('builtins.print') as mock_print:
        cleanup.cmd_dry_run()

    txt_files = list(tmp_path.glob('cleanup_dry_run_*.txt'))
    assert len(txt_files) == 1
    content = txt_files[0].read_text(encoding='utf-8')
    assert 'SPOTIFY LIBRARY CLEANUP' in content


def test_cmd_run_missing_file(tmp_path, monkeypatch):
    """--run exits with error when cleanup_data.json is absent."""
    import cleanup
    monkeypatch.setattr(cleanup, 'DATA_PATH', tmp_path / 'nonexistent.json')
    with pytest.raises(SystemExit):
        cleanup.cmd_run()


def test_cmd_run_abort_on_wrong_answer(tmp_path, monkeypatch):
    """--run aborts without deleting when user does not type YES."""
    import cleanup
    albums = _make_albums()
    data_file = tmp_path / 'cleanup_data.json'
    data_file.write_text(json.dumps(albums), encoding='utf-8')
    monkeypatch.setattr(cleanup, 'DATA_PATH', data_file)

    with patch('builtins.input', return_value='no'), \
         patch('builtins.print') as mock_print:
        cleanup.cmd_run()

    printed = ' '.join(str(c) for c in mock_print.call_args_list)
    assert 'Aborted' in printed


def test_cmd_run_nothing_to_remove(tmp_path, monkeypatch):
    """--run prints 'Nothing to remove' when all albums are kept."""
    import cleanup
    albums = _make_albums(n_keep=3, n_remove=0)
    data_file = tmp_path / 'cleanup_data.json'
    data_file.write_text(json.dumps(albums), encoding='utf-8')
    monkeypatch.setattr(cleanup, 'DATA_PATH', data_file)

    with patch('builtins.print') as mock_print:
        cleanup.cmd_run()

    printed = ' '.join(str(c) for c in mock_print.call_args_list)
    assert 'Nothing to remove' in printed
