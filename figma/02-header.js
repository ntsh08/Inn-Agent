// STAGE 02 — page setup + Header bar component.
// <<PREPEND _helpers.js>>

let page = figma.root.children.find(p => p.name === 'INA Procure — Blocks');
if (!page) { page = figma.createPage(); page.name = 'INA Procure — Blocks'; }
await figma.setCurrentPageAsync(page);
page.backgrounds = [SOLID('#F7F8F8')];

// ---- Header bar -------------------------------------------------------------
// 48px tall, bottom rule border/soft, 720 content column, 24px side padding.
const bar = AL('VERTICAL', { name: 'Header bar', fill: C.bg });
const row = AL('HORIZONTAL', { name: 'row', pad: [0, 24, 0, 24], gap: 12, align: 'CENTER' });

// app mark: 19px accent rounded square
const mark = AL('HORIZONTAL', { name: 'mark', fill: C.accent, radius: 5, align: 'CENTER', justify: 'CENTER' });
const glyph = figma.createEllipse();
glyph.resize(9, 9);
glyph.fills = [];
glyph.strokes = [SOLID('#FFFFFF')];
glyph.strokeWeight = 2.2;
mark.appendChild(glyph);
mark.resize(19, 19);
mark.primaryAxisSizingMode = 'FIXED';
mark.counterAxisSizingMode = 'FIXED';

const title   = await T('INA Procure', { size: 13.5, weight: 'Medium', color: C.txt, lh: 1.3, name: 'title' });
const sep     = await T('·', { size: 12, color: C.txtFaint, lh: 1.3, name: 'sep' });
const project = await T('Forms HighRise Towers', { size: 12, color: C.txtFaint, lh: 1.3, name: 'project' });

// right cluster: usage meter + count + New
const right = AL('HORIZONTAL', { name: 'right', gap: 14, align: 'CENTER' });
const meter = AL('HORIZONTAL', { name: 'usage meter', gap: 8, align: 'CENTER' });

const track = AL('HORIZONTAL', { name: 'track', fill: C.line, radius: 999, clip: true });
track.resize(56, 3);
track.primaryAxisSizingMode = 'FIXED';
track.counterAxisSizingMode = 'FIXED';
const fillBar = DOT(3, C.accent, 999);
track.appendChild(fillBar);
fillBar.resize(11, 3);   // 28/3,000 ≈ 1% — shown at a legible minimum

const count = await T('28/3,000', { size: 11, color: C.txtFaint, lh: 1.3, name: 'count' });

const newBtn = AL('HORIZONTAL', { name: 'New button', stroke: C.line, radius: 5, pad: [3, 8, 3, 8], align: 'CENTER' });
newBtn.appendChild(await T('New', { size: 11.5, color: C.txtDim, lh: 1.3 }));

meter.appendChild(track); meter.appendChild(count);
right.appendChild(meter); right.appendChild(newBtn);

row.appendChild(mark); row.appendChild(title); row.appendChild(sep); row.appendChild(project);
row.appendChild(right);
right.layoutPositioning = 'AUTO';
row.primaryAxisAlignItems = 'SPACE_BETWEEN';

// title/sep/project must not be pushed apart by SPACE_BETWEEN — group them.
const left = AL('HORIZONTAL', { name: 'left', gap: 12, align: 'CENTER' });
left.appendChild(mark); left.appendChild(title); left.appendChild(sep); left.appendChild(project);
row.insertChild(0, left);

bar.appendChild(row);
row.layoutSizingHorizontal = 'FILL';
row.resize(row.width, 48);
row.counterAxisSizingMode = 'FIXED';
RULE(bar, C.lineSoft);

bar.resize(PAGE_W, bar.height);
bar.primaryAxisSizingMode = 'AUTO';
bar.counterAxisSizingMode = 'FIXED';

// Column-constrain the row to 720 inside the 1040 bar
row.maxWidth = COL + 48;
row.primaryAxisAlignItems = 'SPACE_BETWEEN';

const cmp = figma.createComponent();
cmp.name = 'Header bar';
cmp.resize(bar.width, bar.height);
cmp.layoutMode = 'VERTICAL';
cmp.appendChild(bar);
bar.layoutSizingHorizontal = 'FILL';
cmp.description = 'App chrome. 48px tall, content constrained to the 720px column. Usage meter is 56x3 track on border/default with an accent fill. New button only appears once a conversation has started.';
PLACE(cmp, 0, 0);

return { pageId: page.id, headerComponentId: cmp.id, createdNodeIds: [cmp.id] };
