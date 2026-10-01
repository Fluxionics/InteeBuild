'use strict';






const TEMPLATES = Object.assign({},
  require('./core'),
  require('./media'),
  require('./commerce'),
  require('./location'),
  require('./social'),
  require('./wellness'),
  require('./secure')
);

const { attachFaces } = require('./faces');
attachFaces(TEMPLATES);

function getTemplate(id) {
  return TEMPLATES[String(id || '').toLowerCase()] || null;
}

function listTemplates() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, description: t.description, hasFace: !!t.faceHtml }));
}



function applyTemplate(raw, templateId) {
  const t = getTemplate(templateId);
  if (!t) return raw;
  const base = t.config || {};
  return {
    ...base,
    ...(raw || {}),
    permissions: { ...(base.permissions || {}), ...((raw || {}).permissions || {}) },
    plugins: { ...(base.plugins || {}), ...((raw || {}).plugins || {}) }
  };
}

module.exports = { TEMPLATES, getTemplate, listTemplates, applyTemplate };
