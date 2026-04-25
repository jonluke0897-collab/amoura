# Phase 5 Copy Review

> ### 🚨 Hard merge gate
>
> **The Wave 2 PR (and Wave 3) MUST NOT merge to main until at least
> one paid trans advisor returns written sign-off on the strings
> below.** This is the advisor gate from `CLAUDE.md` and
> `docs/product-vision.md` § 1, applied to TASK-068. Placeholders ship
> in code so the build is testable, but no production deploy happens
> until the sign-off block at the bottom of this file is filled in.
>
> Compiled for trans-advisor sign-off per the advisor gate in
> `CLAUDE.md` and `docs/product-roadmap.md` TASK-068.
>
> Status: **awaiting advisor review** — placeholders ship in code, the
> file paths below are where each string lives once the review returns.
>
> Reviewer rubric (from `docs/product-vision.md` § 4 Brand Anti-Patterns):
> - No shame, no friction-blame, no "you did something wrong" tone.
> - Plain language, no legalese, no jargon.
> - Trans-first: never put cis users' comfort ahead of trans women's safety.
> - Surface-and-review beats silent suppression. Don't lie about what we do.

---

## Report flow ([src/features/reports/](../src/features/reports))

### Report reason picker — [ReportReasonPicker.tsx](../src/features/reports/ReportReasonPicker.tsx)

Each row is a label + one-line description. The description is shown
to the reporter to disambiguate, and surfaces to the moderator as the
intent the reporter chose this category.

| Value | Label | Description |
|---|---|---|
| `fetishization` | Fetishizing behavior | Treating someone as a body type or category, not a person. |
| `transphobia` | Transphobia | Slurs, misgendering on purpose, or hateful language. |
| `unwanted-sexual-content` | Unwanted sexual content | Explicit messages or photos you didn't ask for. |
| `harassment` | Harassment | Threats, repeated unwanted contact, intimidation. |
| `safety-concern` | Safety concern | Self-harm, danger to themselves or others. |
| `fake-profile` | Fake profile | Impersonation, catfishing, or stolen photos. |
| `underage` | Underage | You believe this person is under 18. |
| `spam` | Spam or scam | Promotion, off-platform redirects, or fraud. |
| `other` | Something else | Tell us in your own words on the next step. |

### Report sheet — [ReportSheet.tsx](../src/features/reports/ReportSheet.tsx)

| Surface | Copy |
|---|---|
| Sheet title (steps 1–2) | `Report {displayName}` |
| Sheet title (step 3) | `Report sent` |
| Step 1 prompt | What happened? Pick the closest match. The moderator team will read every word. |
| Step 1 CTA | Continue |
| Step 2 prompt | Anything you'd like to add? (Optional) |
| Step 2 placeholder | What should the moderator know? |
| Step 2 character hint | Optional — up to 1000 characters. |
| Step 2 share-conversation toggle | **Share this conversation** — The moderator will be able to read your messages with this person. We'll never show them to anyone else. |
| Step 2 CTAs | Back / Send report |
| Confirmation heading | Thanks for telling us. |
| Confirmation body | Our team reviews every report within 48 hours. You can check the status anytime in Settings → My reports. |
| Confirmation CTA | Done |

### Submit-error copy

| Trigger | Copy |
|---|---|
| Self-report (server: `You can't report yourself.`) | You can't report yourself. |
| Rate-limit (server: `RATE_LIMITED:reports-daily:5`) | Thanks — we're seeing a lot of reports from you today. Please make sure each is a real concern. |
| Other server errors | Surfaced verbatim from the mutation — should be rare (linked-message validation, target not found). |

---

## Block / unblock ([src/features/blocks/BlockAction.tsx](../src/features/blocks/BlockAction.tsx))

Both flows use the native `Alert.alert` confirmation pattern (matching
the existing Unmatch flow in `ChatHeader.tsx`).

### Block confirmation

| Surface | Copy |
|---|---|
| Title | `Block {displayName}?` |
| Body | They won't be able to find you, like you, or message you. They won't be told. |
| Buttons | Cancel / Block (destructive style) |
| Error title | Couldn't block |
| Error body | Surfaced from the mutation. |

### Unblock confirmation

| Surface | Copy |
|---|---|
| Title | `Unblock {displayName}?` (or `Unblock this person?` for orphan rows) |
| Body | `{name} will be able to find you again. Your previous match (if any) won't come back automatically.` |
| Buttons | Cancel / Unblock (default style) |
| Error title | Couldn't unblock |

---

## Settings → Safety & Privacy ([app/(tabs)/profile.tsx](../app/(tabs)/profile.tsx))

### Section header
- `Safety & Privacy`

### Rows

| Label | Hint | Action |
|---|---|---|
| Verify your photo | Coming soon | Alert: *Photo verification is almost here.* / *We're adding photo and ID verification in the next update.* |
| Verify your ID | Coming soon | Same as above (different first sentence). |
| Blocked users | — | → BlockedUsersScreen |
| My reports | — | → MyReportsScreen |
| Safety tips | — | Opens SafetyTipsSheet |

### Wave-3 placeholder Alert
- Title: `Photo verification is almost here.` / `ID verification is almost here.`
- Body: We're adding photo and ID verification in the next update.

---

## Blocked users screen ([app/settings/blocked-users.tsx](../app/settings/blocked-users.tsx))

| Surface | Copy |
|---|---|
| Title | Blocked users |
| Empty heading | You haven't blocked anyone. |
| Empty body | When you do, they'll show up here so you can take it back if you change your mind. |
| Row label | `{displayName}` or `Account no longer available` (orphan) |
| Row metadata | `Blocked {relative time}` |
| Row CTA | Unblock |

---

## My reports screen ([app/settings/my-reports.tsx](../app/settings/my-reports.tsx))

| Surface | Copy |
|---|---|
| Title | My reports |
| Empty heading | No reports yet. |
| Empty body | If you ever need to flag someone, you can do it from their profile or chat. We review every report within 48 hours. |
| Status pills | Awaiting review / In review / Action taken / No action |
| Row metadata | `Sent {relative time}` plus `Resolved {relative time}` when applicable |
| Moderator-notes header | From the moderator |

---

## Safety tips sheet ([src/features/settings/SafetyTipsSheet.tsx](../src/features/settings/SafetyTipsSheet.tsx))

### Tips
1. **Trust your gut.** If a profile or message feels off, it usually is. You can leave a chat at any time, and you don't owe anyone an explanation.
2. **Meet in public the first time.** Coffee, a walk, somewhere with people around. Tell a friend where you're going and when you expect to be home.
3. **Hold private info private.** No need to share your full name, address, or workplace until you actually trust someone. Amoura never shows your last name.
4. **Block and report freely.** Blocking is bidirectional and instant. Reports are reviewed within 48 hours. Either tool is yours to use whenever you need it — no need to be sure or apologise.
5. **You set the pace.** You don't have to reply, meet up, share photos, or explain yourself. Anyone who pushes against that isn't a fit, full stop.

### Crisis resources section header
- `If you're in crisis`

### Crisis resources (US-only at launch; expand as rollout broadens)
- **Trans Lifeline** — Peer support hotline run by trans people, for trans people. US: 877-565-8860.
- **The Trevor Project** — Crisis intervention for LGBTQ+ young people. US: 1-866-488-7386.
- **988 Suicide & Crisis Lifeline** — US: dial or text 988. Press 3 for LGBTQ+ specialised support.

---

## Account-state error copy ([convex/lib/currentUser.ts](../convex/lib/currentUser.ts))

These prefixes let the client switch error UX. The colon-separated tail is what the user sees.

| State | Server error | UI rendering |
|---|---|---|
| Suspended | `ACCOUNT_SUSPENDED:Your account is under review.` | "Your account is under review." (no shame, no detail about why — moderator-internal) |
| Banned | `ACCOUNT_BANNED:This account has been removed.` | "This account has been removed." |
| Deleted | `ACCOUNT_DELETED:This account has been deleted.` | "This account has been deleted." (only seen if deleted user signs in during the 30-day soft-delete window) |

### Wave-3 client routing (planned)
- Suspended → full-screen "your account is under review" screen with appeal-via-email instructions and `/safety-tips` link.
- Banned → "this account has been removed" with no appeal path. Direct to email support for human review.
- Deleted → soft-delete confirmation screen with "restore my account" CTA.

---

## Filter sheet — verified-only ([src/features/browse/FilterSheet.tsx](../src/features/browse/FilterSheet.tsx))

| Surface | Copy |
|---|---|
| Section title | Verified only |
| Toggle label | Only photo-verified profiles |
| Toggle description | Hide profiles that haven't completed photo verification yet. |

(Phase 6 will add a paywall sheet when free-tier users tap the toggle. Copy not finalised — left out of this review.)

---

## Reviewer notes / open questions

These are deliberate ambiguities I'd like advisor input on:

1. **Report reason "underage"** — currently phrased as "You believe this person is under 18." Is "believe" too soft, or does it set the right tone for a reporter who isn't certain? Alternative: "Someone who appears to be under 18."
2. **Block confirmation** — "They won't be told." is direct and (intentionally) doesn't promise *you* won't see anything from them either. Should that promise be added? Tradeoff: more reassurance vs. having to explain orphan-block placeholders if a previously-blocked user got purged.
3. **Crisis resources placement** — at the bottom of Safety tips. Should they be more prominent (separate Settings entry, top of the sheet)? Risk of resources-fatigue if they're too prominent vs. being available when needed.
4. **"Coming soon" hint on Verify photo / Verify ID** — does showing the unbuilt rows create disappointment, or does it set expectation that verification is coming? Could hide them entirely until Wave 3.
5. **Suspended-account UX** — "Your account is under review." gives no timeline and no appeal path. Should it route to an email-support link inline? (Phase 5 ships without an in-app appeal flow per the plan; resolved via email.)

---

## Sign-off

- [ ] Advisor: ___________
- [ ] Date: ___________
- [ ] Notes: ___________

When sign-off lands, update the corresponding strings in the source
files listed above (CTRL-F the exact phrase to find it), then mark
TASK-068 in `docs/product-roadmap.md`.
