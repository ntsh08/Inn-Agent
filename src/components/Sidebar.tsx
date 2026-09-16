"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The app's three places, in a rail beside them.
 *
 * Collapsed to icons by default — the agent is where the work happens and it
 * deserves the width — and expandable when you want the labels. The choice is
 * remembered, because a rail that resets every reload is a rail you fight.
 */

const KEY = "ina-procure:rail";

/** Most sections draw a stroke icon; the agent brings its own mark. */
type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  art?: React.ReactNode;
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Agent",
    // The same mark the agent thinks with, redrawn as vector.
    //
    // The Orb component builds its dots from eight 3px CSS circles scaled by
    // a fractional factor, which is fine at indicator size while it moves and
    // mush at nav size while it sits still. This is its resting geometry —
    // eight dots, 45 degrees apart, on a radius-7 ring of a 28-unit stage.
    art: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="currentColor" className="shrink-0" aria-hidden>
        <circle cx="14.00" cy="7.00" r="1.7" />
        <circle cx="18.95" cy="9.05" r="1.7" />
        <circle cx="21.00" cy="14.00" r="1.7" />
        <circle cx="18.95" cy="18.95" r="1.7" />
        <circle cx="14.00" cy="21.00" r="1.7" />
        <circle cx="9.05" cy="18.95" r="1.7" />
        <circle cx="7.00" cy="14.00" r="1.7" />
        <circle cx="9.05" cy="9.05" r="1.7" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (
      <>
        <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
        <path d="M3.5 7.5L12 12m0 0l8.5-4.5M12 12v9" />
      </>
    ),
  },
  {
    href: "/orders",
    label: "Purchase orders",
    icon: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 16h4" />
      </>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) === "open");
    } catch {
      // A blocked store just means the rail starts collapsed.
    }
  }, []);

  function toggle() {
    setOpen((v) => {
      try {
        localStorage.setItem(KEY, v ? "closed" : "open");
      } catch {
        // Ignore: the choice still holds for this session.
      }
      return !v;
    });
  }

  return (
    <nav
      aria-label="Sections"
      className={`group relative flex shrink-0 flex-col gap-1 border-r border-line bg-raised p-2 transition-[width] duration-200 ease-out ${
        open ? "w-[196px]" : "w-[56px]"
      }`}
    >
      {/* The toggle is chrome, not a destination, so it sits on the rail's
          edge rather than in the list — a handle for the panel, at a size and
          weight that never competes with a section. */}
      <button
        onClick={toggle}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={open}
        className="absolute -right-[11px] top-3.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-bg text-txt-faint opacity-0 shadow-sm transition-[opacity,color] duration-150 hover:text-txt-dim focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "" : "rotate-180"}`}
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={open ? undefined : item.label}
            className={`relative flex h-9 shrink-0 items-center gap-3 rounded-[8px] px-[9px] transition-colors ${
              active
                ? "bg-accent-soft text-accent-ink"
                : "text-txt-dim hover:bg-line-soft hover:text-txt"
            }`}
          >
            {/* The accent bar marks the section without needing the label. */}
            {active && (
              <span
                aria-hidden
                className="absolute -left-2 top-1.5 h-6 w-[2.5px] rounded-r-full bg-accent"
              />
            )}

            <span
              aria-hidden
              // The box stays 18px so every label lines up; the agent's mark
              // is drawn larger than it and simply overflows, centred.
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"
            >
              {item.art ?? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 1.9 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
              )}
            </span>

            {/* Kept mounted and clipped, so the label slides out of the icon
                rather than popping in once the width animation has finished. */}
            <span
              className={`overflow-hidden whitespace-nowrap text-[13px] transition-opacity duration-150 ${
                open ? "opacity-100" : "w-0 opacity-0"
              } ${active ? "font-medium" : ""}`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
