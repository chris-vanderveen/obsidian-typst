import type { Editor } from 'obsidian';

import type ObsidianTypstMate from '@/main';
import type { SymbolData } from '@/utils/symbolSearcher';

import type { Position } from '../editor';

import './symbol-suggest.css';

export default class SymbolSuggestElement extends HTMLElement {
  plugin!: ObsidianTypstMate;
  container!: HTMLDivElement;

  symbols: SymbolData[];
  selectedIndex: number = -1;

  isOpen: boolean = false;
  private outsideListener = (e: MouseEvent) => this.onOutsideMouseDown(e);
  private keyListener = (e: KeyboardEvent) => this.onKeyDown(e);

  editor?: Editor;
  prevEl?: HTMLElement;

  constructor() {
    super();
    this.symbols = [];
  }

  render(position: Position, editor: Editor, latex: boolean) {
    this.prevEl = document.activeElement as HTMLElement;
    this.style.setProperty('--preview-left', `${position.x}px`);
    this.style.setProperty('--preview-top', `${position.y}px`);
    if (!this.isOpen) this.open();
    this.container.empty();
    this.editor = editor;

    this.symbols.forEach((symbol, index) => {
      const item = this.container.createEl('div', { cls: 'item typstmate-symbol' });
      item.dataset.index = index.toString();

      item.addClass(symbol.kind!);
      if (latex) {
        item.addClass('latex');
        item.textContent = `${symbol.sym}: ${symbol.latexName} (${symbol.mathClass})`;
      } else {
        item.addClass('typst');
        item.textContent = `${symbol.sym}: ${symbol.name} (${symbol.mathClass})`;
      }

      item.addEventListener('click', () => {
        this.prevEl?.focus();
        this.plugin.editorHelper.applySymbol(editor, symbol);
        this.close();
      });
      item.addEventListener('mouseover', () => {
        const handleMouseMove = () => {
          this.selectedIndex = Number(item.dataset.index);
          this.updateSelectionVisual();
          this.scrollSelectedIntoView();
          item.removeEventListener('mousemove', handleMouseMove);
        };

        item.addEventListener('mousemove', handleMouseMove, { once: true });
      });
    });

    return this;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.selectedIndex = -1;
    this.show();
    this.setAttribute('tabindex', '0');
    document.addEventListener('mousedown', this.outsideListener, { capture: true });
    window.addEventListener('keydown', this.keyListener, { capture: true });
  }

  private onOutsideMouseDown(e: MouseEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (!this.contains(target)) {
      this.close();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.isOpen) return;
    if (this.symbols.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        this.focus();
        if (this.selectedIndex === -1) this.selectedIndex = 0;
        else this.selectedIndex = (this.selectedIndex + 1) % this.symbols.length;
        this.updateSelectionVisual();
        this.scrollSelectedIntoView();
        return;
      }

      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        this.focus();
        if (this.selectedIndex === -1) this.selectedIndex = this.symbols.length - 1;
        else this.selectedIndex = (this.selectedIndex - 1 + this.symbols.length) % this.symbols.length;
        this.updateSelectionVisual();
        this.scrollSelectedIntoView();
        return;
      }

      case 'Tab':
      case 'ArrowRight': {
        e.preventDefault();
        this.prevEl?.focus();
        if (this.selectedIndex >= 0)
          this.plugin.editorHelper.complementSymbol(this.editor!, this.symbols[this.selectedIndex]!);
        else this.plugin.editorHelper.complementSymbol(this.editor!, this.symbols[0]!);
        return;
      }
      case 'Enter': {
        this.prevEl?.focus();
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.plugin.editorHelper.applySymbol(this.editor!, this.symbols[this.selectedIndex]!);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          this.plugin.editorHelper.applySymbol(this.editor!, this.symbols[0]!);
        }
        this.close();
        return;
      }

      default:
        break;
    }
  }

  close() {
    this.isOpen = false;
    this.hide();
    document.removeEventListener('mousedown', this.outsideListener, { capture: true });
    window.removeEventListener('keydown', this.keyListener, { capture: true });
  }

  private updateSelectionVisual() {
    if (!this.container) return;
    Array.from(this.container.children).forEach((child) => {
      const el = child as HTMLElement;
      const idx = Number(el.dataset.index);
      if (idx === this.selectedIndex) el.classList.add('selected');
      else el.classList.remove('selected');
    });
  }

  private scrollSelectedIntoView() {
    if (this.selectedIndex < 0) return;
    const el = this.container.querySelector(`.item[data-index="${this.selectedIndex}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  disconnectedCallback() {
    document.removeEventListener('mousedown', this.outsideListener, { capture: true });
    window.removeEventListener('keydown', this.keyListener, { capture: true });
  }
}
