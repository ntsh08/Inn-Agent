import { slug } from "@/lib/sources";

// Re-exported so a page imports its frame and its anchor helper together.
export { slug as slugOf };

/**
 * The frame every non-agent section sits in.
 *
 * Deliberately plain: these pages exist so the agent's citations land
 * somewhere real and the rail has somewhere to go. The conversation is the
 * product — this is the record behind it.
 */
export default function Section({
  title,
  summary,
  children,
}: {
  /** A node, not a string — a section inside a record puts a breadcrumb here. */
  title: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-8 py-8">
        <header className="mb-6">
          {/* No project name here — the suite bar above already says which
              project you are in, and saying it twice reads as a template. */}
          <h1 className="text-[22px] font-medium tracking-[-0.01em] text-txt">{title}</h1>
          {summary && <div className="mt-1.5 text-[13px] text-txt-dim">{summary}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}

/** A row the agent pointed at, so a citation link lands on something visible. */
export function highlight(active: boolean) {
  return active ? "bg-accent-soft/60 ring-1 ring-inset ring-accent/25" : "";
}
