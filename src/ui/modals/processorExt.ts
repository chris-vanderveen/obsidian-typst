import { type App, Modal, Setting } from 'obsidian';

import type { ProcessorKind } from '@/libs/processor';
import type ObsidianTypstMate from '@/main';
import { CustomFragment } from '@/utils/customFragment';

export class ProcessorModal extends Modal {
  constructor(app: App, plugin: ObsidianTypstMate, kind: ProcessorKind, id: string) {
    super(app);

    const processor = plugin.settings.processor[kind]?.processors.find((processor) => processor.id === id);
    if (!processor) return;

    new Setting(this.contentEl).setName(processor.id).setHeading();

    // Preamble
    new Setting(this.contentEl).setName(`Use preamble`).addToggle((toggle) => {
      toggle.setValue(!processor.noPreamble);

      toggle.onChange(() => {
        processor.noPreamble = !processor.noPreamble;
        plugin.saveSettings();
      });
    });

    // Width 自動調整
    new Setting(this.contentEl)
      .setName('Fit to parent width')
      .setDesc(
        new CustomFragment()
          .appendText(
            "Monitors changes in the parent element's size, adds a line at the beginning of the code declaring length: ",
          )
          .appendCodeText('WIDTH')
          .appendText('and replaces ')
          .appendCodeText('width: auto')
          .appendText('with ')
          .appendCodeText('width: WIDTH')
          .appendText('. This can only be used when background rendering is enabled, and ')
          .appendBoldText('it may not work correctly with some plugin/export functions'),
      )
      .addToggle((toggle) => {
        toggle.setValue(processor.fitToParentWidth ?? false);

        toggle.onChange(() => {
          processor.fitToParentWidth = !processor.fitToParentWidth;
          plugin.saveSettings();
        });
      });
  }
}
