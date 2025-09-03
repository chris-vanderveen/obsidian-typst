import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { $ } from 'bun';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    type: {
      type: 'string', // 'mock', 'major', 'minor', 'patch'.
    },
  },
  allowPositionals: true,
});

const currentVersion = JSON.parse(
  readFileSync('manifest.json', 'utf8'),
).version;

if (values.type === 'mock') {
  await $`echo -n ${currentVersion}`;
  process.exit(0);
}

let [major, minor, patch] = currentVersion.split('.').map(Number);

switch (values.type) {
  case 'major':
    major++;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor++;
    patch = 0;
    break;
  case 'patch':
    patch++;
    break;
  default:
    throw new Error('Invalid type');
}

const newVersion = `${major}.${minor}.${patch}`;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;

manifest.version = newVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));

versions[newVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));

await $`echo -n ${newVersion}`;
