/**
 * How a time is written across the app.
 *
 * One rule, so a message in the transcript and a chat in the history list
 * never disagree about when something happened: recent enough to still feel
 * live reads as elapsed time, and anything older gets the clock, with the day
 * attached once "today" stops being obvious.
 */

const clock = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * The same rule, split so a separator can set the day apart from the clock.
 *
 * `lead` is the part that answers "when", `time` the part that answers
 * "exactly when" — and inside the hour there is no clock worth showing.
 */
export function timestampParts(
  at: number,
  now = Date.now(),
): { lead: string; time?: string } {
  const then = new Date(at);
  const mins = Math.floor((now - at) / 60000);

  if (mins < 1) return { lead: "Just now" };
  if (mins < 60) return { lead: `${mins} min ago` };

  if (sameDay(then, new Date(now))) return { lead: "Today", time: clock(then) };

  return {
    lead: then.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(then.getFullYear() === new Date(now).getFullYear() ? {} : { year: "numeric" }),
    }),
    time: clock(then),
  };
}

/**
 * The day alone, for a list where every row is a different conversation.
 *
 * Same vocabulary as the separator above a transcript, minus the clock — in a
 * list you are scanning for which day a thread belongs to, not the minute.
 */
export function dayLabel(at: number, now = Date.now()) {
  return timestampParts(at, now).lead;
}

/**
 * The day only — "Today", or the date. For the header above a day's messages,
 * where the clock belongs to each message, not to the day.
 */
export function dateLabel(at: number, now = Date.now()) {
  const then = new Date(at);
  if (sameDay(then, new Date(now))) return "Today";
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() === new Date(now).getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Just the clock — for a message sitting under a separator that has the day. */
export function clockTime(at: number) {
  return clock(new Date(at));
}

export function timestamp(at: number, now = Date.now()): string {
  const { lead, time } = timestampParts(at, now);
  return time ? `${lead} ${time}` : lead;
}
