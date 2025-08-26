import {
  type App,
  Notice,
  Platform,
  PluginSettingTab,
  Setting,
} from 'obsidian';

import { type FontAssetType, FontAssetTypeTokens } from '@/lib/font';
import type {
  CodeblockProcessor,
  DisplayProcessor,
  InlineProcessor,
  InlineStyling,
  RenderingEngine,
} from '@/lib/processor';
import type ObsidianTypstMate from '@/main';
import { FontList } from './settings/font';
import { PackagesList } from './settings/package';
import { ProcessorList } from './settings/processor';

import './settings.css';

export interface Settings {
  processor: {
    enableMathjaxFallback: boolean;
    inline: {
      processors: InlineProcessor[];
    };
    display: {
      processors: DisplayProcessor[];
    };
    codeblock: {
      processors: CodeblockProcessor[];
    };
  };
  font: {
    assetFontTypes: FontAssetType[];
  };
}
export const DEFAULT_SETTINGS: Settings = {
  processor: {
    enableMathjaxFallback: false,
    inline: {
      processors: [
        {
          id: 'ce',
          renderingEngine: 'typst',
          format: [
            '#import "@preview/typsium:0.3.0": ce',
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif CJK SC"))',
            '#ce("{CODE}")',
          ].join('\n'),
          styling: 'inline-middle',
        },
        {
          id: 'mid',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '$\n{CODE}\n$',
          ].join('\n'),
          styling: 'inline-middle',
        },
        {
          id: 'tex',
          renderingEngine: 'mathjax',
          format: '',
          styling: 'inline',
        },
        {
          id: '',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif CJK SC"))',
            '${CODE}$',
          ].join('\n'),
          styling: 'inline',
        },
      ],
    },
    display: {
      processors: [
        {
          id: 'block',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '${CODE}$',
          ].join('\n'),
          styling: 'block',
        },
        {
          id: '',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '${CODE}$',
          ].join('\n'),
          styling: 'block-center',
        },
      ],
    },
    codeblock: {
      processors: [
        {
          id: 'typstdoc',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '{CODE}',
          ].join('\n'),
          styling: 'block',
        },
        {
          id: 'typst',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: {FONTSIZE}pt)',
            '```typst\n{CODE}\n```',
          ].join('\n'),
          styling: 'codeblock',
        },
      ],
    },
  },
  font: {
    assetFontTypes: ['text'],
  },
};

export class SettingTab extends PluginSettingTab {
  override plugin: ObsidianTypstMate;

  constructor(app: App, plugin: ObsidianTypstMate) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    this.addGeneralSettings(containerEl);
    this.addProcessorSettings(containerEl);
    this.addPreview(containerEl);
    this.addFontSettings(containerEl);
    this.addTypstPackageSettings(containerEl);
  }

  addGeneralSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('General')
      .setHeading()
      .addButton((button) => {
        button.setButtonText('Reload Plugin');
        button.onClick(async () => {
          await this.plugin.reload();
          new Notice('Reloaded Successfully!');
        });
      });
  }

  addProcessorSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('Processor')
      .setDesc(
        'In each mode, the first matching Processor ID from the top will be used. An empty Processor ID means the default and should be placed at the bottom. In the format, {CODE} and {FONTSIZE} can be used(only the first occurrence is replaced).',
      )
      .setHeading();

    new Setting(containerEl)
      .setName('Enable MathJax Fallback')
      .setDesc(
        'Not recommended for performance reasons. When enabled, Typst errors and hints will be unavailable.',
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.processor.enableMathjaxFallback);
        toggle.onChange((value) => {
          this.plugin.settings.processor.enableMathjaxFallback = value;
          this.plugin.saveSettings();
        });
      });

    new ProcessorList(
      this.plugin,
      'inline',
      containerEl,
      'Inline($...$) Processors',
    );
    new ProcessorList(
      this.plugin,
      'display',
      containerEl,
      'Display($$...$$) Processors',
    );
    new ProcessorList(
      this.plugin,
      'codeblock',
      containerEl,
      'CodeBlock(```...```) Processors',
    );
  }

  addPreview(containerEl: HTMLElement) {
    const previewContainer = containerEl.createDiv(
      'typstmate-settings-preview',
    );

    new Setting(previewContainer)
      .setName('Preview')
      .setHeading()
      .addDropdown((dropdown) => {
        dropdown.addOption('inline', 'Inline');
        dropdown.addOption('display', 'Display');
        dropdown.addOption('codeblock', 'CodeBlock');
        dropdown.setValue('inline');

        dropdown.onChange((value) => {
          inputEl.empty();
          previewEl.empty();

          switch (value) {
            case 'inline': {
              inputEl.createEl('span', { text: '$' });
              const idEl = inputEl.createEl('input', {
                type: 'text',
                placeholder: 'id',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('span', { text: ':' });
              const codeEl = inputEl.createEl('input', {
                type: 'text',
                placeholder: 'code',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('span', { text: '$' });

              const updatePreview = () => {
                const id = idEl.value;
                const code = codeEl.value;
                previewEl.empty();
                if (code) {
                  this.plugin.typstManager.renderInline(
                    `${id ? `${id}:` : ''}${code}`,
                    previewEl,
                  );
                }
              };

              idEl.addEventListener('input', updatePreview);
              codeEl.addEventListener('input', updatePreview);
              break;
            }
            case 'display': {
              inputEl.createEl('span', { text: '$$' });
              const idEl = inputEl.createEl('input', {
                type: 'text',
                placeholder: 'id',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('br');
              const codeEl = inputEl.createEl('textarea', {
                placeholder: 'code',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('br');
              inputEl.createEl('span', { text: '$$' });

              const updatePreview = () => {
                const id = idEl.value;
                const code = codeEl.value;
                previewEl.empty();
                if (code) {
                  this.plugin.typstManager.renderDisplay(
                    `${id ? `${id}\n` : ''}${code}\n`,
                    previewEl,
                  );
                }
              };

              idEl.addEventListener('input', updatePreview);
              codeEl.addEventListener('input', updatePreview);
              break;
            }
            case 'codeblock': {
              inputEl.createEl('span', { text: '```' });
              const idEl = inputEl.createEl('input', {
                type: 'text',
                placeholder: 'id',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('br');
              const codeEl = inputEl.createEl('textarea', {
                placeholder: 'code',
                cls: 'typstmate-form-control',
              });
              inputEl.createEl('br');
              inputEl.createEl('span', { text: '```' });

              const updatePreview = () => {
                const id = idEl.value;
                const code = codeEl.value;
                previewEl.empty();
                if (code) {
                  this.plugin.typstManager.renderCodeblock(
                    code,
                    previewEl,
                    id || '',
                  );
                }
              };

              idEl.addEventListener('input', updatePreview);
              codeEl.addEventListener('input', updatePreview);
              break;
            }
          }
        });
      });

    const inputEl = previewContainer.createDiv(
      'typstmate-settings-preview-input',
    );
    inputEl.createEl('span', { text: '$' });
    const idEl = inputEl.createEl('input', {
      type: 'text',
      placeholder: 'id',
      cls: 'typstmate-form-control',
    });
    inputEl.createEl('span', { text: ':' });
    const codeEl = inputEl.createEl('input', {
      type: 'text',
      placeholder: 'code',
      cls: 'typstmate-form-control',
    });
    inputEl.createEl('span', { text: '$' });

    const updatePreview = () => {
      const id = idEl.value;
      const code = codeEl.value;
      previewEl.empty();
      if (code) {
        this.plugin.typstManager.renderInline(
          `${id ? `${id}:` : ''}${code}`,
          previewEl,
        );
      }
    };

    idEl.addEventListener('input', updatePreview);
    codeEl.addEventListener('input', updatePreview);

    const previewEl = previewContainer.createDiv(
      'typstmate-settings-preview-preview',
    );
    previewEl.setText('Type in the input above to see the preview');
  }

  addFontSettings(containerEl: HTMLElement) {
    const setting = new Setting(containerEl).setName('Font').setHeading();

    if (Platform.isDesktopApp) {
      setting.addButton((button) => {
        button.setIcon('folder-open');

        button.setTooltip('Open Fonts Directory');
        button.onClick(() => {
          window.open(
            `file://${this.plugin.app.vault.adapter.basePath}/${this.plugin.fontsDirPath}`,
          );
        });
      });
    }

    // フォントアセットの設定
    new Setting(containerEl)
      .setName('Download Latest Font Assets')
      .setDesc(
        'After installing or updating the plugin, please click. This is required for offline use.',
      )
      .addButton((button) => {
        button.setIcon('sync');
        button.setTooltip('Download Latest Font Assets');

        button.onClick(async () => {
          await this.plugin.typstManager.fontManager.downloadFontAssets();
        });
      });
    for (const assetFontType of FontAssetTypeTokens) {
      new Setting(containerEl)
        .setName(`Use Font Asset \`${assetFontType}\``)
        .addToggle((toggle) => {
          toggle.setValue(
            this.plugin.settings.font.assetFontTypes.includes(assetFontType),
          );

          toggle.onChange(async (value) => {
            if (value) {
              this.plugin.settings.font.assetFontTypes.push(assetFontType);
            } else {
              this.plugin.settings.font.assetFontTypes =
                this.plugin.settings.font.assetFontTypes.filter(
                  (fontType) => fontType !== assetFontType,
                );
            }

            await this.plugin.saveSettings();
          });
        });
    }

    // フォント一覧
    new FontList(this.plugin, containerEl);
  }

  addTypstPackageSettings(containerEl: HTMLElement) {
    const setting = new Setting(containerEl)
      .setName('Package')
      .setDesc(
        'When a package is imported, the cache is used instead of the actual files for faster performance. If you make changes directly, please click the package icon to refresh the cache.',
      )
      .setHeading();

    if (Platform.isDesktopApp) {
      setting.addButton((button) => {
        button.setIcon('folder-open');

        button.setTooltip('Open Packages Directory');

        button.onClick(() => {
          window.open(
            `file://${this.plugin.baseDirPath}/${this.plugin.packagesDirPath}`,
          );
        });
      });
    }

    // パッケージ一覧
    new PackagesList(this.plugin, containerEl);
  }

  generateProcessorSettings(
    containerEl: HTMLElement,
    type: 'inline' | 'display' | 'codeblock',
  ) {
    const processorsListEl = containerEl.createDiv('typstmate-processor-list');

    this.plugin.settings.processor[type].processors.forEach(
      (processor, processorIndex) => {
        const processorEl = processorsListEl.createDiv(
          'typstmate-settings-processor',
        );
        processorEl.id = `processor-${type}-${processorIndex}`;

        const setting = new Setting(processorEl);

        // Move up button
        setting.addButton((button) => {
          button.setTooltip('Move up');
          button.setIcon('chevrons-up');
          button.buttonEl.addClass('typstmate-button');

          button.onClick(async () => {
            const processors = this.plugin.settings.processor[type].processors;
            const index = processors.findIndex((p) => p.id === processor.id);
            if (index === 0) return;

            // Swap with previous processor
            [processors[index], processors[index - 1]] = [
              processors[index - 1]!,
              processors[index]!,
            ];

            await this.plugin.saveSettings();
            this.plugin.app.setting.openTabById(this.plugin.pluginId);
          });
        });

        // Move down button
        setting.addButton((button) => {
          button.setTooltip('Move down');
          button.setIcon('chevrons-down');
          button.buttonEl.addClass('typstmate-button');

          button.onClick(async () => {
            const processors = this.plugin.settings.processor[type].processors;
            const index = processors.findIndex((p) => p.id === processor.id);
            if (index === processors.length - 1) return;

            // Swap with next processor
            [processors[index], processors[index + 1]] = [
              processors[index + 1]!,
              processors[index]!,
            ];

            await this.plugin.saveSettings();
            this.plugin.app.setting.openTabById(this.plugin.pluginId);
          });
        });

        // Rendering engine dropdown
        setting.addDropdown((dropdown) => {
          dropdown.addOption('typst', 'Typst');
          dropdown.addOption('mathjax', 'MathJax');
          dropdown.setValue(processor.renderingEngine);
          dropdown.selectEl.addClass('typstmate-form-control');

          dropdown.onChange((value) => {
            this.plugin.settings.processor[type].processors[
              processorIndex
            ]!.renderingEngine = value as RenderingEngine;
            this.plugin.saveSettings();
          });
        });

        // Styling dropdown
        setting.addDropdown((dropdown) => {
          const options = {
            inline: [
              { value: 'inline', label: 'Inline' },
              { value: 'inline-middle', label: 'Inline Middle' },
            ],
            display: [
              { value: 'block', label: 'Block' },
              { value: 'block-center', label: 'Block Center' },
            ],
            codeblock: [
              { value: 'block', label: 'Block' },
              { value: 'block-center', label: 'Block Center' },
              { value: 'codeblock', label: 'Codeblock' },
            ],
          }[type];

          options.forEach(({ value, label }) => {
            dropdown.addOption(value, label);
          });

          dropdown.setValue(processor.styling);
          dropdown.selectEl.addClass('typstmate-form-control');

          dropdown.onChange((value) => {
            this.plugin.settings.processor[type].processors[
              processorIndex
            ]!.styling = value as InlineStyling;
            this.plugin.saveSettings();
          });
        });

        // Processor ID input
        setting.addText((text) => {
          text.setValue(processor.id);
          text.setPlaceholder('id');
          text.inputEl.addClass('typstmate-form-control');

          text.onChange((value) => {
            this.plugin.settings.processor[type].processors[
              processorIndex
            ]!.id = value;
            this.plugin.saveSettings();
          });
        });

        // Remove button
        setting.addButton((button) => {
          button.setTooltip('Remove');
          button.setIcon('trash');
          button.buttonEl.addClass('typstmate-button');

          button.onClick(async () => {
            if (confirm('Remove this processor?')) {
              this.plugin.settings.processor[type].processors =
                this.plugin.settings.processor[type].processors.filter(
                  (p) => p.id !== processor.id,
                ) as InlineProcessor[];

              await this.plugin.saveSettings();
              processorEl.remove();
            }
          });
        });

        // Add a subtle border between processors
        if (
          processorIndex <
          this.plugin.settings.processor[type].processors.length - 1
        ) {
          const hr = document.createElement('hr');
          hr.className = 'typstmate-processor-separator';
          processorsListEl.appendChild(hr);
        }

        const textAreaEl = processorEl.createEl('textarea', {
          text: processor.format,
        });
        textAreaEl.addEventListener('input', () => {
          this.plugin.settings.processor[type].processors[
            processorIndex
          ]!.format = textAreaEl.value;

          this.plugin.saveSettings();
        });
      },
    );

    return processorsListEl;
  }
}
