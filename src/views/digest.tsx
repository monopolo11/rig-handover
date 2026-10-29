import type { DigestRow, NightDigest } from '../digest/types.js';

const dash = '—';

// Retries of 3 or more, or any fail, get marked (plan.md § 2a): warn colour plus a leading "!"
// so the mark survives a screenshot without colour.
const needsMark = (row: DigestRow) => row.retries >= 3 || row.fails > 0;

/** The morning digest for one night: one table, rows already sorted by job. */
export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="mute">
          {digest.badLines} {digest.badLines === 1 ? 'line' : 'lines'} skipped (unreadable)
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={needsMark(row) ? 'warn' : undefined}>
                <td>{needsMark(row) && '! '}{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? dash}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
