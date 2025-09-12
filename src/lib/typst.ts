import { Notice } from 'obsidian';

import { DEFAULT_SETTINGS } from '@/core/settings';
import type ObsidianTypstMate from '@/main';
import type { Processor, ProcessorKind } from './processor';
import { unzip } from './util';

import './typst.css';
import TypstSVGElement from '@/components/SVG';

function customElementsRedefine(name: string, ctor: typeof HTMLElement) {
  const registry = window.customElements;
  const existing = registry.get(name);

  if (existing && existing !== ctor) {
    Object.setPrototypeOf(existing.prototype, ctor.prototype);
    Object.setPrototypeOf(existing, ctor);
  } else if (!existing) {
    registry.define(name, ctor);
  }
}

export default class TypstManager {
  plugin: ObsidianTypstMate;
  ready = false;

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;
  }

  async init() {
    this.ready = false;
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

    if (this.plugin.settings.skipPreparationWaiting) {
      const result = this.plugin.typst.store({
        fonts,
        processors,
        sources,
      });
      if (result instanceof Promise) {
        result.then(() => {
          this.ready = true;

          document.querySelectorAll('.typstmate-waiting').forEach((el) => {
            this.render(el.textContent!, el, el.getAttribute('kind')!);
          });
        });
      } else this.ready = true;
    } else {
      await this.plugin.typst.store({ fonts, processors, sources });
      this.ready = true;
    }
  }

  async registerOnce() {
    customElementsRedefine('typstmate-svg', TypstSVGElement);

    // コードブロックプロセッサーをオーバライド
    for (const processor of this.plugin.settings.processor.codeblock
      .processors) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          processor.id,
          (source, el, _ctx) => {
            if (!this.ready) {
              el.textContent = source;
              el.addClass('typstmate-waiting');
              el.setAttribute('kind', processor.id);
              return el;
            }

            return this.render(source, el, processor.id);
          },
        );
      } catch {
        new Notice(`Already registered codeblock language: ${processor.id}`);
      }
    }

    // MathJax をオーバライド
    window.MathJax!.tex2chtml = (e: string, r: { display?: boolean }) => {
      // タグ名，クラス名，属性がこれ以外だと認識されないない
      const container = document.createElement('mjx-container');
      container.className = 'Mathjax';
      container.setAttribute('jax', 'CHTML');

      if (!this.ready) {
        container.textContent = e;
        container.addClass('typstmate-waiting');
        container.setAttribute('kind', r.display ? 'display' : 'inline');

        return container;
      }

      return r.display
        ? this.render(e, container, 'display')
        : this.render(e, container, 'inline');
    };
  }

  render(code: string, containerEl: Element, kind: string) {
    // プロセッサーを決定
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

    // レンダリング
    const t = document.createElement('typstmate-svg') as TypstSVGElement;
    t.plugin = this.plugin;
    t.kind = kind as ProcessorKind;
    t.source = code;
    t.processor = processor;
    containerEl.appendChild(t);
    t.render();

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
}
