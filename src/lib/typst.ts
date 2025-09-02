import { Notice } from 'obsidian';

import { DEFAULT_SETTINGS } from '@/core/settings';
import { unzip } from '@/lib/util';
import type ObsidianTypstMate from '@/main';
import type { Processor } from './processor';
import './typst.css';
import { DiagnosticModal } from '@/core/modals/diagnostic';
import type { Diagnostic, SVGResult } from './worker';

export default class TypstManager {
  plugin: ObsidianTypstMate;

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;
  }

  async init() {
    await this.plugin.typst.init(this.plugin.app.vault.config.baseFontSize);

    const fontPaths = (
      await this.plugin.app.vault.adapter.list(this.plugin.fontsDirPath)
    ).files.filter((file) => file.endsWith('.font'));
    const fonts = (
      await Promise.all(
        fontPaths.map((fontPath) =>
          this.plugin.app.vault.adapter.readBinary(fontPath).catch(() => {
            new Notice(`Failed to load font: ${fontPath.split('/').pop()}`);
          }),
        ),
      )
    ).filter((font) => font !== undefined);

    const processors = ['inline', 'display', 'codeblock'].flatMap((kind) =>
      this.plugin.settings.processor[
        kind as 'inline' | 'display' | 'codeblock'
      ].processors.map((p) => ({
        kind,
        id: p.id,
        format: p.format.replace('{CODE}', ''),
      })),
    );

    // キャッシュ
    const sources: Map<string, Uint8Array> = new Map();
    const cachePaths = (
      await this.plugin.app.vault.adapter.list(this.plugin.cachesDirPath)
    ).files.filter((file) => file.endsWith('.cache'));
    for (const cachePath of cachePaths) {
      try {
        const cacheMap = unzip(
          await this.plugin.app.vault.adapter.readBinary(cachePath),
        );
        cacheMap.forEach((data, path) => {
          sources.set(`@${path}`, new Uint8Array(data!));
        });
      } catch {
        new Notice(`Failed to load cache: ${cachePath.split('/').pop()}`);
      }
    }

    await this.plugin.typst.store({ fonts, processors, sources });
  }

  async registerOnce() {
    // コードブロックプロセッサーをオーバライド
    for (const processor of this.plugin.settings.processor.codeblock
      .processors) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          processor.id,
          (source, el, _ctx) => {
            return this.render(source, el, processor.id);
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
        ? this.render(e, container, 'display')
        : this.render(e, container, 'inline');
    };
  }

  render(code: string, containerEl: HTMLElement, kind: string) {
    let processor: Processor;
    switch (kind) {
      case 'inline':
        processor =
          this.plugin.settings.processor.inline.processors.find((processor) =>
            code.startsWith(`${processor.id}`),
          ) ?? DEFAULT_SETTINGS.processor.inline.processors.at(-1)!;
        if (processor.id.length !== 0)
          code = code.slice(processor.id.length + 1);

        containerEl.addClass(
          'typstmate-inline',
          `typstmate-style-${processor.styling}`,
          `typstmate-id-${processor.id}`,
        );
        break;
      case 'display':
        processor =
          this.plugin.settings.processor.display.processors.find((processor) =>
            code.startsWith(`${processor.id}`),
          ) ?? DEFAULT_SETTINGS.processor.display.processors.at(-1)!;
        if (processor.id.length !== 0) code = code.slice(processor.id.length);

        containerEl.addClass(
          'typstmate-display',
          `typstmate-style-${processor.styling}`,
          `typstmate-id-${processor.id}`,
        );
        break;
      default:
        processor =
          this.plugin.settings.processor.codeblock.processors.find(
            (processor) => processor.id === kind,
          ) ?? DEFAULT_SETTINGS.processor.codeblock.processors.at(-1)!;

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

        kind = 'codeblock';
    }

    if (processor.renderingEngine === 'mathjax')
      return this.plugin.originalTex2chtml(code, {
        display: kind !== 'inline',
      });

    const formattedCode = processor.format.replace('{CODE}', code);

    const result = this.plugin.typst.svg(formattedCode, kind, processor.id);
    if (result instanceof Promise) {
      result
        .then((result: SVGResult) => this.postProcesser(result, containerEl))
        .catch((err: Diagnostic[]) =>
          this.errorHandler(err, containerEl, code, kind),
        );
    } else {
      try {
        this.postProcesser(result, containerEl);
      } catch (err) {
        this.errorHandler(err as Diagnostic[], containerEl, code, kind);
      }
    }

    return containerEl;
  }

  postProcesser(result: SVGResult, containerEl: HTMLElement) {
    if (this.plugin.settings.failOnWarning && result.diags.length !== 0)
      throw result.diags;

    containerEl.innerHTML = result.svg.replaceAll(
      '#000000',
      this.plugin.settings.autoBaseColor
        ? this.plugin.baseColor
        : this.plugin.settings.baseColor,
    );
  }

  errorHandler(
    err: Diagnostic[],
    containerEl: HTMLElement,
    code: string,
    kind: string,
  ) {
    if (this.plugin.settings.enableMathjaxFallback) {
      containerEl.replaceChildren(
        this.plugin.originalTex2chtml(code, {
          display: kind !== 'inline',
        }),
      );
    } else {
      const span = document.createElement('span');
      span.className = 'typstmate-error';
      span.textContent =
        `${err[0]?.message}` +
        (err[0]?.hints.length !== 0 ? ` [${err[0]?.hints.length} hints]` : '');

      if (err[0]?.hints.length !== 0)
        span.addEventListener('click', () =>
          new DiagnosticModal(this.plugin.app, err).open(),
        );
      containerEl.replaceChildren(span);
    }
  }
}
