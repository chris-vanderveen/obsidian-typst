import { Notice, Platform, Setting } from 'obsidian';

import { FontModal } from '@/core/modals/font';
import type { FontData } from '@/lib/font';
import { hashLike } from '@/lib/util';
import type ObsidianTypstMate from '@/main';

export class FontList {
  plugin: ObsidianTypstMate;

  fontDataTableEl?: HTMLElement;
  fontDataCountEl?: HTMLElement;

  importedFontTableEl: HTMLElement;

  constructor(plugin: ObsidianTypstMate, containerEl: HTMLElement) {
    this.plugin = plugin;

    // システムフォント
    if (Platform.isDesktopApp) {
      new Setting(containerEl)
        .setName('Import Font')
        .setDesc('Desktop App only. Typst supports ttf/otf/ttc/otc.')
        .addSearch((search) => {
          search.setPlaceholder('Filter Font Name');

          search.onChange((value) => {
            this.filterSystemFontList(value.toLowerCase());
          });
        })
        .addButton((button) => {
          button.setIcon('list-restart');
          button.setTooltip('Get Font List');

          button.onClick(this.displaySystemFontList.bind(this));
        });

      this.fontDataTableEl = containerEl.createDiv();
      this.fontDataTableEl.addClass('typstmate-settings-table');
      this.fontDataTableEl.style.display = 'none';

      this.fontDataCountEl = containerEl.createDiv();
      this.fontDataCountEl.textContent = 'Click to get system font list';
    }

    // 読み込み済みフォント
    new Setting(containerEl)
      .setName('Imported Font(s)')
      .setDesc(
        'The string next to the font name is used to identify fonts that share the same PostScript name.',
      );

    this.importedFontTableEl = containerEl.createDiv();
    this.importedFontTableEl.addClass('typstmate-settings-table');
    this.importedFontTableEl.style.display = 'none';

    this.displayImportedFontList();
  }

  async filterSystemFontList(filter: string) {
    Array.from(
      this.fontDataTableEl!.children as HTMLCollectionOf<HTMLElement>,
    ).forEach((child) => {
      const name = child.id ?? '';

      if (name.includes(filter)) {
        child.style.display = '';
      } else {
        child.style.display = 'none';
      }
    });
  }

  async displaySystemFontList() {
    this.fontDataTableEl!.empty();

    const fontDataList =
      await this.plugin.typstManager.fontManager.getSystemFontDataList();

    if (fontDataList.length === 0) return;

    this.fontDataTableEl!.style.display = '';

    for (const fontData of fontDataList) {
      const setting = new Setting(this.fontDataTableEl!);
      setting.settingEl.id = fontData.postscriptName.toLowerCase();

      const fontId = hashLike(fontData.fullName);

      setting
        .setName(`${fontData.fullName} (${fontId})`)
        .addButton((button) => {
          button.setIcon('info');
          button.setTooltip('Get Info');

          button.onClick(async () => {
            const info = this.plugin.typstManager.fontManager.getFontInfo(
              await this.plugin.typstManager.fontManager.getFontUint8ArrayFromFontData(
                fontData,
              ),
            );

            new FontModal(this.plugin.app, info).open();
          });
        })
        .addButton((button) => {
          button.setTooltip('Import Font');
          button.setIcon('plus');
          button.onClick(() => this.importFont(fontData));
        });
    }
  }

  addImportedFontSetting(fontPath: string) {
    const basename = fontPath.split('/').pop()!;
    const PSName = basename.split('.').slice(0, -2).join('.');
    const fontId = basename.split('.').at(-2)!;

    const setting = new Setting(this.importedFontTableEl);
    setting.settingEl.id = basename;

    setting
      .setName(`${PSName} (${fontId})`)
      .addButton((button) => {
        button.setIcon('info');
        button.setTooltip('Get Info');

        button.onClick(async () => {
          const info = this.plugin.typstManager.fontManager.getFontInfo(
            new Uint8Array(
              await this.plugin.app.vault.adapter.readBinary(fontPath),
            ),
          );

          new FontModal(this.plugin.app, info).open();
        });
      })
      .addButton((button) => {
        button.setIcon('trash');
        button.setTooltip('Remove');
        button.buttonEl.style.color = 'red';

        button.onClick(this.removeFont.bind(this, basename));
      });
  }

  async displayImportedFontList() {
    this.importedFontTableEl.empty();

    const fontPaths =
      await this.plugin.typstManager.fontManager.getImportedFontPaths();
    if (fontPaths.length === 0) return;

    this.importedFontTableEl.style.display = '';

    for (const fontPath of fontPaths) {
      this.addImportedFontSetting(fontPath);
    }
  }

  async importFont(fontData: FontData) {
    const fontId = hashLike(fontData.fullName);
    const basename = `${fontData.postscriptName}.${fontId}.font`;

    if (this.importedFontTableEl.children.namedItem(basename)) {
      new Notice('Font already imported!');
      return;
    }

    const fontArrayBuffer =
      await this.plugin.typstManager.fontManager.getFontArrayBufferFromFontData(
        fontData,
      );

    // フォントの読み込み
    await this.plugin.app.vault.adapter.writeBinary(
      `${this.plugin.fontsDirPath}/${basename}`,
      fontArrayBuffer,
    );
    await this.plugin.typstManager.init();

    // 表示
    this.addImportedFontSetting(`${this.plugin.fontsDirPath}/${basename}`);

    new Notice('Imported successfully!');
  }

  async removeFont(basename: string) {
    // フォントの削除
    await this.plugin.app.vault.adapter.remove(
      `${this.plugin.fontsDirPath}/${basename}`,
    );
    await this.plugin.typstManager.init();

    // 表示
    this.importedFontTableEl.children.namedItem(basename)?.remove();
    if (this.importedFontTableEl.children.length === 0)
      this.importedFontTableEl.style.display = 'none';

    new Notice('Removed successfully!');
  }
}
