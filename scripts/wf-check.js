const path = require('path');
const ROOT = path.join(__dirname, '..');
const yaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));
const wf = require(path.join(ROOT, 'server', 'generator', 'workflow.js'));

const doc = yaml.load(wf.WORKFLOW_YML);
if (!doc || !doc.jobs) throw new Error('YAML del workflow principal invalido');
const steps = doc.jobs && Object.values(doc.jobs)[0].steps;
const read = steps.find(s => s.name === 'Read build config');
const run = read && read.run || '';
const ok = [
  'node -p \'require("./build-config.json").compileSdk\'',
  'node -p \'require("./build-config.json").targetSdk\'',
  'node -p \'require("./build-config.json").minSdk\''
].every(s => run.includes(s));
console.log('YAML principal OK; lineas SDK arregladas:', ok);
if (!ok) process.exit(1);

const d2 = yaml.load(wf.DECOMPILE_WORKFLOW_YML);
console.log('YAML decompila OK:', !!(d2 && d2.jobs));
if (!d2 || !d2.jobs) process.exit(1);

const cfg = require(path.join(ROOT, 'server', 'generator', 'config.js'));
const files = require(path.join(ROOT, 'server', 'generator', 'package-files.js'));
const norm = cfg.normalizeConfig({ appName: 'Test App', url: 'https://x.com', inputType: 'url', provider: 'native' });
const pack = files.packageFiles ? files.packageFiles(norm) : null;
if (!pack) { console.log('packageFiles no exportado, revisando buildConfig via ZIP e2e despues'); process.exit(0); }
const bc = JSON.parse(pack['build-config.json']);
console.log('build-config provider:', bc.provider, '| compileSdk:', bc.compileSdk, 'targetSdk:', bc.targetSdk, 'minSdk:', bc.minSdk);
if (bc.provider !== 'native') { console.log('FAIL: provider ausente en build-config.json'); process.exit(1); }
console.log('TODO OK');
