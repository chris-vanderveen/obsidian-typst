import type {
  PackageResolveContext,
  PackageSpec,
} from '@myriaddreamin/typst.ts/dist/esm/internal.types.mjs';

import type ObsidianTypstMate from '@/main';
import type AccessModel from './accessModel';

// 参照: https://github.com/Myriad-Dreamin/typst.ts/blob/0865ba035c1be31cf4ffcfe4a221ab87e0635247/packages/typst.ts/src/fs/package.mts
export default class FetchPackageRegistry {
  cache: Map<string, () => string | undefined> = new Map();
  am: AccessModel;

  plugin: ObsidianTypstMate;

  constructor(am: AccessModel, plugin: ObsidianTypstMate) {
    this.cache = new Map();
    this.am = am;
    this.plugin = plugin;
  }

  resolvePath(path: PackageSpec): string {
    return `https://packages.typst.org/preview/${path.name}-${path.version}.tar.gz`;
  }

  pullPackageData(path: PackageSpec): Uint8Array | undefined {
    const request = new XMLHttpRequest();
    request.overrideMimeType('text/plain; charset=x-user-defined');
    request.open('GET', this.resolvePath(path), false);
    request.send(null);

    if (
      request.status === 200 &&
      (request.response instanceof String ||
        typeof request.response === 'string')
    ) {
      return Uint8Array.from(request.response, (c: string) => c.charCodeAt(0));
    }

    return undefined;
  }

  resolve(
    spec: PackageSpec,
    context: PackageResolveContext,
  ): string | undefined {
    if (spec.namespace !== 'preview') {
      return undefined;
    }

    const path = this.resolvePath(spec);
    if (this.cache.has(path)) {
      return this.cache.get(path)!();
    }

    const data = this.pullPackageData(spec);
    if (!data) {
      return undefined;
    }

    const previewDir = `${this.plugin.packagesDirPath}/${spec.namespace}/${spec.name}/${spec.version}`;
    const entries: [string, Uint8Array][] = [];
    context.untar(data, (path: string, data: Uint8Array, _mtime: number) => {
      entries.push([`${previewDir}/${path}`, data]);
    });
    for (const [path, data] of entries) {
      this.insertFile(path, data);
    }
    this.am.saveCache(spec);

    this.cache.set(path, () => previewDir);
    return previewDir;
  }

  insertFile(path: string, data: Uint8Array, _mtime?: Date) {
    this.am.insertFile(path, data, _mtime);
  }

  // オリジナル
  loadPackages(packageSpecs: PackageSpec[]) {
    for (const packageSpec of packageSpecs) {
      this.cache.set(
        this.resolvePath(packageSpec),
        () =>
          `${this.plugin.packagesDirPath}/${packageSpec.namespace}/${packageSpec.name}/${packageSpec.version}`,
      );
    }
  }

  // オリジナル
  async getPackageSpecs() {
    const packages = [];

    for await (const namespaceDir of (
      await this.plugin.app.vault.adapter.list(this.plugin.packagesDirPath)
    ).folders) {
      for await (const nameDir of (
        await this.plugin.app.vault.adapter.list(namespaceDir)
      ).folders) {
        for await (const versionDir of (
          await this.plugin.app.vault.adapter.list(nameDir)
        ).folders) {
          packages.push({
            namespace: namespaceDir.replace(
              `${this.plugin.packagesDirPath}/`,
              '',
            ),
            name: nameDir.replace(`${namespaceDir}/`, ''),
            version: versionDir.replace(`${nameDir}/`, ''),
          });
        }
      }
    }

    return packages;
  }

  // オリジナル
  async removePackage(packageSpec: PackageSpec) {
    const path = this.resolvePath(packageSpec);
    this.cache.delete(path);
    await this.plugin.app.vault.adapter
      .remove(
        `${this.plugin.cachesDirPath}/${packageSpec.namespace}_${packageSpec.name}_${packageSpec.version}.cache`,
      )
      .catch(() => {});

    await this.am.removePackage(packageSpec);

    await this.plugin.init();
  }
}
