const CAREER_START_UTC = Date.UTC(2008, 0, 1);

export function yearsShipping(nowMs) {
  const now = new Date(nowMs);
  const start = new Date(CAREER_START_UTC);
  const beforeAnniversary =
    now.getUTCMonth() < start.getUTCMonth() ||
    (now.getUTCMonth() === start.getUTCMonth() && now.getUTCDate() < start.getUTCDate());

  return now.getUTCFullYear() - start.getUTCFullYear() - (beforeAnniversary ? 1 : 0);
}
