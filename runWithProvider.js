const dotenv = require('dotenv');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

dotenv.config();

const { DATABASE_PROVIDER } = process.env;
const databaseProviderDefault = DATABASE_PROVIDER ?? 'postgresql';

if (!DATABASE_PROVIDER) {
  console.warn(`DATABASE_PROVIDER is not set in the .env file, using default: ${databaseProviderDefault}`);
}

function getMigrationsFolder(provider) {
  switch (provider) {
    case 'psql_bouncer':
      return 'postgresql-migrations';
    default:
      return `${provider}-migrations`;
  }
}

function normalizePath(value) {
  return value.replace(/^['"]|['"]$/g, '').replace(/\\/g, '/');
}

function executeStep(step) {
  const trimmedStep = step.trim();

  if (!trimmedStep) {
    return;
  }

  const rmMatch = trimmedStep.match(/^rm\s+-rf\s+(.+)$/i);
  if (rmMatch) {
    const target = normalizePath(rmMatch[1]);
    const resolvedTarget = path.resolve(target);
    if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true });
    }
    return;
  }

  const cpMatch = trimmedStep.match(/^cp\s+-r\s+(.+?)\s+(.+)$/i);
  if (cpMatch) {
    const source = normalizePath(cpMatch[1]);
    const destination = normalizePath(cpMatch[2]);
    const resolvedSource = path.resolve(source);
    const resolvedDestination = path.resolve(destination);

    if (!fs.existsSync(resolvedSource)) {
      throw new Error(`Source path not found for copy command: ${source}`);
    }

    fs.rmSync(resolvedDestination, { recursive: true, force: true });
    fs.cpSync(resolvedSource, resolvedDestination, { recursive: true, force: true });
    return;
  }

  const rmdirMatch = trimmedStep.match(/^rmdir\s+(.*)$/i);
  if (rmdirMatch && rmdirMatch[1]) {
    const target = normalizePath(rmdirMatch[1]);
    const resolvedTarget = path.resolve(target);
    if (fs.existsSync(resolvedTarget)) {
      fs.rmSync(resolvedTarget, { recursive: true, force: true });
    }
    return;
  }

  execSync(trimmedStep, { stdio: 'inherit' });
}

const migrationsFolder = getMigrationsFolder(databaseProviderDefault);

let command = process.argv
  .slice(2)
  .join(' ')
  .replace(/DATABASE_PROVIDER/g, databaseProviderDefault);

const migrationsPattern = new RegExp(`${databaseProviderDefault}-migrations`, 'g');
command = command.replace(migrationsPattern, migrationsFolder);

const steps = command.split('&&').map((step) => step.trim()).filter(Boolean);

try {
  for (const step of steps) {
    executeStep(step);
  }
} catch (error) {
  console.error(`Error executing command: ${command}`);
  process.exit(1);
}