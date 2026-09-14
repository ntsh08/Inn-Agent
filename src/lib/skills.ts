/**
 * Skills: progressive disclosure.
 *
 * Only the name and description of each skill sit in the system prompt. The
 * body — the detailed workflow the model should follow — is pulled in on demand
 * by the `load_skill` tool. Keeps the standing prompt small while leaving room
 * for genuinely long domain guidance.
 */

export type Skill = { name: string; description: string; body: string };

export const SKILLS: Skill[] = [
  {
    name: "buy-materials",
    description:
      "How to take a material shortfall through to an approved purchase order: sizing the order, screening vendors, weighing rate against lead time and reliability, GST and MOQ arithmetic, and what the approver needs to see. Load this before recommending a vendor or raising any PO.",
    body: `# Buying materials

## Sizing the order

Order the **shortfall**, not the full requirement. If the plan needs 800 bags and 160 are on site, you buy 640. Stock already held is stock already paid for.

Then adjust upward for two reasons, and only these two:
- **MOQ.** If the vendor's minimum order exceeds the shortfall, you must order the minimum. Say so explicitly — the user should know why they are buying more than they need.
- **Wastage**, where the material has a conventional allowance: cement and concrete ~2%, steel ~3% for cutting, plywood ~5%. Apply it, round to a sensible whole unit, and mention it in one clause. Never apply wastage silently.

Round to whole units the vendor actually sells in. Nobody delivers 647.3 bags.

## Screening vendors

1. **Approved only.** Unapproved vendors cannot go on a PO. There is no exception, no matter how good the rate is. If an unapproved vendor is materially cheaper, you may mention that onboarding them is worth considering — but you cannot do it and you cannot use them now.
2. **Lead time against the need-by date.** Compute it. A vendor whose lead time overshoots the date is out of the running, and you say that directly: "Deccan is ₹23 a bag cheaper but 8 days out — the pour is in 5, so it doesn't work." Never present an undeliverable vendor as a cheaper alternative.
3. **Then price, reliability and rating** among whoever is left.

## Weighing the remaining options

Once two or more vendors can actually deliver in time:

- **Take the cheapest one.** Speed you do not need is not worth paying for. If two vendors both land before the need-by date, arriving earlier has no value on its own — the material sits on site either way.
- **Float decides whether reliability outranks price.** Float is the gap between the vendor's delivery date and the need-by date.
  - **3 or more days of float:** go cheapest, unless its on-time record is below 80%.
  - **1-2 days of float:** a vendor below 90% on-time is a real risk. Paying a premium for a more reliable or faster vendor is justified here — say that the float is thin and that is why.
  - **Zero float:** take the fastest vendor with the best on-time record, whatever it costs, and flag that there is no room for slippage.
- Never recommend a pricier vendor "to be safe" when the float is comfortable. If you are about to, check the float again — you are probably about to spend the user's money for nothing.
- **Sanity-check against rate history.** Meaningfully above the last price paid is worth flagging. Below it is worth pointing out as a win.
- **Say the tradeoff out loud.** "Sri Ganesh gets it there a day sooner for ₹8,300 more" lets the user overrule you on grounds you cannot see — a pour they know might slip, a relationship they are protecting. That is the point.

Recommend one. Give the reason in one sentence. Do not hide the alternatives.

## The money

Rates are quoted **excluding GST**. Construction materials are 28%.

Always present: subtotal, GST, total. The approver is agreeing to the total, so the total is the number that should be hardest to miss.

Compare vendors on **landed cost for the actual quantity**, not on the per-unit rate. A lower rate with a higher MOQ can cost more in total.

## What the approver needs to see

The approval card is the only thing some approvers read. It must carry:
- **Vendor** — full name
- **Material and quantity** with units and spec
- **Rate, GST, total** — total most prominent
- **Delivery date**, and what it is needed for
- **One line of justification** — why this vendor, not the others

Write the justification for someone who was not in the conversation. "Cheapest that meets the date; ₹7/bag above what we paid Acme in August" is useful. "Best option" is not.

## After the PO

Confirm what was issued, to whom, for how much, arriving when. Then offer the genuinely next thing: usually tracking the delivery, or dealing with whatever else was on the shortfall list. Do not invent follow-ups.`,
  },
];

export const SKILL_BY_NAME = Object.fromEntries(SKILLS.map((s) => [s.name, s]));

export const SKILL_INDEX = `<available_skills>
These skills hold detailed, authoritative instructions. When a request matches one, call \`load_skill\` with its name BEFORE doing the work — the skill body is the source of truth, and it overrides your general instincts about how to handle that situation.

${SKILLS.map((s) => `- **${s.name}**: ${s.description}`).join("\n")}
</available_skills>`;
