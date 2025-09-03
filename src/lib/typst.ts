import { Notice } from 'obsidian';

import { DEFAULT_SETTINGS } from '@/core/settings';
import type ObsidianTypstMate from '@/main';
import type { Processor } from './processor';
import { unzip } from './util';
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
        format: this.format(p, ''),
        styling: p.styling,
        renderingEngine: p.renderingEngine,
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

    // ? シングルスレッドなのでawaitを無くしても問題ない. 起動を高速化する
    this.plugin.typst.store({ fonts, processors, sources });
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
          this.plugin.settings.processor.inline.processors.find((p) =>
            code.startsWith(`${p.id}`),
          ) ?? DEFAULT_SETTINGS.processor.inline.processors.at(-1)!;
        if (processor.id.length !== 0)
          code = code.slice(processor.id.length + 1);

        break;
      case 'display':
        processor =
          this.plugin.settings.processor.display.processors.find((p) =>
            code.startsWith(`${p.id}`),
          ) ?? DEFAULT_SETTINGS.processor.display.processors.at(-1)!;
        if (processor.id.length !== 0) code = code.slice(processor.id.length);

        break;
      default:
        processor =
          this.plugin.settings.processor.codeblock.processors.find(
            (p) => p.id === kind,
          ) ?? DEFAULT_SETTINGS.processor.codeblock.processors.at(-1)!;

        if (processor.styling === 'codeblock')
          containerEl.addClass(
            'HyperMD-codeblock',
            'HyperMD-codeblock-bg',
            'cm-line',
          );

        kind = 'codeblock';
    }

    if (processor.renderingEngine === 'mathjax')
      return this.plugin.originalTex2chtml(code, {
        display: kind !== 'inline',
      });

    containerEl.addClass(
      `typstmate-${kind}`,
      `typstmate-style-${processor.styling}`,
      `typstmate-id-${processor.id}`,
    );
    const formattedCode = this.format(processor, code);

    let result: SVGResult | Promise<SVGResult>;
    try {
      result = this.plugin.typst.svg(formattedCode, kind, processor.id);
      if (result instanceof Promise) {
        result
          .then((result: SVGResult) => this.postProcess(result, containerEl))
          .catch((err: Diagnostic[]) =>
            this.handleError(err, containerEl, code, kind),
          );
      } else this.postProcess(result, containerEl);
    } catch (err) {
      this.handleError(err as Diagnostic[], containerEl, code, kind);
      return containerEl;
    }

    return containerEl;
  }

  private format(processer: Processor, code: string) {
    return processer.noPreamble
      ? processer.format.replace('{CODE}', code)
      : `${this.plugin.settings.preamble}\n${processer.format.replace(
          '{CODE}',
          code,
        )}`;
  }

  private postProcess(result: SVGResult, containerEl: HTMLElement) {
    if (this.plugin.settings.failOnWarning && result.diags.length !== 0)
      throw result.diags;

    containerEl.innerHTML = result.svg.replaceAll(
      '#000000',
      this.plugin.settings.autoBaseColor
        ? this.plugin.baseColor
        : this.plugin.settings.baseColor,
    );
  }

  private handleError(
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
