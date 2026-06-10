// SM-2 simplified spaced-repetition algorithm.
// Grade: 0=Again, 3=Hard, 4=Good, 5=Easy.
export type SrsState = { ease: number; interval: number; repetitions: number };

export function scheduleNext(prev: SrsState, grade: 0 | 3 | 4 | 5): SrsState & { dueInDays: number } {
  let { ease, interval, repetitions } = prev;
  if (grade < 3) {
    repetitions = 0;
    interval = 0;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * ease);
    repetitions += 1;
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
  const dueInDays = grade < 3 ? 0 : interval;
  return { ease, interval, repetitions, dueInDays };
}

export function nextDueAt(dueInDays: number): string {
  const d = new Date();
  if (dueInDays === 0) d.setMinutes(d.getMinutes() + 10);
  else d.setDate(d.getDate() + dueInDays);
  return d.toISOString();
}
