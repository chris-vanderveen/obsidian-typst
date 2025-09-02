import {
  type App,
  Notice,
  Platform,
  PluginSettingTab,
  Setting,
} from 'obsidian';

import type {
  CodeblockProcessor,
  DisplayProcessor,
  InlineProcessor,
} from '@/lib/processor';
import type ObsidianTypstMate from '@/main';
import { FontList } from './settings/font';
import { PackagesList } from './settings/package';
import { ProcessorList } from './settings/processor';

import './settings.css';

export interface Settings {
  enableBackgroundRendering: boolean;
  autoBaseColor: boolean;
  failOnWarning: boolean;
  baseColor: string;
  enableMathjaxFallback: boolean;
  processor: {
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
}
export const DEFAULT_SETTINGS: Settings = {
  enableBackgroundRendering: true,
  autoBaseColor: true,
  failOnWarning: false,
  baseColor: '#000000',
  enableMathjaxFallback: false,
  processor: {
    inline: {
      processors: [
        {
          id: 'ce',
          renderingEngine: 'typst',
          format: [
            '#import "@preview/typsium:0.3.0": ce',
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: fontsize)',
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
            '#set text(size: fontsize)',
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
            '#set text(size: fontsize)',
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
            '#set text(size: fontsize)',
            '$\n{CODE}\n$',
          ].join('\n'),
          styling: 'block',
        },
        {
          id: '',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: fontsize)',
            '$\n{CODE}\n$',
          ].join('\n'),
          styling: 'block-center',
        },
      ],
    },
    codeblock: {
      processors: [
        {
          id: 'typ',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: fontsize)',
            '{CODE}',
          ].join('\n'),
          styling: 'block',
        },
        {
          id: 'typst',
          renderingEngine: 'typst',
          format: [
            '#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)',
            '#set text(size: fontsize)',
            '```typst\n{CODE}\n```',
          ].join('\n'),
          styling: 'codeblock',
        },
      ],
    },
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
    this.addAdvancedSettings(containerEl);
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

    new Setting(containerEl)
      .setName('Enable Background Rendering')
      .setDesc(
        'The UI will no longer freeze, but it may conflict with plugins related to export or rendering(plugin reload is required.)',
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableBackgroundRendering);
        toggle.onChange((value) => {
          this.plugin.settings.enableBackgroundRendering = value;
          this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Auto Base Color')
      .setDesc("Uses Obsidian's text color as the base color automatically.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoBaseColor);
        toggle.onChange((value) => {
          this.plugin.settings.autoBaseColor = value;
          if (value) this.plugin.applyBaseColor();

          this.plugin.saveSettings();
        });
      });
  }

  addProcessorSettings(containerEl: HTMLElement) {
    const desc = document.createDocumentFragment();
    desc.appendText(
      'In each mode, the first matching Processor ID from the top will be used. An empty Processor ID means the default and should be placed at the bottom. In the format, ',
    );
    desc.createEl('b', { text: '{CODE}' });
    desc.appendText(
      ' can be used (only the first occurrence is replaced), and ',
    );
    desc.createEl('b', { text: 'fontsize' });
    desc.appendText(' can be used as an internal length value.');
    desc.appendText(
      'In inline mode, separate the id and the code with a colon (:).',
    );
    desc.createEl('b', {
      text: ' IDs should not contain any special characters!',
    });

    new Setting(containerEl).setName('Processor').setDesc(desc).setHeading();

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
                  this.plugin.typstManager.render(
                    `${id ? `${id}:` : ''}${code}`,
                    previewEl,
                    'inline',
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
                  this.plugin.typstManager.render(
                    `${id ? `${id}\n` : ''}${code}\n`,
                    previewEl,
                    'display',
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
                  this.plugin.typstManager.render(code, previewEl, id || '');
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
        this.plugin.typstManager.render(
          `${id ? `${id}:` : ''}${code}`,
          previewEl,
          'inline',
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

    // フォント一覧
    new FontList(this.plugin, containerEl);
  }

  addTypstPackageSettings(containerEl: HTMLElement) {
    const setting = new Setting(containerEl)
      .setName('Package')
      .setDesc(
        'When a package is imported, the cache is used instead of the actual files for faster performance. If you make changes directly, please click the package icon to refresh the cache(plugin reload is required.)',
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

  addAdvancedSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('Advanced').setHeading();

    new Setting(containerEl).setName('Fail on Warning').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.failOnWarning);
      toggle.onChange((value) => {
        this.plugin.settings.failOnWarning = value;
        this.plugin.saveSettings();
      });
    });

    new Setting(containerEl)
      .setName('Base Color')
      .setDesc(
        'Replace black in SVGs with another color. This is useful when using a dark theme. To enable this, you need to disable the Auto Base Color setting.',
      )
      .addColorPicker((colorPicker) => {
        colorPicker.setValue(this.plugin.settings.baseColor);
        colorPicker.onChange((value) => {
          this.plugin.settings.baseColor = value;
          this.plugin.saveSettings();
        });
      });

    const desc = document.createDocumentFragment();
    desc.appendText('Not recommended for performance reasons. When enabled, ');
    desc.createEl('b', {
      text: 'Typst errors, warnings, and hints will be unavailable.',
    });
    new Setting(containerEl)
      .setName('Enable MathJax Fallback')
      .setDesc(desc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableMathjaxFallback);
        toggle.onChange((value) => {
          this.plugin.settings.enableMathjaxFallback = value;
          this.plugin.saveSettings();
        });
      });
  }
}
