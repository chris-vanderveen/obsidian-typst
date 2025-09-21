import type { Position } from '@/core/editor';

import type ObsidianTypstMate from '@/main';

import './inline-preview.css';

export default class InlinePreviewElement extends HTMLElement {
  plugin!: ObsidianTypstMate;

  async render(position: Position, content: string) {
    this.style.setProperty('--preview-left', `${position.x}px`);
    this.style.setProperty('--preview-top', `${position.y}px`);

    const html = window.MathJax!.tex2chtml(content, { display: false });
    this.replaceChildren(html);

    this.show();
  }
}
