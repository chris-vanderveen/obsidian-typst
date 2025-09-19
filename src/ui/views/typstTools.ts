import { ButtonComponent, DropdownComponent, ItemView, Platform, type WorkspaceLeaf } from 'obsidian';
import { tex2typst, typst2tex } from 'tex2typst';

import { ProcessorList } from '@/core/settings/processor';
import type ObsidianTypstMate from '@/main';

import './typst-tools.css';

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
    dropdown
      .addOption('snippets', 'Snippets')
      .addOption('converter', 'Converter')
      .addOption('processors', 'Processors');

    const onChangeHandler = (value: string) => {
      content.empty();
      switch (value) {
        case 'symbols':
          content.createEl('iframe').src = 'https://typst.app/docs/reference/symbols/sym/';
          break;
        case 'packages':
          content.createEl('iframe').src = 'https://typst.app/universe/search/';
          break;
        case 'snippets': {
          const dropdown = new DropdownComponent(content);
          const options = this.plugin.settings.snippets?.map((snippet) => snippet.name) ?? [];
          dropdown.addOption('', 'ALL');
          dropdown.addOptions(Object.fromEntries(options.map((name) => [name, name])));
          dropdown.setValue('');

          const snippetsEl = content.createEl('div');
          const renderSnippets = () => {
            snippetsEl.empty();
            const category = dropdown.getValue();
            const snippets =
              category === ''
                ? (this.plugin.settings.snippets ?? [])
                : (this.plugin.settings.snippets?.filter((snippet) => snippet.name === category) ?? []);
            snippets.forEach((snippet) => {
              const snippetEl = snippetsEl.createEl('div');
              snippetEl.className = 'typstmate-snippet';
              snippetEl.createEl('div', { text: `${snippet.name}` });
              snippetEl.createEl('div', { text: `${snippet.kind}` });

              const preview = snippetEl.createEl('div');
              let content: string;
              switch (snippet.kind) {
                case 'inline':
                  content = `${snippet.id}${snippet.id === '' ? '' : ':'}${snippet.content}`;
                  break;
                case 'display':
                  content = `${snippet.id}\n${snippet.content}\n`;
                  break;
                case 'codeblock':
                  content = snippet.content;
                  break;
              }
              this.plugin.typstManager.render(content, preview, snippet.kind);

              preview.onClickEvent(() => {
                switch (snippet.kind) {
                  case 'inline':
                    navigator.clipboard.writeText(`$${content}$`);
                    break;
                  case 'display':
                    navigator.clipboard.writeText(`$$${content}$$`);
                    break;
                  case 'codeblock':
                    navigator.clipboard.writeText(content);
                    break;
                }
              });

              snippetEl.createEl('hr');
            });
          };
          renderSnippets();
          dropdown.onChange(renderSnippets);
          break;
        }
        case 'converter': {
          const dropdown = new DropdownComponent(content);
          dropdown.addOption('tex2typst', 'tex2typst').addOption('mitex', 'MiTex');

          const updatePreview = () => {
            preview.empty();
            this.plugin.typstManager.render(output.value, preview, 'inline');
          };

          const input = content.createEl('textarea');
          input.placeholder = '(La)Tex';
          input.addClass('typstmate-form-control');
          input.addEventListener('input', async () => {
            try {
              switch (dropdown.getValue()) {
                case 'tex2typst':
                  output.value = tex2typst(input.value);
                  break;
                case 'mitex':
                  output.value = await this.plugin.typst!.mitex(input.value);
                  break;
              }
              updatePreview();
            } catch (error) {
              output.value = String(error);
            }
          });

          const output = content.createEl('textarea');
          output.placeholder = 'Typst';
          output.addClass('typstmate-form-control');
          output.addEventListener('input', async () => {
            try {
              switch (dropdown.getValue()) {
                case 'tex2typst':
                  input.value = typst2tex(output.value);
                  break;
                case 'mitex':
                  return;
              }
              updatePreview();
            } catch (error) {
              input.value = String(error);
            }
          });

          const preview = content.createEl('div');
          preview.addClass('typstmate-settings-preview-preview');

          const button = content.createEl('button');
          button.setText('Copy');
          button.addClass('typstmate-button');
          button.onClickEvent(async () => {
            navigator.clipboard.writeText(`$${output.value}$`);
          });

          break;
        }
        case 'processors':
          new ProcessorList(this.plugin, 'inline', content, 'Inline($...$) Processors', true);
          new ProcessorList(this.plugin, 'display', content, 'Display($$...$$) Processors', true);
          new ProcessorList(this.plugin, 'codeblock', content, 'CodeBlock(```...```) Processors', true);
          if (this.plugin.excalidrawPluginInstalled) {
            new ProcessorList(this.plugin, 'excalidraw', content, 'Excalidraw Processors', true);
          }
          break;
      }
    };
    dropdown.onChange(onChangeHandler);

    new ButtonComponent(menuEl)
      .setIcon('refresh-ccw')
      .setTooltip('再読み込み')
      .onClick(() => {
        switch (dropdown.getValue()) {
          case 'symbols':
            content.createEl('iframe').src = 'https://typst.app/docs/reference/symbols/sym/';
            break;
          case 'packages':
            content.createEl('iframe').src = 'https://typst.app/universe/search/';
            break;
        }
      });

    // content
    const content = container.createEl('div');
    content.className = 'typstmate-content';
    if (Platform.isDesktop) {
      dropdown.setValue('symbols');
      onChangeHandler('symbols');
    } else {
      dropdown.setValue('converter');
      onChangeHandler('converter');
    }
  }
}
