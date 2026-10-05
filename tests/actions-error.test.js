'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');

const { extractFailure, summarizeRunLogs, clipText } = require('../server/actions-error');

const JAVA_LOG = [
  '2026-10-05T00:00:00.1234567Z downloading https://repo.maven.apache.org/maven2/gradle.zip',
  '2026-10-05T00:00:01.0000000Z > Task :app:compileDebugJavaWithJavac FAILED',
  '2026-10-05T00:00:02.0000000Z /home/runner/work/x/app/src/main/java/com/x/MainActivity.java:42: error: cannot find symbol',
  '2026-10-05T00:00:02.0000000Z         unresolvedCall();',
  '2026-10-05T00:00:02.0000000Z         ^',
  '2026-10-05T00:00:02.0000000Z   symbol:   method unresolvedCall()',
  '2026-10-05T00:00:02.0000000Z   location: class MainActivity',
  '2026-10-05T00:00:02.0000000Z 1 error',
  '2026-10-05T00:00:03.0000000Z * What went wrong:',
  '2026-10-05T00:00:03.0000000Z Execution failed for task \':app:compileDebugJavaWithJavac\'.',
  '2026-10-05T00:00:03.0000000Z > Compilation failed; see the compiler error output for details.',
  '2026-10-05T00:00:04.0000000Z BUILD FAILED in 1m',
  '2026-10-05T00:00:05.0000000Z Cleaning up runner'
].join('\n');

test('actions-error: extrae el motivo real de un fallo de compilacion Java', () => {
  const out = extractFailure(JAVA_LOG);
  assert.ok(out, 'hay salida');
  assert.match(out, /cannot find symbol/);
  assert.match(out, /MainActivity\.java:42/);
  assert.match(out, /What went wrong:/);
  assert.match(out, /Compilation failed/);
  assert.ok(!out.includes('repo.maven.apache.org'), 'sin ruido de descargas');
  assert.ok(!out.includes('Cleaning up runner'), 'sin ruido de limpieza');
});

test('actions-error: elimina secuencias ANSI', () => {
  const raw = '\u001b[31merror:\u001b[0m no puede encontrar simbolo\n\u001b[32mBUILD FAILED\u001b[0m';
  const out = extractFailure(raw);
  assert.ok(out, 'hay salida');
  assert.ok(!out.includes('\u001b'), 'sin secuencias de escape');
  assert.match(out, /error: no puede encontrar simbolo/);
});

test('actions-error: texto sin errores devuelve null', () => {
  assert.equal(extractFailure('Downloading dependencies\nGradle executo 42 tareas\nBUILD SUCCESSFUL in 3m'), null);
  assert.equal(extractFailure(''), null);
  assert.equal(extractFailure('   \n  \n'), null);
  assert.equal(extractFailure(null), null);
});

test('actions-error: respeta el limite de lineas y anade el contador', () => {
  const many = Array.from({ length: 60 }, (_, i) => 'error: fallo numero ' + i).join('\n');
  const out = extractFailure(many, 10);
  const lines = out.split('\n');
  assert.equal(lines.length, 11);
  assert.equal(lines[10], '... (50 líneas más)');
  assert.match(out, /error: fallo numero 9/);
  assert.ok(!out.includes('error: fallo numero 10'), 'fuera del limite');
});

test('actions-error: respeta el limite de caracteres por defecto', () => {
  const long = Array.from({ length: 400 }, (_, i) => 'error: ' + 'x'.repeat(40) + i).join('\n');
  const out = extractFailure(long, 1000);
  assert.ok(out.length <= 4100, 'longitud ' + out.length);
  assert.match(out, /\.\.\. \(\d+ líneas más\)$/);
});

test('actions-error: elimina lineas repetidas', () => {
  const raw = ['error: simbolo no encontrado', 'error: simbolo no encontrado', 'error: simbolo no encontrado', 'FAILURE: Build failed with an exception.'].join('\n');
  const out = extractFailure(raw);
  assert.equal(out.split('\n').filter((l) => l.includes('simbolo no encontrado')).length, 1);
  assert.match(out, /FAILURE: Build failed/);
});

test('actions-error: conserva las lineas de contexto tras un fallo', () => {
  const out = extractFailure(JAVA_LOG);
  assert.match(out, /symbol:   method unresolvedCall/);
});

test('actions-error: summarizeRunLogs concatena los logs de los jobs en orden', async () => {
  const zip = new JSZip();
  zip.file('1_Build apk/1_Set up job.txt', 'Set up job ok\nCleanup complete');
  zip.file('1_Build apk/2_Build with Gradle.txt', JAVA_LOG);
  zip.file('2_Sign/1_Sign apk.txt', 'error: keystore no encontrado\n1 error');
  const out = await summarizeRunLogs(zip);
  assert.ok(out, 'hay resumen');
  assert.match(out, /1_Build apk > 2_Build with Gradle/);
  assert.match(out, /2_Sign > 1_Sign apk/);
  assert.match(out, /cannot find symbol/);
  assert.match(out, /keystore no encontrado/);
  assert.ok(!out.includes('Set up job ok'), 'ignora logs sin fallo');
});

test('actions-error: summarizeRunLogs devuelve null sin logs o sin fallos', async () => {
  assert.equal(await summarizeRunLogs(null), null);
  assert.equal(await summarizeRunLogs({}), null);
  assert.equal(await summarizeRunLogs('Gradle ejecuto tareas sin errores'), null);
  const zip = new JSZip();
  zip.file('1_job/1_step.txt', 'todo correcto\nBUILD SUCCESSFUL in 2m');
  assert.equal(await summarizeRunLogs(zip), null);
});

test('actions-error: clipText recorta solo cuando hace falta', () => {
  assert.equal(clipText('corto'), 'corto');
  assert.equal(clipText('x'.repeat(10), 5), 'xxxxx...');
  assert.equal(clipText(null, 5), '');
  assert.equal(clipText('x'.repeat(3000)).length, 2003);
});
