import { ItemView, type Menu, type WorkspaceLeaf } from 'obsidian';

import type ObsidianTypstMate from '@/main';

// TODO

export class TypstFileView extends ItemView {
  static viewtype = 'typst-file';
  plugin: ObsidianTypstMate;

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianTypstMate) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TypstFileView.viewtype;
  }

  getDisplayText(): string {
    return 'Typst File';
  }

  override async onOpen(): Promise<void> {
    this.addAction('text', 'Open as markdown', async (_eventType) => {});
  }

  override async onClose(): Promise<void> {}

  override onPaneMenu(menu: Menu, source: string) {
    menu.addItem((item) => {
      item.setTitle('Open as markdown').setIcon('lucide-file-text');
    });

    super.onPaneMenu(menu, source);
  }
}
