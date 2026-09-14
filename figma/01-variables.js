// STAGE 01 — colour variables. Collection "INA Procure", single "Light" mode.
// Scopes are set explicitly (rule 16): fills vs text fills vs strokes.
// <<PREPEND _helpers.js>>

const existing = (await figma.variables.getLocalVariableCollectionsAsync())
  .find(c => c.name === 'INA Procure');
const col = existing || figma.variables.createVariableCollection('INA Procure');

const SPEC = [
  ['bg/default',    C.bg,         ['FRAME_FILL', 'SHAPE_FILL']],
  ['bg/surface',    C.surface,    ['FRAME_FILL', 'SHAPE_FILL']],
  ['bg/raised',     C.raised,     ['FRAME_FILL', 'SHAPE_FILL']],
  ['border/default',C.line,       ['STROKE_COLOR', 'SHAPE_FILL']],
  ['border/soft',   C.lineSoft,   ['STROKE_COLOR', 'SHAPE_FILL']],
  ['txt/default',   C.txt,        ['TEXT_FILL']],
  ['txt/dim',       C.txtDim,     ['TEXT_FILL']],
  ['txt/faint',     C.txtFaint,   ['TEXT_FILL']],
  ['accent',        C.accent,     ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL']],
  ['accent/hover',  C.accentHov,  ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL']],
  ['accent/soft',   C.accentSoft, ['FRAME_FILL', 'SHAPE_FILL']],
  ['shell',         C.shell,      ['FRAME_FILL', 'SHAPE_FILL']],
  ['danger',        C.danger,     ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL']],
  ['warn',          C.warn,       ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL']],
];

const mode = col.modes[0].modeId;
const all = await figma.variables.getLocalVariablesAsync('COLOR');
const created = [];

for (const [name, hex, scopes] of SPEC) {
  let v = all.find(x => x.variableCollectionId === col.id && x.name === name);
  if (!v) { v = figma.variables.createVariable(name, col, 'COLOR'); created.push(name); }
  v.setValueForMode(mode, HEX(hex));
  v.scopes = scopes;
}

return { collectionId: col.id, modeId: mode, created, total: SPEC.length };
