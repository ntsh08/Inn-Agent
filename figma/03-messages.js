// STAGE 03 — User message, Agent message (plain + table variant), Tool chip (running/done).
// <<PREPEND _helpers.js>>
const page = figma.root.children.find(p => p.name === 'INA Procure — Blocks');
await figma.setCurrentPageAsync(page);
const ids = [];

// ---- 3. User message --------------------------------------------------------
// Right-aligned, max 80% of the column, bg/raised, 1px border/soft, r10, pad 14/8.
const uWrap = AL('HORIZONTAL', { name: 'User message', justify: 'MAX' });
const uBub  = AL('HORIZONTAL', { name: 'bubble', fill: C.raised, stroke: C.lineSoft, radius: 10, pad: [8, 14, 8, 14] });
uBub.appendChild(await T('Sort out the cement shortfall before the Level 4 pour', {
  size: 13.5, color: C.txt, lh: 1.6, w: COL * 0.8 - 28 }));
uWrap.appendChild(uBub);
uWrap.resize(COL, uWrap.height);
uWrap.primaryAxisSizingMode = 'FIXED';
const uCmp = figma.createComponent();
uCmp.name = 'User message';
uCmp.layoutMode = 'VERTICAL';
uCmp.resize(COL, uWrap.height);
uCmp.appendChild(uWrap);
uWrap.layoutSizingHorizontal = 'FILL';
uCmp.description = 'What the person typed. Right-aligned, never wider than 80% of the column. The only message kind that gets a container.';
PLACE(uCmp, 0, 140);
ids.push(uCmp.id);

// ---- 5. Tool chip -----------------------------------------------------------
// running: accent dot + ping halo, txt/dim label. done: faint dot, txt/faint label.
async function chip(label, done) {
  const c = AL('HORIZONTAL', { name: done ? 'Tool chip / done' : 'Tool chip / running', gap: 8, align: 'CENTER' });
  const slot = AL('HORIZONTAL', { name: 'dot', align: 'CENTER', justify: 'CENTER' });
  slot.resize(6, 6); slot.primaryAxisSizingMode = 'FIXED'; slot.counterAxisSizingMode = 'FIXED';
  if (!done) { const halo = DOT(6, C.accent); halo.opacity = 0.6; slot.appendChild(halo); }
  const d = DOT(6, done ? C.txtFaint : C.accent);
  slot.appendChild(d);
  if (!done) { d.layoutPositioning = 'ABSOLUTE'; d.x = 0; d.y = 0; }
  c.appendChild(slot);
  c.appendChild(await T(label, { size: 12, color: done ? C.txtFaint : C.txtDim, lh: 1.4 }));
  return c;
}
const chipRun  = await chip('Checking stock for Cement (OPC 53)', false);
const chipDone = await chip('Checking stock for Cement (OPC 53)', true);
// combineAsVariants needs COMPONENT nodes, so wrap each state first.
function toComponent(node, name) {
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode = node.layoutMode;
  c.itemSpacing = node.itemSpacing;
  c.counterAxisAlignItems = node.counterAxisAlignItems;
  c.resize(node.width, node.height);
  while (node.children.length) c.appendChild(node.children[0]);
  node.remove();
  c.layoutSizingHorizontal = 'HUG'; c.layoutSizingVertical = 'HUG';
  return c;
}
const cRun  = toComponent(chipRun,  'State=Running');
const cDone = toComponent(chipDone, 'State=Done');
PLACE(cRun, 0, 260); PLACE(cDone, 0, 290);
const set = figma.combineAsVariants([cRun, cDone], page);
set.name = 'Tool chip';
set.layoutMode = 'VERTICAL'; set.itemSpacing = 12; set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 16;
set.description = 'One chip per tool call, one per line, appearing as work happens. The dot pings in accent while running, then goes faint and the label drops to txt/faint when done.';
PLACE(set, 0, 260);
ids.push(set.id);

return { createdNodeIds: ids, chipSetId: set.id, userMessageId: uCmp.id };
