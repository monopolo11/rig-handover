import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

// Route tests for the digest page and JSON, over a temp runs dir (`runs/` is read-only).
// Each night is its own small fixture.
const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: 'rook', ...extra });

const nights = {
  // Written out of job order on purpose: both routes must sort by job.
  '2026-02-01': [
    line('zeta/sync', 'ok', '2026-02-02T01:00:00+01:00'),
    line('alpha/build', 'retry', '2026-02-02T01:05:00+01:00', { error: 'upstream 503' }),
    line('alpha/build', 'retry', '2026-02-02T01:06:00+01:00', { error: 'upstream 503' }),
    line('alpha/build', 'retry', '2026-02-02T01:07:00+01:00', { error: 'upstream 503' }),
    line('alpha/build', 'ok', '2026-02-02T01:08:00+01:00'),
    line('mid/backup', 'fail', '2026-02-02T01:10:00+01:00', { error: 'quota exceeded', owner: null }),
  ],
  '2026-02-02': [],
  '2026-02-03': [
    line('b/job', 'ok', '2026-02-04T01:00:00+01:00'),
    'not json at all',
    '{"at":"2026-02-04T01:01:00+01:00","job":"c/job","status":"maybe","owner":null}',
    line('a/job', 'ok', '2026-02-04T01:02:00+01:00'),
  ],
};

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [night, lines] of Object.entries(nights)) {
    writeFileSync(join(dir, `${night}.jsonl`), lines.map((l) => `${l}\n`).join(''));
  }
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Jobs in table order, and whether each row carries the warn mark.
const pageRows = (html: string) =>
  [...html.matchAll(/<tr( class="warn")?><td>(?:! )?([^<]+)<\/td>/g)].map((m) => ({
    job: m[2],
    marked: Boolean(m[1]),
  }));

const getJson = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as NightDigest };
};

describe('a night with a file', () => {
  it('page: 200, rows sorted by job, marks and dashes', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageRows(html)).toEqual([
      { job: 'alpha/build', marked: true }, // 3 retries
      { job: 'mid/backup', marked: true }, // a fail
      { job: 'zeta/sync', marked: false },
    ]);
    expect(html).toMatch(/mid\/backup<\/td><td>—<\/td>/); // null owner
    expect(html).toContain('2026-02-02T01:10:00+01:00'); // offset kept
  });

  it('JSON: 200 with the folded rows', async () => {
    const { res, body } = await getJson('2026-02-01');
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-02-01');
    expect(body.counts).toEqual({ ok: 2, retry: 3, fail: 1 });
    expect(body.rows.find((r) => r.job === 'alpha/build')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const { body } = await getJson('2026-02-01');
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha/build', 'mid/backup', 'zeta/sync']);
    expect(pageRows(html).map((r) => r.job)).toEqual(jobs);
  });
});

describe('a night with no file', () => {
  it('page 404s', async () => {
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
  });

  it('JSON 404s with an error body', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no digest for this night' });
  });
});

describe('the empty night', () => {
  it('page says nothing ran and renders no table', async () => {
    const res = await app.request('/digest/2026-02-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('JSON has no rows', async () => {
    const { res, body } = await getJson('2026-02-02');
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
});

describe('a night with bad lines', () => {
  it('page: 200, mentions the skipped lines, good lines still render', async () => {
    const res = await app.request('/digest/2026-02-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('2 lines skipped');
    expect(pageRows(html).map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });

  it('JSON: 200, badLines counted, good lines still in rows', async () => {
    const { res, body } = await getJson('2026-02-03');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });
});
