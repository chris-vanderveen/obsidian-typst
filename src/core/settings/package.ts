import { Notice, Setting } from 'obsidian';
import { zip } from '@/lib/util';
import type { PackageSpec } from '@/lib/worker';
import type ObsidianTypstMate from '@/main';

export class PackagesList {
  plugin: ObsidianTypstMate;
  packageTableEl: HTMLElement;

  constructor(plugin: ObsidianTypstMate, containerEl: HTMLElement) {
    this.plugin = plugin;

    this.packageTableEl = containerEl.createDiv('typstmate-settings-table typstmate-hidden');

    this.displayPackageList();
  }

  async displayPackageList() {
    this.packageTableEl.empty();

    const specs = (await this.plugin.app.vault.adapter.list(this.plugin.cachesDirPath)).files
      .filter((f) => f.endsWith('.cache'))
      .map((f) => {
        const [namespace, name, version] = f.replace('.cache', '').split('/').pop()!.split('_');
        return {
          namespace: namespace!,
          name: name!,
          version: version!,
        };
      });
    if (specs.length === 0) return;

    this.packageTableEl.removeClass('typstmate-hidden');

    specs.forEach((spec) => {
      const packageEl = new Setting(this.packageTableEl)
        .setName(`@${spec.namespace}/${spec.name}:${spec.version}`)
        .addButton((cacheButton) => {
          cacheButton.setTooltip('Cache');
          cacheButton.setIcon('package');

          cacheButton.onClick(async () => {
            await this.createCacheManually(spec)
              .then(async (map) => {
                await this.plugin.typst.store({ sources: map });
                new Notice('Cached successfully!');
              })
              .catch(() => {
                new Notice('Failed to cache');
              });
          });
        })
        .addButton((delButton) => {
          delButton.buttonEl.addClass('typstmate-button', 'typstmate-button-danger');
          delButton.setTooltip('Remove');
          delButton.setIcon('trash');

          delButton.onClick(async () => {
            await this.removePackage(spec)
              .then(() => {
                new Notice('Removed successfully!');
              })
              .catch(() => {
                new Notice('Failed to remove');
              });
          });
        });
      packageEl.settingEl.id = `${spec.namespace}/${spec.name}:${spec.version}`;
    });
  }

  async removePackage(spec: PackageSpec) {
    await this.plugin.app.vault.adapter.remove(
      `${this.plugin.cachesDirPath}/${spec.namespace}_${spec.name}_${spec.version}.cache`,
    );

    this.packageTableEl.children.namedItem(`${spec.namespace}/${spec.name}:${spec.version}`)?.remove();

    if (this.packageTableEl.children.length === 0) this.packageTableEl.addClass('typstmate-hidden');

    // init?
  }

  private async collectFiles(dirPath: string, map: Map<string, Uint8Array | undefined>): Promise<void> {
    const listedFiles = await this.plugin.app.vault.adapter.list(dirPath);
    const filePaths = listedFiles.files;
    const folderPaths = listedFiles.folders;

    await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          const data: Uint8Array = new Uint8Array(await this.plugin.app.vault.adapter.readBinary(filePath));
          map.set(filePath.replace(`${this.plugin.packagesDirPath}/`, ''), data);
        } catch {}
      }),
    );

    for (const folderPath of folderPaths) {
      await this.collectFiles(folderPath, map);
    }
  }

  private async createCacheManually(packageSpec: PackageSpec) {
    const map = new Map<string, Uint8Array>();

    await this.collectFiles(
      `${this.plugin.packagesDirPath}/${packageSpec.namespace}/${packageSpec.name}/${packageSpec.version}`,
      map,
    );

    await this.plugin.app.vault.adapter.writeBinary(
      `${this.plugin.cachesDirPath}/${packageSpec.namespace}_${packageSpec.name}_${packageSpec.version}.cache`,
      zip(map).slice().buffer,
    );

    return map;
  }
}
