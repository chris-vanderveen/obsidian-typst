import { ButtonComponent, DropdownComponent, ItemView } from 'obsidian';

import './leaf.css';

interface Item {
  title: string;
  url: string;
}

const ALL_ITEMS: Item[] = [
  {
    title: 'symbols',
    url: 'https://typst.app/docs/reference/symbols/sym/',
  },
  {
    title: 'packages',
    url: 'https://typst.app/universe/search/',
  },
];

export class TypstToolsView extends ItemView {
  static viewtype = 'typst-tools';

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
    const dropdown = new DropdownComponent(menuEl)
      .addOption('symbols', 'Symbols')
      .addOption('packages', 'Packages')
      .onChange((value) => {
        iframe.src = ALL_ITEMS.find((item) => item.title === value)
          ?.url as string;
      });
    new ButtonComponent(menuEl)
      .setTooltip('再読み込み')
      .setIcon('refresh-ccw')
      .onClick(() => {
        iframe.src = ALL_ITEMS.find(
          (item) => item.title === dropdown.getValue(),
        )?.url as string;
      });

    // iframe
    const iframe = container.createEl('iframe');
    iframe.src = 'https://typst.app/docs/reference/symbols/sym/';
  }
}
