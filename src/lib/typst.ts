import { $typst } from '@myriaddreamin/typst.ts';
import {
  TypstSnippet,
  type TypstSnippetProvider,
} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import JSON5 from 'json5';
import { Notice } from 'obsidian';

import { DEFAULT_SETTINGS } from '@/core/settings';
import type ObsidianTypstMate from '@/main';
import FontManager from './font';
import type { Processor } from './processor';
import AccessModel from './providers/accessModel';
import FetchPackageRegistry from './providers/fetchPackageRegistry';

import './typst.css';

export default class TypstManager {
  plugin: ObsidianTypstMate;

  counter = 0;

  accessModel: AccessModel;
  accessModelProvider: TypstSnippetProvider;
  fetchPackageRegistry: FetchPackageRegistry;
  fetchPackageRegistryProvider: TypstSnippetProvider;

  fontManager: FontManager;

  providers: TypstSnippetProvider[] = [];

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;

    this.fontManager = new FontManager(plugin);

    // ? デフォルトgetModuleの副作用を避ける
    $typst.setCompilerInitOptions({
      getModule: async (): Promise<WebAssembly.Module> =>
        await WebAssembly.compile(
          await this.plugin.app.vault.adapter.readBinary(
            `${this.plugin.pluginDirPath}/compiler.wasm`,
          ),
        ),
    });
    $typst.setRendererInitOptions({
      getModule: async (): Promise<WebAssembly.Module> =>
        await WebAssembly.compile(
          await this.plugin.app.vault.adapter.readBinary(
            `${this.plugin.pluginDirPath}/renderer.wasm`,
          ),
        ),
    });

    // Providerを設定
    this.accessModel = new AccessModel(this.plugin);
    this.accessModelProvider = TypstSnippet.withAccessModel(this.accessModel);

    this.fetchPackageRegistry = new FetchPackageRegistry(
      this.accessModel,
      this.plugin,
    );
    this.fetchPackageRegistryProvider = TypstSnippet.withPackageRegistry(
      this.fetchPackageRegistry,
    );
  }

  async init() {
    this.counter = 0;

    // パッケージの読み込み
    const packageSpecs = await this.accessModel.getPackageSpecs();
    this.fetchPackageRegistry.loadPackages(packageSpecs);
    await this.accessModel.loadAllCaches();

    // Providerを初期化
    this.providers = [
      this.accessModelProvider,
      this.fetchPackageRegistryProvider,
    ];

    if (
      (await this.plugin.app.vault.adapter.list(`${this.plugin.fontsDirPath}`))
        .folders.length !== 0
    ) {
      // ローカルに保存したフォントアセットを読み込む
      this.providers.push(TypstSnippet.disableDefaultFontAssets());
      await this.fontManager.loadAssetFonts();
    } else {
      // CDNからフォントアセットを読み込む
      this.providers.push(
        TypstSnippet.preloadFontAssets({
          assets: this.plugin.settings.font.assetFontTypes,
        }),
      );
    }

    // ユーザーフォントを読み込む
    await this.fontManager.loadImportedFonts();

    // 初期化
    const provides = this.providers.flatMap((provider) => provider.provides);
    await (await $typst.getCompiler()).init({
      beforeBuild: provides,
      getModule: async (): Promise<WebAssembly.Module> =>
        await WebAssembly.compile(
          await this.plugin.app.vault.adapter.readBinary(
            `${this.plugin.pluginDirPath}/compiler.wasm`,
          ),
        ),
    });

    // ? 副作用(get_font_infoの有効化)のため
    $typst.addSource('/main.typ', '');
    await $typst.vector();

    // メモリクリア
    $typst.resetShadow();
  }

  async registerOnce() {
    // コードブロックプロセッサーをオーバライド
    for (const processor of this.plugin.settings.processor.codeblock
      .processors) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          processor.id,
          (source, el, _ctx) => {
            return this.renderCodeblock(source, el, processor.id);
          },
        );
      } catch {
        new Notice(`Already registered codeblock language: ${processor.id}`);
      }
    }

    // MathJaxをオーバライド
    window.MathJax!.tex2chtml = (e: string, r: { display?: boolean }) => {
      // タグ名, クラス名, 属性がこれ以外だと認識されない
      const container = document.createElement('mjx-container');
      container.className = 'Mathjax';
      container.setAttribute('jax', 'CHTML');

      return r.display
        ? this.renderDisplay(e, container)
        : this.renderInline(e, container);
    };
  }

  renderInline(code: string, containerEl: HTMLElement) {
    const processor =
      this.plugin.settings.processor.inline.processors.find((processor) =>
        code.startsWith(`${processor.id}`),
      ) ?? DEFAULT_SETTINGS.processor.inline.processors.at(-1)!;
    code = code.slice(processor.id.length);

    if (processor.renderingEngine === 'mathjax')
      return this.plugin.originalTex2chtml(code, {
        display: false,
      });

    containerEl.addClass(
      'typstmate-inline',
      `typstmate-style-${processor.styling}`,
      `typstmate-id-${processor.id}`,
    );

    return this.process(code, processor, containerEl);
  }

  renderDisplay(code: string, containerEl: HTMLElement) {
    const processor =
      this.plugin.settings.processor.display.processors.find((processor) =>
        code.startsWith(`${processor.id}`),
      ) ?? DEFAULT_SETTINGS.processor.display.processors.at(-1)!;
    code = code.slice(processor.id.length);

    if (processor.renderingEngine === 'mathjax')
      return this.plugin.originalTex2chtml(code, {
        display: true,
      });

    containerEl.addClass(
      'typstmate-display',
      `typstmate-style-${processor.styling}`,
      `typstmate-id-${processor.id}`,
    );

    return this.process(code, processor, containerEl);
  }

  renderCodeblock(code: string, containerEl: HTMLElement, id: string) {
    const processor =
      this.plugin.settings.processor.codeblock.processors.find(
        (processor) => processor.id === id,
      ) ?? DEFAULT_SETTINGS.processor.codeblock.processors.at(-1)!;

    if (processor.renderingEngine === 'mathjax')
      return this.plugin.originalTex2chtml(code, {
        display: true,
      });

    containerEl.addClass(
      'typstmate-codeblock',
      `typstmate-style-${processor.styling}`,
      `typstmate-id-${processor.id}`,
    );

    switch (processor.styling) {
      case 'codeblock': {
        containerEl.addClass(
          'HyperMD-codeblock',
          'HyperMD-codeblock-bg',
          'cm-line',
        );
        break;
      }
    }

    return this.process(code, processor, containerEl);
  }

  process(code: string, processor: Processor, containerEl: HTMLElement) {
    setTimeout(() => {
      const formattedCode = processor.format
        .replace('{CODE}', code)
        .replace(
          '{FONTSIZE}',
          this.plugin.app.vault.config.baseFontSize?.toString() || '16',
        );

      this.counter++;
      const id = this.counter;

      $typst.addSource(`/${id}.typ`, formattedCode);
      $typst
        .svg({ mainFilePath: `/${id}.typ` })
        .then((svg) => {
          containerEl.innerHTML = svg;
        })
        .catch((err) => {
          if (this.plugin.settings.processor.enableMathjaxFallback) {
            containerEl.innerHTML = this.plugin.originalTex2chtml(code, {
              display: false,
            }).innerHTML;
          } else {
            containerEl.replaceChildren(errorHandler(err as string));
          }
        });
    }, 0);

    return containerEl;
  }
}

interface TypstDiagnostic {
  message: string;
  hints: string[];
}

function parseError(err: string): TypstDiagnostic {
  const field = err.match(/\{[^{}]*\}/)![0];
  const sanitizedField = field
    .replace(/Span\((\d+)\)/g, '$1')
    .replace(/trace:\s*\[[^\]]*\],?/g, '')
    .replace(/severity:\s*([A-Za-z]+)/, 'severity: "$1"');

  return JSON5.parse(sanitizedField) as TypstDiagnostic;
}

function errorHandler(err: string): HTMLElement {
  const diagnostic = parseError(err);
  const alertMessage = diagnostic.hints
    .map((hint: string, i: number) => `${i + 1}. ${hint}`)
    .join('\n\n');

  const span = document.createElement('span');
  span.innerHTML =
    `${diagnostic.message}` +
    (diagnostic.hints.length !== 0
      ? ` [${diagnostic.hints.length} hints]`
      : '');
  span.className = 'typstmate-error';

  if (diagnostic.hints.length !== 0)
    span.addEventListener('click', () => alert(alertMessage));

  return span;
}
