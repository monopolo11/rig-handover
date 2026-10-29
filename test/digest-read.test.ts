import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs sorted by job, and counts the 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('folds a job into one row, times as written', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      fails: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, runs: 1 });
  });
});

describe('readNight edges', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    writeFileSync(join(dir, 'secret.jsonl'), '{}');
    expect(readNight(dir, '../secret')).toBeNull();
    expect(readNight(dir, 'secret')).toBeNull();
  });

  it('reads an empty file as nothing ran', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts lines with missing or invalid fields as bad', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":null}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"maybe","owner":null}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok"}',
      '{"job":"a","status":"ok","owner":"rook"}',
      '[1,2]',
      'null',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toHaveLength(1);
  });
});
