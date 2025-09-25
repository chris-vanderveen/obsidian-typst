import type ObsidianTypstMate from '@/main';
import type { Position } from '../editor';

import './inline-preview.css';

// TODO: RTl の対応

export default class InlinePreviewElement extends HTMLElement {
  plugin!: ObsidianTypstMate;

  private outsideListener = (e: MouseEvent) => this.onOutsideMouseDown(e);

  async render(position: Position, content: string) {
    this.style.setProperty('--preview-left', `${position.x}px`);
    this.style.setProperty('--preview-top', `${position.y}px`);
    document.addEventListener('mousedown', this.outsideListener, { capture: true });

    const html = window.MathJax!.tex2chtml(content, { display: false });
    this.replaceChildren(html);
    this.show();
  }

  private onOutsideMouseDown(e: MouseEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (!this.contains(target)) this.close();
    e.preventDefault();
  }

  close() {
    this.hide();
    document.removeEventListener('mousedown', this.outsideListener, { capture: true });
  }
}
