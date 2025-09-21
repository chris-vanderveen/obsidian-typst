import { ItemView, type WorkspaceLeaf } from 'obsidian';

import type ObsidianTypstMate from '@/main';

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
    // TODO:
  }

  override async onClose(): Promise<void> {}
}
