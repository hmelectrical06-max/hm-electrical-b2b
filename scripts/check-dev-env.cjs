'use strict';

const path = require('node:path');
const envFile = path.resolve(__dirname, '..', '.env');

try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Could not load the project-root .env file. Check its syntax; values were not displayed.');
    process.exitCode = 1;
  }
}

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_USER_IDS',
  'SITE_ORIGIN',
  'RATE_LIMIT_SECRET'
];
const optional = ['HM_EMAIL_PROVIDER_TOKEN', 'EMAIL_FROM'];
const missing = required.filter(name => !process.env[name]);
const missingOptional = optional.filter(name => !process.env[name]);

if (missing.length) {
  console.error('Missing local function configuration (variable names only):');
  for (const name of missing) console.error(`- ${name}`);
  console.error('Copy .env.example to .env and configure values locally. No values were read or printed.');
  process.exitCode = 1;
} else {
  console.log('Required local function variable names are present. Values were not displayed.');
}

if (missingOptional.length) {
  console.log(`Scheduled email notifications are not configured; missing: ${missingOptional.join(', ')}`);
}
