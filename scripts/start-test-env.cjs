'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, '.env.test');
const inheritedEnvNames = [
  'PATH',
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'HOMEDRIVE',
  'HOMEPATH',
  'USERNAME',
  'COMSPEC',
  'PATHEXT',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS'
];
const runtimeEnvNames = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_USER_IDS',
  'SITE_ORIGIN',
  'RATE_LIMIT_SECRET',
  'HM_EMAIL_PROVIDER_TOKEN',
  'EMAIL_FROM'
];
const required = [
  'HM_TEST_SUPABASE_PROJECT_REF',
  ...runtimeEnvNames.slice(0, 6)
];

function validateTestEnvironment(values) {
  const missing = required.filter(name => !values[name]?.trim());
  if (missing.length) {
    return { error: `Missing TEST configuration variable names: ${missing.join(', ')}` };
  }

  if (values.HM_EMAIL_PROVIDER_TOKEN?.trim() || values.EMAIL_FROM?.trim()) {
    return { error: 'Email variables must be blank in .env.test; local email is disabled.' };
  }

  const projectRef = values.HM_TEST_SUPABASE_PROJECT_REF.trim();
  if (!/^[a-z0-9-]{1,63}$/.test(projectRef)) {
    return { error: 'HM_TEST_SUPABASE_PROJECT_REF must be the TEST project reference.' };
  }

  let endpoint;
  try {
    endpoint = new URL(values.SUPABASE_URL);
  } catch {
    return { error: 'SUPABASE_URL in .env.test is not a valid URL.' };
  }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== `${projectRef}.supabase.co`
    || endpoint.pathname !== '/' || endpoint.search || endpoint.hash
    || endpoint.username || endpoint.password) {
    return { error: 'SUPABASE_URL does not match the explicit TEST project reference.' };
  }

  if (values.SITE_ORIGIN !== 'http://localhost:8888') {
    return { error: 'SITE_ORIGIN in .env.test must be http://localhost:8888.' };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\s*,\s*[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})*$/i.test(values.ADMIN_USER_IDS.trim())) {
    return { error: 'ADMIN_USER_IDS in .env.test must contain TEST-project admin user IDs.' };
  }
  if (values.RATE_LIMIT_SECRET.length < 32) {
    return { error: 'RATE_LIMIT_SECRET in .env.test must contain at least 32 characters.' };
  }
  return { projectRef };
}

function createNetlifyEnvironment(values, inherited = process.env) {
  const childEnv = {};
  for (const name of inheritedEnvNames) {
    if (inherited[name]) childEnv[name] = inherited[name];
  }
  for (const name of runtimeEnvNames) {
    childEnv[name] = values[name] || '';
  }
  childEnv.HM_EMAIL_PROVIDER_TOKEN = '';
  childEnv.EMAIL_FROM = '';
  childEnv.HM_SITE_MODE = 'staging';
  childEnv.NETLIFY_DISABLE_TELEMETRY = 'true';
  return childEnv;
}

function buildTestSite(root, values) {
  const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-electrical-test-'));
  try {
    fs.cpSync(path.join(root, 'public'), path.join(buildRoot, 'public'), { recursive: true });
    const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-site.cjs')], {
      cwd: buildRoot,
      env: createNetlifyEnvironment(values),
      stdio: 'inherit'
    });
    if (build.status !== 0) {
      throw new Error('The isolated TEST site build failed.');
    }
    return buildRoot;
  } catch (error) {
    fs.rmSync(buildRoot, { recursive: true, force: true });
    throw error;
  }
}

function run() {
  if (!fs.existsSync(configPath)) {
    console.error('Create .env.test from env.test.example and configure it with TEST-project values. No values were displayed.');
    process.exitCode = 1;
    return;
  }

  let values;
  try {
    values = parseEnv(fs.readFileSync(configPath, 'utf8'));
  } catch {
    console.error('.env.test could not be parsed. Check its syntax; values were not displayed.');
    process.exitCode = 1;
    return;
  }

  const validation = validateTestEnvironment(values);
  if (validation.error) {
    console.error(validation.error);
    process.exitCode = 1;
    return;
  }

  const build = spawnSync(process.execPath, ['scripts/check.cjs'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (build.status !== 0) {
    process.exitCode = build.status || 1;
    return;
  }
  let testBuildRoot;
  try {
    testBuildRoot = buildTestSite(root, values);
  } catch (error) {
    console.error(`Could not prepare the isolated TEST site: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const childEnv = createNetlifyEnvironment(values);
  console.log('TEST endpoint matched its explicit project reference. Secret values are withheld; email is disabled.');

  const netlifyCli = path.join(root, 'node_modules', 'netlify-cli', 'bin', 'run.js');
  const child = spawn(process.execPath, [
    netlifyCli,
    'dev',
    '--offline',
    '--port',
    '8888',
    '--dir',
    path.join(testBuildRoot, 'dist'),
    '--functions',
    path.join(root, 'netlify', 'functions')
  ], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit'
  });
  child.on('error', error => {
    fs.rmSync(testBuildRoot, { recursive: true, force: true });
    console.error(`Could not start Netlify Dev: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    fs.rmSync(testBuildRoot, { recursive: true, force: true });
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (require.main === module) run();

module.exports = { validateTestEnvironment, createNetlifyEnvironment, buildTestSite };
