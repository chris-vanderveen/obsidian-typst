import type { MemoryAccessModel } from '@myriaddreamin/typst.ts';
import { $typst } from '@myriaddreamin/typst.ts';
import type { PackageSpec } from '@myriaddreamin/typst.ts/dist/esm/internal.types.mjs';
import { Notice } from 'obsidian';
import { deserializeDataMap, serializeDataMap } from '@/lib/serializer';
import type ObsidianTypstMate from '@/main';

// 参照: https://github.com/Myriad-Dreamin/typst.ts/blob/0865ba035c1be31cf4ffcfe4a221ab87e0635247/packages/typst.ts/src/fs/memory.mts#
export default class AccessModel implements MemoryAccessModel {
  mTimes: Map<string, Date | undefined> = new Map();
  mData: Map<string, Uint8Array | undefined> = new Map();

  plugin: ObsidianTypstMate;

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;
  }

  reset() {
    this.mTimes.clear();
    this.mData.clear();
  }

  insertFile(path: string, data: Uint8Array, _mtime?: Date) {
    const dirs = path.split('/');
    dirs.pop();
    this.plugin.app.vault.adapter.mkdir(dirs.join('/'));

    this.mData.set(path, data);
    if (_mtime) this.mTimes.set(path, _mtime);

    this.plugin.app.vault.adapter.writeBinary(
      path,
      new Uint8Array(data.buffer).slice().buffer,
    );
  }

  removeFile(path: string) {
    this.plugin.app.vault.adapter.remove(path).then(() => {
      this.mTimes.delete(path);
      this.mData.delete(path);
    });
  }

  getMTime(path: string) {
    return this.mTimes.get(path);
  }

  isFile(_path?: string) {
    return true;
  }

  getRealPath(path: string) {
    return path;
  }

  readAll(path: string) {
    if (this.mData.has(path)) return this.mData.get(path);

    this.plugin.app.vault.adapter.readBinary(path).then((buffer) => {
      this.mData.set(path, new Uint8Array(buffer));
      this.mTimes.set(path, new Date());
    });

    // ? 画像やbibliography, wasmなどのアセットの場合
    // ! 同期で実装する
    if (path.startsWith('/')) {
      this.plugin.app.vault.adapter.readBinary(path).then((buffer) => {
        $typst.mapShadow(path, new Uint8Array(buffer));
      });
    }

    return undefined;
  }

  // オリジナル
  async saveCache(packageSpec: PackageSpec) {
    const cacheMData = new Map<string, Uint8Array | undefined>();

    this.mData.forEach((data, path) => {
      const [namespace, name, version] = path
        .replace(`${this.plugin.packagesDirPath}/`, '')
        .split('/');

      if (
        namespace === packageSpec.namespace &&
        name === packageSpec.name &&
        version === packageSpec.version
      ) {
        cacheMData.set(
          path.replace(`${this.plugin.packagesDirPath}/`, ''),
          data,
        );
      }
    });

    await this.plugin.app.vault.adapter.writeBinary(
      // ? .DS_STORE などが紛れ込まないようにするため
      `${this.plugin.cachesDirPath}/${packageSpec.namespace}_${packageSpec.name}_${packageSpec.version}.cache`,
      new Uint8Array(serializeDataMap(cacheMData)).slice().buffer,
    );
  }

  // オリジナル
  async saveAllCaches() {
    const packageSpecs =
      await this.plugin.typstManager.fetchPackageRegistry.getPackageSpecs();

    for (const packageSpec of packageSpecs) {
      await this.saveCache(packageSpec).catch(() => {
        new Notice(
          `Failed to save cache for @${packageSpec.namespace}/${packageSpec.name}:${packageSpec.version}`,
        );
      });
    }
  }

  // オリジナル
  async loadCache(path: string) {
    const cacheMData = deserializeDataMap(
      await this.plugin.app.vault.adapter.readBinary(path),
    );

    cacheMData.forEach((data, path) => {
      this.mData.set(`${this.plugin.packagesDirPath}/${path}`, data);
    });
  }

  // オリジナル
  async loadAllCaches() {
    const cacheFilePaths = await this.listCachePaths();

    for (const cacheFilePath of cacheFilePaths) {
      await this.loadCache(cacheFilePath);
    }
  }

  // オリジナル
  async removePackage(packageSpec: PackageSpec) {
    this.mData.forEach((_, path) => {
      const [namespace, name, version] = path
        .replace(`${this.plugin.packagesDirPath}/`, '')
        .split('/');

      if (
        namespace === packageSpec.namespace &&
        name === packageSpec.name &&
        version === packageSpec.version
      ) {
        this.mData.delete(path);
        this.mTimes.delete(path);
      }
    });

    await this.plugin.app.vault.adapter
      .rmdir(
        `${this.plugin.packagesDirPath}/${packageSpec.namespace}/${packageSpec.name}/${packageSpec.version}`,
        true,
      )
      .catch(() => {});
  }

  // オリジナル
  parseCachePath(cachePath: string) {
    const [namespace, name, version] = cachePath
      .replace(`${this.plugin.cachesDirPath}/`, '')
      .replace('.cache', '')
      .split('_');

    return { namespace, name, version } as PackageSpec;
  }

  // オリジナル
  async listCachePaths() {
    return (
      await this.plugin.app.vault.adapter.list(this.plugin.cachesDirPath)
    ).files.filter((file) => file.endsWith('.cache'));
  }

  // オリジナル
  async getPackageSpecs() {
    const cachePaths = await this.listCachePaths();

    return cachePaths.map(this.parseCachePath.bind(this));
  }

  // オリジナル
  async collectFiles(
    dirPath: string,
    mData: Map<string, Uint8Array | undefined>,
  ): Promise<void> {
    const listedFiles = await this.plugin.app.vault.adapter.list(dirPath);
    const filePaths = listedFiles.files;
    const folderPaths = listedFiles.folders;

    await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          const data: Uint8Array = new Uint8Array(
            await this.plugin.app.vault.adapter.readBinary(filePath),
          );
          mData.set(filePath, data);
        } catch {}
      }),
    );

    for (const folderPath of folderPaths) {
      await this.collectFiles(folderPath, mData);
    }
  }

  // オリジナル
  async createCacheManually(packageSpec: PackageSpec) {
    await this.collectFiles(
      `${this.plugin.packagesDirPath}/${packageSpec.namespace}/${packageSpec.name}/${packageSpec.version}`,
      this.mData,
    );

    await this.saveCache(packageSpec);
  }
}
