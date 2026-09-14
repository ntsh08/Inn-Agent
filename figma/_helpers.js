// Prepend this block to every use_figma `code` payload.
// Each use_figma call is a fresh JS context, so helpers must be redeclared.

const HEX = (h) => ({
  r: parseInt(h.slice(1, 3), 16) / 255,
  g: parseInt(h.slice(3, 5), 16) / 255,
  b: parseInt(h.slice(5, 7), 16) / 255,
});
const SOLID = (h, o) => (o == null ? { type: 'SOLID', color: HEX(h) } : { type: 'SOLID', color: HEX(h), opacity: o });

const C = {
  bg:        '#FFFFFF',
  surface:   '#FBFCFC',
  raised:    '#F4F6F5',
  line:      '#E3E7E6',
  lineSoft:  '#EFF2F1',
  txt:       '#141A18',
  txtDim:    '#4D5454',
  txtFaint:  '#8A9190',
  accent:    '#128766',
  accentHov: '#0D6B52',
  accentSoft:'#E7F4EF',
  shell:     '#0E2B23',
  danger:    '#C8372D',
  warn:      '#A66A11',
  proseBody: '#333939',   // .prose-chat colour, sits between txt and txtDim
  tableHead: '#F7F9F8',
};

const TRACK = { unit: 'PERCENT', value: -1.1 };          // −0.011em, app-wide
const LH = (mult) => ({ unit: 'PERCENT', value: mult * 100 });

// Text node. Always: create -> load font -> set characters. Width handling:
// pass `w` to get a wrapping block (FIXED width + HEIGHT autoresize).
async function T(chars, opts = {}) {
  const {
    size = 12.5, weight = 'Regular', color = C.txtDim,
    lh = 1.45, track = TRACK, name, w, align,
  } = opts;
  const font = { family: 'Inter', style: weight };
  await figma.loadFontAsync(font);
  const t = figma.createText();
  t.fontName = font;
  t.fontSize = size;
  t.characters = chars;
  t.lineHeight = LH(lh);
  t.letterSpacing = track;
  t.fills = [SOLID(color)];
  if (name) t.name = name;
  if (align) t.textAlignHorizontal = align;
  if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, t.height); }
  else   { t.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  return t;
}

// Auto-layout frame with the props we reach for constantly.
function AL(dir, props = {}) {
  const { fill, stroke, strokeW = 1, radius, pad, gap, align, justify, name, clip } = props;
  const f = figma.createAutoLayout(dir);
  if (name) f.name = name;
  f.fills = fill ? [SOLID(fill)] : [];
  if (stroke) { f.strokes = [SOLID(stroke)]; f.strokeWeight = strokeW; f.strokeAlign = 'INSIDE'; }
  if (radius != null) f.cornerRadius = radius;
  if (gap != null) f.itemSpacing = gap;
  if (clip != null) f.clipsContent = clip;
  if (pad != null) {
    const p = Array.isArray(pad) ? pad : [pad, pad, pad, pad];  // [t,r,b,l]
    f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
  }
  if (align) f.counterAxisAlignItems = align;     // MIN | CENTER | MAX | BASELINE
  if (justify) f.primaryAxisAlignItems = justify; // MIN | CENTER | MAX | SPACE_BETWEEN
  return f;
}

// Solid dot / pill.
function DOT(d, color, radius) {
  const r = figma.createRectangle();
  r.resize(d, d);
  r.cornerRadius = radius == null ? d / 2 : radius;
  r.fills = [SOLID(color)];
  return r;
}

// 1px horizontal rule that fills its auto-layout parent.
function RULE(parent, color) {
  const r = figma.createRectangle();
  r.resize(100, 1);
  r.fills = [SOLID(color || C.lineSoft)];
  r.name = 'rule';
  parent.appendChild(r);
  r.layoutSizingHorizontal = 'FILL';
  r.layoutSizingVertical = 'FIXED';
  return r;
}

// Place a top-level node clear of existing content.
function PLACE(node, x, y) {
  figma.currentPage.appendChild(node);
  node.x = x; node.y = y;
}

const SHADOW_LIFT = [
  { type: 'DROP_SHADOW', color: { r: 16/255, g: 24/255, b: 20/255, a: 0.04 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 16/255, g: 24/255, b: 20/255, a: 0.06 }, offset: { x: 0, y: 4 }, radius: 16, spread: 0, visible: true, blendMode: 'NORMAL' },
];
const SHADOW_INPUT = [
  { type: 'DROP_SHADOW', color: { r: 16/255, g: 24/255, b: 20/255, a: 0.04 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0, visible: true, blendMode: 'NORMAL' },
  { type: 'DROP_SHADOW', color: { r: 16/255, g: 24/255, b: 20/255, a: 0.06 }, offset: { x: 0, y: 6 }, radius: 20, spread: 0, visible: true, blendMode: 'NORMAL' },
];

const COL = 720;      // content column
const PAGE_W = 1040;  // screen frame width
