/**
 * A greeting or a "what can you do?" — the only messages answered from the
 * prompt alone, with no tool to call. Shared so the server (which thinks less
 * for these) and the chat (which shows fixed starter suggestions after them)
 * always agree on what counts.
 */
export function isSmallTalk(text: string) {
  const t = text.trim().toLowerCase();
  if (t.length > 60) return false;
  return (
    /^(hi+|hello|hey+|yo|namaste|good (morning|afternoon|evening))\b[\s!.,?]*$/.test(t) ||
    /what (can|do|could) you (do|help)|how can you help|what is this|who are you|what can i ask/.test(t)
  );
}

/** What to try first, after a greeting — the two broadest ways in. */
export const STARTER_SUGGESTIONS = [
  "What are we running short on?",
  "Which POs are still pending delivery?",
];
