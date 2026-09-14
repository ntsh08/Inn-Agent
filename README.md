# INA Procure — procurement agent prototype

A working procurement assistant for a construction project. Real model, real
tool-calling, staged data. Built to mirror the architecture of the Inncircles
INA agents so the patterns are recognisable side by side.

## The flow it's built around

1. **"What are we short on?"** — checks the plan against site stock, returns the shortfall
2. **"Sort out the cement"** — proposes a plan → user approves
3. Compares approved vendors, weighs rate against lead time and the need-by date
4. **Purchase order card** → user approves → PO issued

## Running it

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env.local
npm run dev
```

Open http://localhost:3000.

`MODEL` defaults to `gpt-5-mini`; override it in `.env.local`.

## How it's put together

| File | What it holds |
|---|---|
| `src/lib/prompt.ts` | System prompt, assembled from named blocks (scope, authority, rules, hygiene, planning) |
| `src/lib/tools.ts` | Tool registry. Descriptions teach the model; `requiresApproval` marks the gated ones |
| `src/lib/skills.ts` | Skill bodies, loaded on demand via `load_skill` rather than sitting in the prompt |
| `src/lib/cards.ts` | Turns a gated tool call into something a human can judge in five seconds |
| `src/lib/data.ts` | All staged records — materials, stock, vendors, quotes, rate history, POs |
| `src/app/api/chat/route.ts` | The tool loop and the approval gate |

### The approval gate

When the model calls a tool marked `requiresApproval`, the server **stops before
executing it** and sends the client a card. Nothing is written until a decision
comes back. Reads run freely; anything that commits money does not.

This is the one rule worth taking away: *the agent does the gathering, the human
does the committing.*

### What it refuses

Deliberate, and part of the point — an agent that will do anything reads as a toy.

- No payments, ever
- No adding or approving vendors
- No contacting vendors directly
- No contract or legal terms
- Nothing outside procurement — it names the sibling assistant instead

## Deploying

Push to a repo, import in Vercel, set `OPENAI_API_KEY` as an environment
variable. The key is only ever read inside the API route — it never reaches the
browser.

The endpoint rate-limits to 12 messages per IP per minute and caps conversation
length. Set a hard spend limit on the API key as a backstop before sharing the
link publicly.
