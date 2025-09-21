import { type App, Modal, Setting } from 'obsidian';

import type ObsidianTypstMate from '@/main';
import type { SnippetView } from '@/ui/views/typst-tools/snippet';

export class SnippetExtModal extends Modal {
  constructor(app: App, plugin: ObsidianTypstMate, snippetIndex: number, snippetView: SnippetView) {
    super(app);

    const categories = plugin.settings.snippets?.map((snippet) => snippet.category) ?? [];

    // Category
    new Setting(this.contentEl).setName(`Category`).addDropdown((dropdown) => {
      dropdown.addOptions(Object.fromEntries(categories.map((name) => [name, name])));
      dropdown.setValue('');

      dropdown.onChange((value) => {
        plugin.settings.snippets![snippetIndex]!.category = value;
        plugin.saveSettings();
        snippetView.currentCategory = value;
        snippetView.dropdownEl.setValue(value);
        snippetView.buildSnippets();
        this.close();
      });
    });
  }
}
