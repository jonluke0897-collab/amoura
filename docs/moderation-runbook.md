# Moderation Runbook

> Phase 5 launch-window operations guide for moderating Amoura via the
> Convex dashboard. Phase 6 will replace this manual workflow with a
> dedicated Next.js admin UI; until then, this runbook is the source of
> truth for how a moderator picks up reports, takes action, and closes
> the loop.

## Who can moderate

Only users with `users.role === 'moderator'` can call the mutations in
`convex/moderationOps.ts`. To grant moderator access:

1. Open the Convex dashboard for the active deployment (`adjoining-axolotl-190`).
2. Browse to the `users` table.
3. Find the moderator's row by `email` or `clerkId` and edit the `role`
   field to `"moderator"`.
4. Save. The change is live immediately — no app restart required.

To revoke, set the field back to `"user"` or clear it.

There is intentionally no in-app or self-service way to grant moderator
access. Promotion is a deliberate dashboard action.

## Daily review loop

Once per day (or more often during incidents), a moderator should:

### 1. Triage open reports

In the Convex dashboard's **Data** view, open the `reports` table and
filter by `status === "open"`. Sort by `createdAt` ascending so the
oldest unreviewed reports are at the top. The 48-hour SLA per FR-024
starts at `createdAt`.

For each report, read:

- `reason` — the category the reporter chose
- `context` — optional free-text from the reporter
- `relatedMessageId` — if set, look up the message in the `messages`
  table by `_id` and read its `body`
- `relatedMatchId` — if set, page through `messages` by `matchId` to see
  the full thread context

Then look up the reported user (`reportedUserId` field) and check:

- `users.accountStatus` — if already `banned`, just dismiss the report
  with a note linking to the prior action
- `moderationFlags` table filtered by `userId === reportedUserId` and
  `status === "open"` — context for repeat-offender pattern

### 2. Take action

Open the dashboard's **Functions** panel and pick from
`convex/moderationOps.ts`:

- **`dismissReport`** — close without action. Use when the report is
  unfounded or duplicates a prior actioned case. The reporter sees the
  status update in their Settings → My Reports list.
  ```json
  { "reportId": "...", "notes": "..." }
  ```
- **`warnUser`** — log a warning. No push is sent in Phase 5; the warning
  shows up in the audit trail and informs follow-up reviews.
  ```json
  { "targetUserId": "...", "reason": "...", "relatedReportId": "..." }
  ```
- **`suspendUser`** — flip `accountStatus` to `suspended`. The user is
  rejected at sign-in with the `ACCOUNT_SUSPENDED` error code. Reversible
  via `reinstateUser`.
  ```json
  { "targetUserId": "...", "reason": "...", "relatedReportId": "..." }
  ```
- **`banUser`** — terminal removal. Use only after warn → suspend →
  confirmed pattern, or on first-strike for severe violations
  (transphobia, threats, doxxing).
  ```json
  { "targetUserId": "...", "reason": "...", "relatedReportId": "..." }
  ```
- **`reinstateUser`** — flip a suspended account back to `active`. Use
  when the suspension turns out to be a false positive (often when the
  FR-023 cron auto-suspends and review concludes the reports were not
  actionable).
  ```json
  { "targetUserId": "...", "reason": "..." }
  ```

Every action writes to `moderationActions` for audit. The Phase 6 admin
UI will present this audit log per user; until then, query the table by
`targetUserId` to see a user's history.

### 3. Review automated flags

The `bad-actor-scan` cron runs daily at 03:00 UTC and writes to
`moderationFlags` (per FR-023). Filter the table by `status === "open"`
and review:

- `multiple-reports` flags — high-severity by default; the cron has
  already auto-suspended users with ≥5 unique reporters. Verify the
  suspension is appropriate, then either confirm with `banUser` or
  reverse with `reinstateUser`.
- `flagged-keywords` flags — emitted by `messages.send` when a keyword
  match is detected. The message was delivered (not auto-deleted). Read
  the message in context, decide whether action is warranted, and patch
  the flag's `status` to `reviewed` or `resolved` directly in the
  dashboard.

### 4. Close the loop

After taking action, mark the moderationFlags row as reviewed by patching
`status` to `reviewed` (still open in queue but no longer requiring
action) or `resolved` (fully closed).

## Manual cron invocation

To dry-run or force-run the bad-actor scan outside the daily schedule,
open the **Functions** panel, find `badActorScan.run`, and invoke with
no args. The function returns `{ scanned, flagged, suspended }` so you
can verify the scan saw the expected report volume.

## Updating the moderation keyword list

`convex/moderationKeywords.ts` ships in the public repo with placeholder
values that match nothing real. The advisor-curated list never lives in
source control. Procedure for the operator deploying production:

1. Curate the list with the trans advisors. Keep it in a private,
   non-indexed location (encrypted note, password manager, private gist).
2. On a local checkout, replace the body of `MODERATION_KEYWORDS` with
   the real list. **Do not commit this change.**
3. Run `npx convex deploy` (or `npx convex dev` for dev deploys). The
   deploy bundles the local file content; the production deployment now
   has the real list while the repo still ships placeholders.
4. Revert the local file (`git checkout convex/moderationKeywords.ts`)
   so the working tree matches the repo.
5. To update the list later, repeat: edit, deploy, revert.

The runtime keyword set is whatever was bundled at the most recent
deploy. Convex does not let functions read arbitrary files at runtime,
so a private side-loaded JSON or env var would also work but adds
parsing overhead on every cold start. The deploy-and-revert flow is
simpler and the privacy properties are equivalent.

## Things NOT to do

- **Do not auto-delete flagged messages.** The keyword detection layer
  is intentionally surface-and-review, not block. False positives on
  reclaimed in-community language are inevitable; silent suppression is
  a worse harm than letting a moderator review.
- **Do not unban users via dashboard write.** Banning is terminal by
  design. If a ban needs to be reversed, the decision should be
  deliberate enough to warrant a direct dashboard `accountStatus` patch
  with a written justification appended to a separate audit doc.
- **Do not edit `moderationActions` rows.** They are an append-only
  audit log. If a moderator misjudges an action, the correction is a
  new row, not a rewrite.

## Escalation

Phase 5 ships with a single moderator (the founder). When report volume
grows past one-person-once-a-day capacity, hire a part-time moderator
from the advisor pool per `docs/product-vision.md` § 3 risks. The
`users.role = "moderator"` toggle is all that's needed to onboard.

If a report indicates immediate physical safety risk (doxxing, stalking,
explicit threats), pager the founder out-of-band and escalate to
appropriate authorities. The 48-hour SLA does not apply — these are P0.
