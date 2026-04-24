/**
 * Calendar-based age from a DOB timestamp. Calendar arithmetic rather
 * than (now - dob)/YEAR_MS so users don't briefly show as the wrong age
 * around birthdays (off-by-one around leap years or early in the day on
 * the birthday itself). Returns null for missing / impossible values.
 */
export function computeAge(
  dob: number | undefined,
  now: number = Date.now(),
): number | null {
  if (dob === undefined || !Number.isFinite(dob) || !Number.isFinite(now)) {
    return null;
  }
  const birth = new Date(dob);
  const current = new Date(now);
  // A finite `dob` can still sit outside JS's Date range (e.g. 1e20) and
  // produce an Invalid Date whose getTime() returns NaN. Without this
  // guard the NaN year math propagates past the `< 0 || > 150` bounds
  // check (NaN fails every numeric compare) and we return a nonsense age.
  if (Number.isNaN(birth.getTime()) || Number.isNaN(current.getTime())) {
    return null;
  }
  let years = current.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassedThisYear =
    current.getUTCMonth() > birth.getUTCMonth() ||
    (current.getUTCMonth() === birth.getUTCMonth() &&
      current.getUTCDate() >= birth.getUTCDate());
  if (!birthdayPassedThisYear) years -= 1;
  if (!Number.isFinite(years) || years < 0 || years > 150) return null;
  return years;
}
