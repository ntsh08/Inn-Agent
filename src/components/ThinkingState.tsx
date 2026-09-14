"use client";

import styles from "./ThinkingState.module.css";

/**
 * Shimmering status label. Shipped by the registry with a hardcoded
 * "Thinking"; widened here to take the caller's text so it can track what
 * the agent is actually doing, and to tint from --shimmer-ink.
 */
export function ThinkingState({ children = "Thinking" }: { children?: React.ReactNode }) {
  return <span className={styles.shimmer}>{children}</span>;
}
