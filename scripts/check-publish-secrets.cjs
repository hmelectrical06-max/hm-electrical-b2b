'use strict';

const fs = require('node:fs');
const path = require('node:path');

const sensitiveEnvironmentVariables = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'HM_EMAIL_PROVIDER_TOKEN',
  'RATE_LIMIT_SECRET'
];

module.exports = function checkPublishSecrets(publishDirectory) {
  for (const name of sensitiveEnvironmentVariables) {
    const value = process.env[name];
    if (!value || value.length < 8) continue;

    const secret = Buffer.from(value);
    const inspect = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          inspect(file);
        } else if (fs.readFileSync(file).includes(secret)) {
          throw new Error(`Sensitive environment variable ${name} appears in publish output: ${path.relative(publishDirectory, file)}`);
        }
      }
    };

    inspect(publishDirectory);
  }
};
