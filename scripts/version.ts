import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { $ } from 'bun';

// コマンドライン引数の解析
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    type: {
      type: 'string', // 'mock', 'major', 'minor', 'patch'.
    },
  },
  allowPositionals: true,
});
// 現在のバージョンを取得
const currentVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
let [major, minor, patch] = currentVersion.split('.').map(Number);

// 現在のバージョンを出力 / バージョンの更新
switch (values.type) {
  // biome-ignore lint/suspicious/noFallthroughSwitchClause: unreachable
  case 'mock':
    await $`echo -n ${currentVersion}`;
    process.exit(0);
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

// manifest.jsonの更新
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;

manifest.version = newVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// versions.jsonの更新
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));

versions[newVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));

// 新しいバージョンを出力
await $`echo -n ${newVersion}`;
