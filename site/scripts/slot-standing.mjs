const MINUTE_MS = 60_000;

const sortedTimes = (times) => [...times].sort();
const minuteOfDay = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

const articlesClaimedOn = (claims, day) =>
  new Set(
    claims
      .filter(({ claim }) => claim.format === 'article' && claim.claimedAt.slice(0, 10) === day)
      .map(({ claim }) => claim.slug)
  ).size;

export function slotStanding({ times, catchUpMinutes, claims, now }) {
  const day = now.toISOString().slice(0, 10);
  const midnight = Date.parse(`${day}T00:00:00Z`);
  const slots = sortedTimes(times);
  const instantOf = (time) => midnight + minuteOfDay(time) * MINUTE_MS;
  const passed = slots.filter((time) => instantOf(time) <= now.getTime()).length;
  const entries = articlesClaimedOn(claims, day);
  if (entries >= passed) return { day, passed, entries, due: false, slot: null, lateMinutes: null, catchUp: null };
  const slot = slots[entries];
  const lateMinutes = Math.floor((now.getTime() - instantOf(slot)) / MINUTE_MS);
  const retried = catchUpMinutes.length > 0 && lateMinutes >= Math.min(...catchUpMinutes);
  return { day, passed, entries, due: true, slot, lateMinutes, catchUp: retried ? { slot, lateMinutes } : null };
}
