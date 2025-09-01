import type { PackageSpec } from '@myriaddreamin/typst.ts/dist/esm/internal.types.mjs';
import { Notice, Setting } from 'obsidian';

import type ObsidianTypstMate from '@/main';

export class PackagesList {
  plugin: ObsidianTypstMate;
  packageTableEl: HTMLElement;

  constructor(plugin: ObsidianTypstMate, containerEl: HTMLElement) {
    this.plugin = plugin;

    this.packageTableEl = containerEl.createDiv(
      'typstmate-settings-table typstmate-hidden',
    );

    this.displayPackageList();
  }

  async displayPackageList() {
    this.packageTableEl.empty();

    const specs = (
      await this.plugin.app.vault.adapter.list(this.plugin.cachesDirPath)
    ).files
      .filter((f) => f.endsWith('.cache'))
      .map((f) => {
        const [namespace, name, version] = f
          .replace('.cache', '')
          .split('/')
          .pop()!
          .split('_');
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
            await this.plugin.typstManager
              .createCacheManually(spec)
              .then(() => {
                new Notice('Cached successfully!');
                this.plugin.init(true);
              })
              .catch(() => {
                new Notice('Failed to cache');
              });
          });
        })
        .addButton((delButton) => {
          delButton.buttonEl.addClass(
            'typstmate-button',
            'typstmate-button-danger',
          );
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

    this.packageTableEl.children
      .namedItem(`${spec.namespace}/${spec.name}:${spec.version}`)
      ?.remove();

    if (this.packageTableEl.children.length === 0)
      this.packageTableEl.addClass('typstmate-hidden');

    await this.plugin.init();
  }
}
