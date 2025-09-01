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
  general: {
    enableMathjaxFallback: boolean;
    enableBackgroundRendering: boolean;
    failOnWarning: boolean;
    baseColor: string;
  };
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
  advanced: {
    autoBaseColor: boolean;
  };
}
export const DEFAULT_SETTINGS: Settings = {
  general: {
    enableMathjaxFallback: false,
    enableBackgroundRendering: true,
    failOnWarning: false,
    baseColor: '#000000',
  },
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
  advanced: {
    autoBaseColor: false,
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
      .setName('Enable MathJax Fallback')
      .setDesc(
        'Not recommended for performance reasons. When enabled, Typst errors and hints will be unavailable.',
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.general.enableMathjaxFallback);
        toggle.onChange((value) => {
          this.plugin.settings.general.enableMathjaxFallback = value;
          this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Enable Background Rendering')
      .setDesc(
        'The UI will no longer freeze, but it may conflict with plugins related to export or rendering(plugin reload is required.)',
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.general.enableBackgroundRendering);
        toggle.onChange((value) => {
          this.plugin.settings.general.enableBackgroundRendering = value;
          this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName('Fail on Warning').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.general.failOnWarning);
      toggle.onChange((value) => {
        this.plugin.settings.general.failOnWarning = value;
        this.plugin.saveSettings();
      });
    });

    new Setting(containerEl)
      .setName('Base Color')
      .setDesc(
        'Replace black in SVGs with another color. This is useful when using a dark theme.',
      )
      .addColorPicker((colorPicker) => {
        colorPicker.setValue(this.plugin.settings.general.baseColor);
        colorPicker.onChange((value) => {
          this.plugin.settings.general.baseColor = value;
          this.plugin.saveSettings();
        });
      });
  }

  addProcessorSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('Processor')
      .setDesc(
        'In each mode, the first matching Processor ID from the top will be used. An empty Processor ID means the default and should be placed at the bottom. In the format, {CODE} can be used (only the first occurrence is replaced), and fontsize can be used as an internal length value. IDs should not contain any special characters!',
      )
      .setHeading();

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

  addAdvancedSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('Advanced').setHeading();

    new Setting(containerEl)
      .setName('Auto Base Color')
      .setDesc("Uses Obsidian's text color as the base color automatically.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.advanced.autoBaseColor);
        toggle.onChange((value) => {
          this.plugin.settings.advanced.autoBaseColor = value;
          if (value) this.plugin.applyBaseColor();

          this.plugin.saveSettings();
        });
      });
  }
}
