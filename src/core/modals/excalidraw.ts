import { type App, Modal, Setting } from 'obsidian';
import { DefaultNewExcalidrawProcessor } from '@/lib/processor';
import type ObsidianTypstMate from '@/main';

export class ExcalidrawModal extends Modal {
  constructor(app: App, plugin: ObsidianTypstMate) {
    super(app);

    let id = '';
    let code = '';

    new Setting(this.contentEl).setName('Excalidraw').setHeading();

    new Setting(this.contentEl).setName('processor id').addDropdown((dropdown) => {
      const processors = plugin.settings.processor.excalidraw?.processors ?? [];
      processors.forEach((processor) => {
        dropdown.addOption(processor.id, processor.id);
      });

      dropdown.onChange((value) => {
        id = value;
      });
    });

    new Setting(this.contentEl).setName('code').addText((text) => {
      text.onChange((value) => {
        code = value;
      });
    });

    new Setting(this.contentEl).addButton((button) => {
      button.setButtonText('Add Typst');

      button.onClick(() => {
        this.close();
        const processor =
          plugin.settings.processor.excalidraw?.processors.find((processor) => processor.id === id) ??
          DefaultNewExcalidrawProcessor;
        plugin.excalidraw?.addTypst(code, processor);
      });
    });
  }
}
