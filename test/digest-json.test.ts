import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the reader digest: 5 jobs, job-sorted', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(readNight('runs', '2026-10-28'));
    const jobs = body.rows.map((r: { job: string }) => r.job);
    expect(jobs).toHaveLength(5);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('404s with a JSON body for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no digest for this night' });
  });
});
