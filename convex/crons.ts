/**
 * Scheduled jobs.
 *
 * Phase 5 TASK-065b / FR-023 introduces bad-actor pattern detection: a
 * daily scan of the reports table that flags users with ≥3 unique
 * reporters in a 7-day window and auto-suspends users who hit ≥5.
 *
 * 03:00 UTC: low-traffic window across both US and Europe; the scan does
 * not contend with peak load. Daily cadence is per the FR-023 acceptance
 * criterion.
 */
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily(
  'bad-actor-scan',
  { hourUTC: 3, minuteUTC: 0 },
  internal.badActorScan.run,
);

export default crons;
