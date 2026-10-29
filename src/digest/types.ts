// Contract for the morning digest (plan.md § 1). Section 2 (page, JSON, board link, route tests)
// builds against this file only. The reader lives in `./read.ts`:
//
//   import { readNight } from './digest/read.js';
//   const night = readNight(config.runsDir, c.req.param('night'));
//   if (!night) return c.notFound();                 // no file, or not a YYYY-MM-DD night
//   if (night.rows.length === 0) { /* nothing ran */ }

/** Status of one run line in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night. Times are exactly as written in the log, offset kept, never converted. */
export type DigestRow = {
  job: string;
  /** Owner on the job's latest line. `null` renders as `—`. */
  owner: string | null;
  /** Run lines for this job, whatever their status. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /** Lines with status `fail`. */
  fails: number;
  /** Status of the job's latest line. */
  lastStatus: RunStatus;
  /** Most recent `error` the job reported, even if a later line succeeded. `null` if none. */
  lastError: string | null;
  /** `at` of the job's first and latest line, in file order. */
  firstAt: string;
  lastAt: string;
};

/** Run lines per status across the whole night, for the status board. */
export type RunCounts = Record<RunStatus, number>;

export type NightDigest = {
  /** `YYYY-MM-DD`, as asked. */
  night: string;
  /** One row per job, sorted by job. Empty means nothing ran. */
  rows: DigestRow[];
  counts: RunCounts;
  /** Lines that were not valid JSON or lacked a valid field. Counted, never thrown. */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when there is no such file, or when `night`
 * is not `YYYY-MM-DD` (so a URL param can never reach a path outside `runsDir`).
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
