# INA Procure — design spec

Values pulled from the built app (`tailwind.config.ts`, `src/app/globals.css`,
`src/components/`). Use this to set up Figma variables and build the blocks.

Font is **Inter** throughout, letter-spacing **−0.011em**. Content column is
**720px**, centred. Header is **48px** tall.

## Colour variables

| Variable | Hex | Used for |
|---|---|---|
| `bg/default` | `#FFFFFF` | page ground |
| `bg/surface` | `#FBFCFC` | cards, composer |
| `bg/raised` | `#F4F6F5` | user message, card footer, disabled button |
| `border/default` | `#E3E7E6` | card and input borders |
| `border/soft` | `#EFF2F1` | dividers inside cards, header rule |
| `txt/default` | `#141A18` | headings, values |
| `txt/dim` | `#4D5454` | body copy, plan steps |
| `txt/faint` | `#8A9190` | labels, meta, placeholder |
| `accent` | `#128766` | primary button, active dot, progress |
| `accent/hover` | `#0D6B52` | primary button hover, links |
| `accent/soft` | `#E7F4EF` | PLAN tag background |
| `shell` | `#0E2B23` | app mark |
| `danger` | `#C8372D` | warnings on the PO card |
| `warn` | `#A66A11` | PURCHASE ORDER tag |

## Type scale

| Size | Weight | Used for |
|---|---|---|
| 22 | 500 | empty-state title |
| 21 | 500 | PO total (tabular figures) |
| 15 | 500 | vendor name |
| 14 | 400 | agent body copy, composer input |
| 13.5 | 400 | user message, header title |
| 13 | 400 | plan step |
| 12.5 | 400/500 | card values, buttons, suggestion chips |
| 12 | 400 | tool chip |
| 11.5 | 400 | card row label |
| 11 | 400 | meta, footer note |
| 10 | 500 | tag — uppercase, tracking +0.07em |

Table inside an agent message: header 10.5 uppercase `txt/faint` tracking
+0.06em; cells 12.5 `txt/dim`; 1px `border/soft` row rules; whole table wrapped
in a 1px `border/default` box at radius 8, horizontally scrollable.

## Radii & spacing

Cards `10` · suggestion chips `7` · table wrapper `8` · buttons `6` ·
step numerals `999` · tags `4`.

Card padding 16. Gap between transcript items 20. Card row height 9px
vertical padding with a `border/soft` rule between.

## Blocks to build

1. **Header bar** — 19px accent mark, "INA Procure", dot, project name; right: usage meter (56×3px track, `border/default` ground, `accent` fill) + count + New button
2. **Empty state** — title, 420px description, suggestion chips (wrap), rule, "OUT OF SCOPE" label + note
3. **User message** — right-aligned, max 80%, `bg/raised`, 1px `border/soft`, radius 10, padding 14/8
4. **Agent message** — no container; text sits on the page. Include the table variant
5. **Tool chip** — 6px dot + label. Two states: *running* (accent dot with ping halo, `txt/dim` label) and *done* (faint dot, `txt/faint` label)
6. **Plan card** — PLAN tag, title, numbered steps (17px ringed numerals), footer action row
7. **PO card** — PURCHASE ORDER tag, vendor + rating line, total block right-aligned, 7 detail rows, justification with 2px left rule, optional danger warning, footer action row
8. **Composer** — auto-growing textarea, "↵ to send" hint with keycap, 24px accent send button. States: idle, focused (`accent` at 40% border), disabled
9. **Full screen** — header + transcript with plan and PO cards + composer
10. **Empty screen** — header + empty state + composer

Footer action row on both cards: primary button, ghost Reject, and
right-aligned `txt/faint` 11px microcopy "Nothing is sent until you approve".
Once decided it collapses to a dot + "Approved" / "Rejected".

## Behaviour worth annotating in the file

- Reads run without asking. Anything that commits money stops and shows a card.
- Tool chips appear one per line as work happens, then dim when done.
- The PO total is the largest element on the card — it is what is being agreed to.
