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
  if (dob === undefined || !Number.isFinite(dob)) return null;
  const birth = new Date(dob);
  const current = new Date(now);
  let years = current.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassedThisYear =
    current.getUTCMonth() > birth.getUTCMonth() ||
    (current.getUTCMonth() === birth.getUTCMonth() &&
      current.getUTCDate() >= birth.getUTCDate());
  if (!birthdayPassedThisYear) years -= 1;
  if (years < 0 || years > 150) return null;
  return years;
}
