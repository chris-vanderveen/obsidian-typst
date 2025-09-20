import type { Editor } from 'obsidian';
import type { Position } from '@/core/editor';
import type { Snippet } from '@/libs/snippet';
import type ObsidianTypstMate from '@/main';

import './snippet-suggest.css';

export default class SnippetSuggestElement extends HTMLElement {
  plugin!: ObsidianTypstMate;
  container!: HTMLDivElement;

  snippets: Snippet[];
  selectedIndex: number = -1;

  isOpen: boolean = false;
  private outsideListener = (e: MouseEvent) => this.onOutsideMouseDown(e);
  private keyListener = (e: KeyboardEvent) => this.onKeyDown(e);

  editor?: Editor;
  prevEl?: HTMLElement;

  constructor() {
    super();
    this.snippets = [];
  }

  render(position: Position, editor: Editor) {
    this.prevEl = document.activeElement as HTMLElement;
    this.style.setProperty('--preview-left', `${position.x}px`);
    this.style.setProperty('--preview-top', `${position.y}px`);
    if (!this.isOpen) this.open();
    this.container.empty();
    const items = this.container.createEl('div', { cls: 'items' });
    this.editor = editor;

    this.snippets.forEach((snippet, index) => {
      const item = items.createEl('div', { cls: 'item' });
      const svg = item.createEl('div', { cls: 'svg' });
      item.className = 'item';
      item.dataset.index = index.toString();
      item.addEventListener('click', () => {
        this.prevEl?.focus();
        this.plugin.editorHelper.applySnippet(editor, snippet);
        this.close();
      });
      item.addEventListener('mouseover', () => {
        this.selectedIndex = Number(item.dataset.index);
        this.updateSelectionVisual();
        this.scrollSelectedIntoView();
      });

      let content: string = snippet.content;
      if (snippet.script) {
        item.append(`📦${snippet.name} (${snippet.category})`);
      } else {
        switch (snippet.kind) {
          case 'inline':
            content = `${snippet.id}${snippet.id === '' ? '' : ':'}${content}`;
            break;
          case 'display':
            content = `${snippet.id}\n${content}\n`;
            break;
          case 'codeblock':
            content = `${snippet.id}\n${content}\n`;
            break;
        }
        this.plugin.typstManager.render(content, svg, snippet.kind);
        item.appendChild(document.createTextNode(`${snippet.name} (${snippet.category})`));
        item.appendChild(svg);
      }
      this.container.appendChild(item);
    });

    return this;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.selectedIndex = -1;
    this.removeClass('typstmate-hidden');
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
    if (this.snippets.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        this.focus();
        if (this.selectedIndex === -1) this.selectedIndex = 0;
        else this.selectedIndex = (this.selectedIndex + 1) % this.snippets.length;
        this.updateSelectionVisual();
        this.scrollSelectedIntoView();
        return;
      }

      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        this.focus();
        if (this.selectedIndex === -1) this.selectedIndex = this.snippets.length - 1;
        else this.selectedIndex = (this.selectedIndex - 1 + this.snippets.length) % this.snippets.length;
        this.updateSelectionVisual();
        this.scrollSelectedIntoView();
        return;
      }

      case 'Tab':
      case 'ArrowRight': {
        e.preventDefault();
        this.prevEl?.focus();
        if (this.selectedIndex >= 0)
          this.plugin.editorHelper.complementSnippet(this.editor!, this.snippets[this.selectedIndex]!);
        else this.plugin.editorHelper.complementSnippet(this.editor!, this.snippets[0]!);
        return;
      }
      case 'Enter': {
        e.preventDefault();
        this.prevEl?.focus();
        let snippet: Snippet;
        if (this.selectedIndex >= 0) {
          snippet = this.snippets[this.selectedIndex]!;
        } else {
          snippet = this.snippets[0]!;
        }
        if (snippet.script && this.plugin.editorHelper.value === undefined) {
          this.plugin.editorHelper.complementSnippet(this.editor!, snippet);
          const cursor = this.editor!.getCursor();
          this.editor?.replaceRange('()', {
            line: cursor.line,
            ch: cursor.ch - 1,
          });
        } else {
          this.plugin.editorHelper.applySnippet(this.editor!, snippet);
          this.close();
        }
        return;
      }

      case 'Shift': {
        e.preventDefault();
        return;
      }

      default: {
        if (e.key === '(') {
          e.preventDefault();
          const cursor = this.editor!.getCursor();
          this.editor?.replaceRange('()', {
            line: cursor.line,
            ch: cursor.ch - 1,
          });
        } else if (e.key.length === 1) {
          if (e.key === ' ' && this.plugin.editorHelper.value === undefined) {
            this.prevEl?.focus();
            this.blur();
            this.close();
            return;
          }
          e.preventDefault();
          const cursor = this.editor!.getCursor();
          this.editor?.replaceRange(e.key, {
            line: cursor.line,
            ch: cursor.ch - (this.plugin.editorHelper.value ? 2 : 1),
          });
          return;
        } else if (e.key === 'Backspace') {
          // @ のみのとき
          if (this.plugin.editorHelper.word === undefined) break;

          // @直前を消す
          e.preventDefault();
          const cursor = this.editor!.getCursor();
          this.plugin.editorHelper.replaceLength(
            this.editor!,
            '',
            {
              line: cursor.line,
              ch: cursor.ch - (this.plugin.editorHelper.value ? 3 : 2),
            },
            this.plugin.editorHelper.value === '()' ? 2 : 1,
          );
          return;
        } else if (e.key === 'Shift') {
          e.preventDefault();
          return;
        }
      }
    }

    this.prevEl?.focus();
    this.blur();
    this.close();
  }

  close() {
    this.isOpen = false;
    this.addClass('typstmate-hidden');
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
    document.removeEventListener('mousedown', this.outsideListener);
    window.removeEventListener('keydown', this.keyListener);
  }
}
