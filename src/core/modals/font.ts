import { type App, Modal, Notice, Setting } from 'obsidian';

import { type FontInfo, roundFontStretch, roundFontWeight } from '@/lib/font';

export class FontModal extends Modal {
  constructor(app: App, fontInfoArray: FontInfo[]) {
    super(app);

    fontInfoArray.forEach((fontInfo) => {
      new Setting(this.contentEl)
        .setName(fontInfo.family)
        .setHeading()
        .addButton((button) => {
          button.setTooltip('Copy Font Family');
          button.setIcon('copy');
          button.onClick(async () => {
            navigator.clipboard.writeText(fontInfo.family);
            new Notice('Copied!');
          });
        });
      new Setting(this.contentEl).setName(`style: ${fontInfo.variant.style}`);
      new Setting(this.contentEl).setName(
        `weight: ${roundFontWeight(fontInfo.variant.weight)}`,
      );
      new Setting(this.contentEl).setName(
        `stretch: ${roundFontStretch(fontInfo.variant.stretch)}`,
      );
      new Setting(this.contentEl).setName(
        `flags: ${fontInfo.flags !== '' ? fontInfo.flags : 'none'}`,
      );
    });
  }
}
