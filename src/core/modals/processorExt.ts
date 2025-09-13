import { type App, Modal, Setting } from 'obsidian';

import type { ProcessorKind } from '@/lib/processor';
import { buildDocumentFragment } from '@/lib/util';
import type ObsidianTypstMate from '@/main';

export class ProcessorModal extends Modal {
  constructor(app: App, plugin: ObsidianTypstMate, kind: ProcessorKind, id: string) {
    super(app);

    const processor = plugin.settings.processor[kind]?.processors.find((processor) => processor.id === id);

    if (!processor) return;

    new Setting(this.contentEl).setName(processor.id).setHeading();

    new Setting(this.contentEl).setName(`Use preamble`).addToggle((toggle) => {
      toggle.setValue(!processor.noPreamble);

      toggle.onChange(() => {
        processor.noPreamble = !processor.noPreamble;
        plugin.saveSettings();
      });
    });

    new Setting(this.contentEl)
      .setName('Fit to parent width')
      .setDesc(
        buildDocumentFragment(
          "Monitors changes in the parent element's size, adds a line at the beginning of the code declaring length: `WIDTH`, and replaces `width: auto` with `width: WIDTH`. This can only be used when background rendering is enabled, and *it may not work correctly with some plugin/export functions*.",
        ),
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
