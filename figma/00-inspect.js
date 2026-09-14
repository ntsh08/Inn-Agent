// STAGE 00 — read-only. Run first. Confirms target node, fonts, existing conventions.
// Target: https://www.figma.com/design/kqO24W36v19LyhCkSP4pH5/Login-Screen?node-id=635-19563

const target = await figma.getNodeByIdAsync('635:19563');

const fonts = (await figma.listAvailableFontsAsync())
  .filter(f => f.fontName.family === 'Inter')
  .map(f => f.fontName.style);

const collections = (await figma.variables.getLocalVariableCollectionsAsync())
  .map(c => ({ name: c.name, id: c.id, modes: c.modes.map(m => m.name), vars: c.variableIds.length }));

return {
  targetFound: !!target,
  target: target ? { id: target.id, name: target.name, type: target.type,
                     page: target.parent && target.parent.type === 'PAGE' ? target.parent.name : null,
                     w: target.width, h: target.height, x: target.x, y: target.y } : null,
  pages: figma.root.children.map(p => ({ id: p.id, name: p.name, children: p.children.length })),
  interStyles: fonts,
  collections,
};
