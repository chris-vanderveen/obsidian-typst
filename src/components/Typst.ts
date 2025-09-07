import { DiagnosticModal } from '@/core/modals/diagnostic';
import type { Processor, ProcessorKind } from '@/lib/processor';
import type { Diagnostic, SVGResult } from '@/lib/worker';
import type ObsidianTypstMate from '@/main';

export default class TypstElement extends HTMLElement {
  kind!: ProcessorKind;
  source!: string;
  processor!: Processor;

  renderingFormat!: 'svg';

  plugin!: ObsidianTypstMate;

  async render() {
    const input = this.format();

    try {
      const result = this.plugin.typst.render(
        input,
        this.kind,
        this.processor.id,
        this.renderingFormat,
      );

      if (result instanceof Promise) {
        if (
          this.kind !== 'inline' &&
          this.processor.fitToParentWidth &&
          !this.source.includes('<br>')
        )
          this.plugin.observer.register(
            this,
            (entry: ResizeObserverEntry) => {
              const input =
                `#let WIDTH = ${(entry.contentRect.width * 3) / 4}pt\n` +
                this.format().replace('width: auto', 'width: WIDTH');

              const result = this.plugin.typst.render(
                input,
                this.kind,
                this.processor.id,
                this.renderingFormat,
              ) as Promise<SVGResult>;

              result
                .then((result: SVGResult) => this.postProcess(result))
                .catch((err: Diagnostic[]) => {
                  this.handleError(err);
                });
            },
            300,
          );

        result
          .then((result: SVGResult) => this.postProcess(result))
          .catch((err: Diagnostic[]) => this.handleError(err));
      } else this.postProcess(result);
    } catch (err) {
      this.handleError(err as Diagnostic[]);
    }

    return this;
  }

  format() {
    const formatted = this.processor.format.replace('{CODE}', this.source);

    return (
      this.processor.noPreamble
        ? formatted
        : `${this.plugin.settings.preamble}\n${formatted}`
    ).replaceAll('<br>', '\n');
  }

  postProcess(result: SVGResult) {
    if (this.plugin.settings.failOnWarning && result.diags.length !== 0)
      throw result.diags;

    this.innerHTML = result.svg.replaceAll(
      '#000000',
      this.plugin.settings.autoBaseColor
        ? this.plugin.baseColor
        : this.plugin.settings.baseColor,
    );
  }

  handleError(err: Diagnostic[]) {
    if (this.plugin.settings.enableMathjaxFallback) {
      this.replaceChildren(
        this.plugin.originalTex2chtml(this.source, {
          display: this.kind !== 'inline',
        }),
      );
    } else {
      const diagEl = document.createElement('span');
      diagEl.className = 'typstmate-error';

      diagEl.textContent =
        `${err[0]?.message}` +
        (err[0]?.hints.length !== 0 ? ` [${err[0]?.hints.length} hints]` : '');

      // TODO:
      if (err[0]?.hints.length !== 0)
        diagEl.addEventListener('click', () =>
          new DiagnosticModal(this.plugin.app, err).open(),
        );

      this.replaceChildren(diagEl);
    }
  }
}
