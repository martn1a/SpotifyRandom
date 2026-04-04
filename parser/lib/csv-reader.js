/**
 * lib/csv-reader.js
 * Reads and parses all 4 Last.fm CSV export files.
 * All files are semicolon-separated, UTF-8 with BOM, quoted strings.
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Parse a single CSV file into an array of row objects.
 * Handles the UTF-8 BOM, semicolon delimiter, and quoted fields.
 */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath, { encoding: 'utf8' })
      .pipe(parse({
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        bom: true,           // strips the UTF-8 BOM automatically
        relax_quotes: true,
        trim: true,
      }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Load and validate the fadgad file (full scrobble log).
 * Returns array of: { artist, album, albumId, track, timestamp }
 */
export async function loadFadgad() {
  const filePath = path.join(DATA_DIR, 'lastfmstats-fadgad.csv');
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}\nPlace your Last.fm export files in the /data directory.`);
  }

  const raw = await parseCSV(filePath);
  const rows = [];

  for (const row of raw) {
    const ts = parseInt(row['Date#fadgad'], 10);
    if (!row['Artist'] || !row['Album'] || isNaN(ts)) continue;

    rows.push({
      artist: row['Artist'].trim(),
      album:  row['Album'].trim(),
      albumId: row['AlbumId']?.trim() || null,   // MusicBrainz ID, may be empty
      track:  row['Track']?.trim() || '',
      timestamp: ts,
    });
  }

  // Sort chronologically — exports are usually already sorted but guarantee it
  rows.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`  ✓ fadgad: ${rows.length.toLocaleString()} scrobbles loaded`);
  return rows;
}

/**
 * Load the albums summary file.
 * Returns array of: { artist, name, scrobbles, rank }
 */
export async function loadAlbums() {
  const filePath = path.join(DATA_DIR, 'lastfmstats-albums-export.csv');
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const raw = await parseCSV(filePath);
  const rows = raw
    .filter(r => r['Artist'] && r['Name'])
    .map(r => ({
      artist:    r['Artist'].trim(),
      name:      r['Name'].trim(),
      scrobbles: parseInt(r['Scrobbles'], 10) || 0,
      rank:      parseInt(r['Rank'], 10) || 9999,
    }));

  console.log(`  ✓ albums: ${rows.length.toLocaleString()} albums loaded`);
  return rows;
}

/**
 * Load the artists summary file.
 * Returns array of: { name, tracks, scrobbles, rank }
 */
export async function loadArtists() {
  const filePath = path.join(DATA_DIR, 'lastfmstats-artists-export.csv');
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const raw = await parseCSV(filePath);
  const rows = raw
    .filter(r => r['Name'])
    .map(r => ({
      name:      r['Name'].trim(),
      tracks:    parseInt(r['Tracks'], 10) || 0,
      scrobbles: parseInt(r['Scrobbles'], 10) || 0,
      rank:      parseInt(r['Rank'], 10) || 9999,
    }));

  console.log(`  ✓ artists: ${rows.length.toLocaleString()} artists loaded`);
  return rows;
}

/**
 * Load the tracks summary file.
 * Returns array of: { artist, name, scrobbles, rank }
 */
export async function loadTracks() {
  const filePath = path.join(DATA_DIR, 'lastfmstats-tracks-export.csv');
  if (!existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const raw = await parseCSV(filePath);
  const rows = raw
    .filter(r => r['Artist'] && r['Name'])
    .map(r => ({
      artist:    r['Artist'].trim(),
      name:      r['Name'].trim(),
      scrobbles: parseInt(r['Scrobbles'], 10) || 0,
      rank:      parseInt(r['Rank'], 10) || 9999,
    }));

  console.log(`  ✓ tracks: ${rows.length.toLocaleString()} tracks loaded`);
  return rows;
}

/**
 * Load all 4 files at once.
 */
export async function loadAll() {
  console.log('\n📂 Reading Last.fm CSV exports...');
  const [fadgad, albums, artists, tracks] = await Promise.all([
    loadFadgad(),
    loadAlbums(),
    loadArtists(),
    loadTracks(),
  ]);
  return { fadgad, albums, artists, tracks };
}

/**
 * Build a lookup key from artist + album name.
 * Used consistently across all modules to match albums.
 */
export function albumKey(artist, album) {
  return `${artist.toLowerCase().trim()}||${album.toLowerCase().trim()}`;
}
