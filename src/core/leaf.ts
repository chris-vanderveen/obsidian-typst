import { ButtonComponent, DropdownComponent, ItemView, Platform, type WorkspaceLeaf } from 'obsidian';

import type ObsidianTypstMate from '@/main';
import { ProcessorList } from './settings/processor';

import './leaf.css';

export class TypstToolsView extends ItemView {
  static viewtype = 'typst-tools';

  plugin: ObsidianTypstMate;

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianTypstMate) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TypstToolsView.viewtype;
  }

  getDisplayText(): string {
    return 'Typst Tools';
  }

  override getIcon(): string {
    return 'type';
  }

  override async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.className = 'typstmate-leaf';

    // メニュー
    const menuEl = container.createEl('div');
    menuEl.className = 'typstmate-menu';
    const dropdown = new DropdownComponent(menuEl);
    if (Platform.isDesktop) {
      dropdown.addOption('symbols', 'Symbols').addOption('packages', 'Packages');
    }
    dropdown.addOption('processors', 'Processors').onChange((value) => {
      item.empty();
      switch (value) {
        case 'symbols':
          item.createEl('iframe').src = 'https://typst.app/docs/reference/symbols/sym/';
          break;
        case 'packages':
          item.createEl('iframe').src = 'https://typst.app/universe/search/';
          break;
        case 'processors':
          new ProcessorList(this.plugin, 'inline', item, 'Inline($...$) Processors', true);
          new ProcessorList(this.plugin, 'display', item, 'Display($$...$$) Processors', true);
          new ProcessorList(this.plugin, 'codeblock', item, 'CodeBlock(```...```) Processors', true);
          if (this.plugin.excalidrawPluginInstalled) {
            new ProcessorList(this.plugin, 'excalidraw', item, 'Excalidraw Processors', true);
          }
          break;
      }
    });
    new ButtonComponent(menuEl)
      .setIcon('refresh-ccw')
      .setTooltip('再読み込み')
      .onClick(() => {
        switch (dropdown.getValue()) {
          case 'symbols':
            item.createEl('iframe').src = 'https://typst.app/docs/reference/symbols/sym/';
            break;
          case 'packages':
            item.createEl('iframe').src = 'https://typst.app/universe/search/';
            break;
        }
      });

    // iframe
    const item = container.createEl('div');
    item.className = 'typstmate-content';
    if (Platform.isDesktop) {
      const iframe = item.createEl('iframe');
      iframe.src = 'https://typst.app/docs/reference/symbols/sym/';
    } else {
      new ProcessorList(this.plugin, 'inline', item, 'Inline($...$) Processors', true);
      new ProcessorList(this.plugin, 'display', item, 'Display($$...$$) Processors', true);
      new ProcessorList(this.plugin, 'codeblock', item, 'CodeBlock(```...```) Processors', true);
      if (this.plugin.excalidrawPluginInstalled) {
        new ProcessorList(this.plugin, 'excalidraw', item, 'Excalidraw Processors', true);
      }
    }
  }
}
