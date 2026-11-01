'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  validateTestEnvironment,
  createNetlifyEnvironment,
  buildTestSite
} = require('../scripts/start-test-env.cjs');

const projectRef = 'hm-electrical-test';
const validConfig = {
  HM_TEST_SUPABASE_PROJECT_REF: projectRef,
  SUPABASE_URL: `https://${projectRef}.supabase.co`,
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ADMIN_USER_IDS: '00000000-0000-4000-8000-000000000099',
  SITE_ORIGIN: 'http://localhost:8888',
  RATE_LIMIT_SECRET: 'test-only-local-rate-limit-secret-32-chars',
  HM_EMAIL_PROVIDER_TOKEN: '',
  EMAIL_FROM: ''
};

test('TEST runner accepts a matching isolated project configuration', () => {
  assert.deepEqual(validateTestEnvironment(validConfig), { projectRef });
});

test('TEST runner refuses a Supabase URL that does not match the explicit TEST ref', () => {
  const result = validateTestEnvironment({
    ...validConfig,
    SUPABASE_URL: 'https://production-project.supabase.co'
  });
  assert.match(result.error, /does not match/);
});

test('TEST runner refuses non-local origin and enabled email settings', () => {
  assert.match(validateTestEnvironment({
    ...validConfig,
    SITE_ORIGIN: 'https://example.com'
  }).error, /SITE_ORIGIN/);
  assert.match(validateTestEnvironment({
    ...validConfig,
    HM_EMAIL_PROVIDER_TOKEN: 'configured'
  }).error, /Email variables must be blank/);
});

test('Netlify TEST process receives TEST settings without inherited production credentials', () => {
  const inherited = {
    PATH: 'C:\\Windows\\System32',
    SystemRoot: 'C:\\Windows',
    SUPABASE_URL: 'https://production-project.supabase.co',
    SUPABASE_ANON_KEY: 'production-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'production-service-key',
    NETLIFY_AUTH_TOKEN: 'production-netlify-token',
    HM_EMAIL_PROVIDER_TOKEN: 'production-email-key',
    HM_SITE_MODE: 'production',
    HM_LAUNCH_APPROVED: 'true'
  };
  const child = createNetlifyEnvironment(validConfig, inherited);

  assert.equal(child.SUPABASE_URL, validConfig.SUPABASE_URL);
  assert.equal(child.SUPABASE_ANON_KEY, validConfig.SUPABASE_ANON_KEY);
  assert.equal(child.SUPABASE_SERVICE_ROLE_KEY, validConfig.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(child.NETLIFY_AUTH_TOKEN, undefined);
  assert.equal(child.HM_EMAIL_PROVIDER_TOKEN, '');
  assert.equal(child.EMAIL_FROM, '');
  assert.equal(child.HM_SITE_MODE, 'staging');
  assert.equal(child.HM_LAUNCH_APPROVED, undefined);
  assert.equal(child.NETLIFY, undefined);
  assert.equal(child.PATH, inherited.PATH);
  assert.equal(child.SystemRoot, inherited.SystemRoot);
});

test('TEST site build uses a temporary publish directory and emits private staging robots', () => {
  const root = path.resolve(__dirname, '..');
  const existingDist = path.join(root, 'dist');
  const existingIndex = fs.existsSync(path.join(existingDist, 'index.html'))
    ? fs.readFileSync(path.join(existingDist, 'index.html'))
    : null;
  const buildRoot = buildTestSite(root, validConfig);

  try {
    assert.ok(buildRoot.startsWith(os.tmpdir()));
    assert.ok(fs.existsSync(path.join(buildRoot, 'dist', 'index.html')));
    assert.match(fs.readFileSync(path.join(buildRoot, 'dist', 'robots.txt'), 'utf8'), /Disallow: \//);
    if (existingIndex) {
      assert.deepEqual(fs.readFileSync(path.join(existingDist, 'index.html')), existingIndex);
    }
  } finally {
    fs.rmSync(buildRoot, { recursive: true, force: true });
  }
});
