/**
 * Shared catalogue for report reasons.
 *
 * Single source of truth for the schema-aligned `ReportReason` union and
 * the human-friendly labels. Keep these in lockstep with the
 * `convex/schema.ts` reports.reason validator — adding or renaming a
 * value here without updating the schema (or vice versa) will throw at
 * submit time, and surfaces (ReportReasonPicker, MyReports list) will
 * silently disagree about wording until both sides are reconciled.
 *
 * Per-reason descriptions live with the picker because they're only
 * shown at report-submission time; `MyReports` uses just the label.
 */

export type ReportReason =
  | 'fetishization'
  | 'transphobia'
  | 'unwanted-sexual-content'
  | 'harassment'
  | 'safety-concern'
  | 'fake-profile'
  | 'underage'
  | 'spam'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fetishization: 'Fetishizing behavior',
  transphobia: 'Transphobia',
  'unwanted-sexual-content': 'Unwanted sexual content',
  harassment: 'Harassment',
  'safety-concern': 'Safety concern',
  'fake-profile': 'Fake profile',
  underage: 'Underage',
  spam: 'Spam or scam',
  other: 'Something else',
};

export function reportReasonLabel(reason: string): string {
  // hasOwnProperty.call to avoid matching inherited prototype keys
  // ('toString', 'constructor', etc.) — without this, a malformed reason
  // like `"toString"` would resolve to `Object.prototype.toString` and
  // render `function () { [native code] }` in the UI.
  return Object.prototype.hasOwnProperty.call(REPORT_REASON_LABELS, reason)
    ? REPORT_REASON_LABELS[reason as ReportReason]
    : reason;
}
