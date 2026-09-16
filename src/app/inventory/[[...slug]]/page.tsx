import Section, { highlight, slugOf } from "@/components/Section";
import { MATERIALS, available, shortfall, leadTime } from "@/lib/data";

export const metadata = { title: "Inventory — INA Procure" };

/** Optional slug so a cited material lands on its own row. */
export default function InventoryPage({ params }: { params: { slug?: string[] } }) {
  const target = params.slug?.join("/") ?? "";

  return (
    <Section
      title="Inventory"
      summary={`${MATERIALS.length} materials`}
    >
      <div className="overflow-hidden rounded-[10px] border border-line bg-bg">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-raised text-left text-[11px] uppercase tracking-[0.06em] text-txt-faint">
              <Th>Material</Th>
              <Th right>Required</Th>
              <Th right>In stock</Th>
              <Th right>Available</Th>
              <Th right>Short by</Th>
              <Th right>Lead time</Th>
            </tr>
          </thead>
          <tbody>
            {MATERIALS.map((m) => {
              const gap = shortfall(m);
              const lead = leadTime(m.id);
              const cited =
                !!target &&
                (slugOf(`${m.name} (${m.spec})`) === target ||
                  slugOf(m.name) === target ||
                  m.id === target);

              return (
                <tr
                  key={m.id}
                  id={slugOf(`${m.name} (${m.spec})`)}
                  className={`border-t border-line-soft ${highlight(cited)}`}
                >
                  <Td>
                    <span className="text-txt">{m.name}</span>
                    <span className="block text-[11.5px] text-txt-faint">{m.spec}</span>
                  </Td>
                  <Td right>{num(m.required)} {m.unit}</Td>
                  <Td right>{num(m.inStock)} {m.unit}</Td>
                  <Td right>{num(available(m))} {m.unit}</Td>
                  <Td right>
                    {gap > 0 ? (
                      <span className="font-medium text-danger">
                        {num(gap)} {m.unit}
                      </span>
                    ) : (
                      <span className="text-txt-faint">—</span>
                    )}
                  </Td>
                  <Td right>
                    {lead ? (
                      `${lead} days`
                    ) : (
                      <span className="text-txt-faint" title="No live quotes for this material">
                        —
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3.5 py-2.5 font-normal ${right ? "text-right" : ""}`}>{children}</th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-3.5 py-3 align-top ${right ? "text-right tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

const num = (n: number) => n.toLocaleString("en-IN");
