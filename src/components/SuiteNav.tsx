import { PROJECT, USER } from "@/lib/data";

/**
 * The INA suite's top bar, sitting above INA Procure.
 *
 * Chrome, not app: the tabs belong to the suite shell, so nothing here is
 * wired up in this prototype. The logomark is the exported Figma asset rather
 * than a redrawn approximation.
 */

const TABS = ["Home", "Organization", "Projects", "Master Data"] as const;
const ACTIVE: (typeof TABS)[number] = "Projects";

export default function SuiteNav() {
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between bg-nav px-4 py-0.5">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nav/inncircles-logomark.svg" alt="Inncircles" className="h-8 w-8" />
        </span>

        <span className="flex items-center">
          <span className="p-1 text-[14px] font-medium leading-5 tracking-[-0.14px] text-nav-text">
            {PROJECT.name}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nav/chevron-up-down.svg" alt="" className="h-4 w-4 shrink-0" />
        </span>
      </div>

      <nav className="absolute left-1/2 top-0.5 flex -translate-x-1/2 items-center gap-2 p-1">
        {TABS.map((tab) => {
          const active = tab === ACTIVE;
          return (
            <span
              key={tab}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center whitespace-nowrap p-2 text-[14px] font-medium leading-5 tracking-[-0.14px] ${
                active ? "border-b-2 border-nav-line text-white" : "text-nav-muted"
              }`}
            >
              {tab}
            </span>
          );
        })}
      </nav>

      <Account />
    </header>
  );
}

/** A photo when one is set, initials when it isn't — the usual account mark. */
function Account() {
  return (
    <span
      title={USER.firstName}
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[11.5px] font-medium text-white ring-1 ring-white/20"
    >
      {USER.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={USER.avatar} alt={USER.firstName} className="h-full w-full object-cover" />
      ) : (
        USER.firstName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
