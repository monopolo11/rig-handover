import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders 2026-10-28 with marks and dashes', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    const rows = [...html.matchAll(/<tr( class="warn")?><td>(?:! )?([^<]+)<\/td>/g)];
    expect(rows.map((r) => [r[2], Boolean(r[1])])).toEqual([
      ['digest/render', false],
      ['fixtures/refresh', true],
      ['lane/sync', false],
      ['notes/backup', true],
      ['rig/rotate-logs', false],
    ]);
    expect(html).toMatch(/digest\/render<\/td><td>—<\/td>/);
    expect(html).toContain('2026-10-29T01:30:00+01:00');
  });

  it('404s for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });
});
