'use strict';

const path = require('path');

const generator = require('./generator');
const decompiler = require('./decompile');
const gh = require('./github');
const templates = require('./templates');
const packageJson = require('../package.json');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'builds.json');
const APIKEYS_FILE = path.join(DATA_DIR, 'apikeys.json');
const GIT_FILE = path.join(DATA_DIR, 'git-integrations.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');


function configFromBody(body) {
  const data = body || {};
  return generator.normalizeConfig(templates.applyTemplate(data, data.template));
}

module.exports = {
  gh,
  generator,
  decompiler,
  templates,
  packageJson,
  VERSION: packageJson.version,
  ROOT,
  DATA_DIR,
  HISTORY_FILE,
  APIKEYS_FILE,
  GIT_FILE,
  VERSIONS_FILE,
  configFromBody
};
