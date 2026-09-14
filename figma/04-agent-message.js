// STAGE 04 — Agent message: plain prose, and the table variant.
// No container — the text sits directly on the page. That is the point.
// <<PREPEND _helpers.js>>
const page = figma.root.children.find(p => p.name === 'INA Procure — Blocks');
await figma.setCurrentPageAsync(page);
const ids = [];

// ---- 4a. Agent message, plain ----------------------------------------------
const a = AL('VERTICAL', { name: 'Agent message', gap: 11 });
a.appendChild(await T(
  'Cement is the one that bites. You need 800 bags for the Level 4 slab pour on 18 Sep and there are 160 on site, so the shortfall is 640 bags.',
  { size: 14, color: C.proseBody, lh: 1.68, w: COL }));
a.appendChild(await T(
  'Three approved vendors quote it. Deccan is cheapest at ₹372 but needs eight days, which lands after the pour. Acme at ₹395 delivers in three.',
  { size: 14, color: C.proseBody, lh: 1.68, w: COL }));
a.resize(COL, a.height);
a.primaryAxisSizingMode = 'AUTO'; a.counterAxisSizingMode = 'FIXED';
const aCmp = figma.createComponent();
aCmp.name = 'Agent message';
aCmp.layoutMode = 'VERTICAL';
aCmp.resize(COL, a.height);
aCmp.appendChild(a);
a.layoutSizingHorizontal = 'FILL';
aCmp.description = 'Agent prose. 14px / 1.68 on the page ground with no bubble — the agent is the page, the person is the bubble.';
PLACE(aCmp, 0, 420);
ids.push(aCmp.id);

// ---- 4b. Agent message, table variant --------------------------------------
// Wrapper: 1px border/default, r8, clipped (horizontally scrollable in the app).
const COLS = [
  ['VENDOR',   ['Acme Building Materials', 'Deccan Cements Ltd', 'Sri Ganesh Traders']],
  ['RATE',     ['₹395', '₹372', '₹408']],
  ['LEAD',     ['3 days', '8 days', '2 days']],
  ['ON TIME',  ['94%', '81%', '97%']],
];
const W = [252, 96, 96, 96];

const table = AL('VERTICAL', { name: 'Table', stroke: C.line, radius: 8, clip: true });
const head = AL('HORIZONTAL', { name: 'thead', fill: C.tableHead });
for (let i = 0; i < COLS.length; i++) {
  const cell = AL('HORIZONTAL', { name: 'th', pad: [8, 11.5, 8, 11.5] });
  const t = await T(COLS[i][0], { size: 10.5, weight: 'Medium', color: C.txtFaint, lh: 1.3,
                                  track: { unit: 'PERCENT', value: 6 } });
  cell.appendChild(t);
  head.appendChild(cell);
  cell.resize(W[i], cell.height);
  cell.primaryAxisSizingMode = 'FIXED';
}
table.appendChild(head);
head.layoutSizingHorizontal = 'HUG';

for (let r = 0; r < 3; r++) {
  const tr = AL('HORIZONTAL', { name: 'tr' });
  for (let i = 0; i < COLS.length; i++) {
    const cell = AL('HORIZONTAL', { name: 'td', pad: [8, 11.5, 8, 11.5] });
    cell.appendChild(await T(COLS[i][1][r], { size: 12.5, color: C.proseBody, lh: 1.4 }));
    tr.appendChild(cell);
    cell.resize(W[i], cell.height);
    cell.primaryAxisSizingMode = 'FIXED';
  }
  table.appendChild(tr);
  if (r < 2) RULE(table, C.lineSoft);   // last row keeps no rule, matching the CSS
}

const tWrap = AL('VERTICAL', { name: 'Agent message / table', gap: 11 });
tWrap.appendChild(await T('Here is how the three compare on the 640 bags:',
  { size: 14, color: C.proseBody, lh: 1.68, w: COL }));
tWrap.appendChild(table);
tWrap.resize(COL, tWrap.height);
tWrap.counterAxisSizingMode = 'FIXED';
const tCmp = figma.createComponent();
tCmp.name = 'Agent message / table';
tCmp.layoutMode = 'VERTICAL';
tCmp.resize(COL, tWrap.height);
tCmp.appendChild(tWrap);
tWrap.layoutSizingHorizontal = 'FILL';
tCmp.description = 'Table inside agent prose. Header 10.5 uppercase txt/faint at +0.06em on #F7F9F8; cells 12.5; border/soft row rules; the whole table boxed in border/default at r8 and clipped so wide tables scroll without moving the page.';
PLACE(tCmp, 0, 560);
ids.push(tCmp.id);

return { createdNodeIds: ids };
