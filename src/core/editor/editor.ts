import { type Editor, type EditorPosition, MarkdownView, Notice } from 'obsidian';

import { DEFAULT_FONT_SIZE } from '@/constants';
import type { Snippet } from '@/libs/snippet';
import type { BracketPair } from '@/libs/worker';
import type ObsidianTypstMate from '@/main';
import { type SymbolData, searchSymbols } from '@/utils/symbolSearcher';
import type InlinePreviewElement from './elements/InlinePreview';
import type SnippetSuggestElement from './elements/SnippetSuggest';
import type SymbolSuggestElement from './elements/SymbolSuggest';

import './editor.css';
import VISUAL_SNIPPETS_DATA from './visualSnippetsData.json';

const VISULA_SNIPPETS_KEYS = Object.keys(VISUAL_SNIPPETS_DATA);

export class EditorHelper {
  private plugin: ObsidianTypstMate;

  private inlinePreviewEl: InlinePreviewElement;
  private snippetSuggestEl: SnippetSuggestElement;
  private symbolSuggestEl: SymbolSuggestElement;

  startWordIndex: number | null = null;
  wordLine: number | null = null;
  word?: string;
  value?: string;

  startDollarIndex: number | null = null;
  startSymbolIndex: number | null = null;
  symbolLine: number | null = null;
  symbol?: string;

  editor?: Editor;

  beforeBracketPairs?: BracketPair[];
  beforeInlineMathContent?: InlineMathContentResult;
  beforeDisplayMathContent?: DisplayMathContentResult;

  keyListener = (e: KeyboardEvent) => this.onKeyDown(e);
  mouseListener = (e: MouseEvent) => this.onMouseDown(e);

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;

    this.inlinePreviewEl = document.createElement('typstmate-inline-preview') as InlinePreviewElement;
    this.inlinePreviewEl.plugin = this.plugin;
    this.inlinePreviewEl.addClasses(['typstmate-inline-preview', 'typstmate-temporary']);

    this.snippetSuggestEl = document.createElement('typstmate-snippets') as SnippetSuggestElement;
    this.snippetSuggestEl.plugin = this.plugin;
    this.snippetSuggestEl.container = document.createElement('div');
    this.snippetSuggestEl.addClasses(['typstmate-snippets', 'typstmate-temporary']);
    this.snippetSuggestEl.appendChild(this.snippetSuggestEl.container);

    this.symbolSuggestEl = document.createElement('typstmate-symbols') as SymbolSuggestElement;
    this.symbolSuggestEl.plugin = this.plugin;
    this.symbolSuggestEl.container = document.createElement('div');
    this.symbolSuggestEl.container.addClass('container');
    this.symbolSuggestEl.addClasses(['typstmate-symbols', 'typstmate-temporary']);
    this.symbolSuggestEl.appendChild(this.symbolSuggestEl.container);

    document.addEventListener('keydown', this.keyListener, { capture: true });
    document.addEventListener('mousedown', this.mouseListener, { capture: true });

    this.plugin.app.workspace.containerEl.appendChild(this.inlinePreviewEl);
    this.plugin.app.workspace.containerEl.appendChild(this.snippetSuggestEl);
    this.plugin.app.workspace.containerEl.appendChild(this.symbolSuggestEl);
  }

  close() {
    this.hideAll();
    document.removeEventListener('keydown', this.keyListener, { capture: true });
    document.removeEventListener('mousedown', this.mouseListener, { capture: true });
  }

  private async onKeyDown(e: KeyboardEvent) {
    if (this.snippetSuggestEl.isOpen || this.symbolSuggestEl.isOpen) return; // サジェストが開いている
    if (!isActiveMathExists()) return;
    if (!this.editor) this.editor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!this.editor) return;
    switch (e.key) {
      // Tabout
      case 'Tab': {
        if (!getSelection()!.isCollapsed) break; // 選択されている

        const cursor = this.editor?.getCursor();
        if (!cursor) break;
        let line = cursor.line;

        let lineText = this.editor?.getLine(line);
        let cursorIndex = lineText?.indexOf('#CURSOR');
        // ? 初めの #CURSOR は別で置き換わるので, cursorIndex === 0 は気にしなくていい
        if (!cursorIndex) break;

        // ない場合は次の行も確認
        if (cursorIndex === -1) {
          line++;

          lineText = this.editor?.getLine(line);
          cursorIndex = lineText?.indexOf('#CURSOR');
          if (!cursorIndex) break;

          // なければ次の行に移動
          if (cursorIndex === -1) {
            e.preventDefault();
            this.editor?.setCursor({
              line,
              ch: 0,
            });
            break;
          }
        }

        // ある場合は置き換える
        e.preventDefault();
        this.replaceLength(
          '',
          {
            line,
            ch: cursorIndex,
          },
          7,
        );
        this.editor?.setCursor({
          line,
          ch: cursorIndex,
        });
        break;
      }
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowLeft': {
        setTimeout(async () => {
          if (!getSelection()!.isCollapsed) return;

          const display = isActiveDisplayMathExists();
          if (display) await this.calcDisplayMathBracketPairs(this.editor!.getCursor());
          else await this.calcInlineMathBracketPairs(this.editor!.getCursor());
          this.highlightEnclosingBracketPair(this.editor!.getCursor()!, display);
        }, 0);
        break;
      }
      // Visual Snippets
      default: {
        if (VISULA_SNIPPETS_KEYS.includes(e.key) && !e.ctrlKey && !e.metaKey) {
          const selection = this.editor?.getSelection();
          if (!selection) break;
          e.preventDefault();
          const data = (VISUAL_SNIPPETS_DATA as { [key: string]: VisualSnippetData })[e.key]!;
          this.editor?.replaceSelection(data.content.replaceAll('$1', selection));
          if (data.offset) {
            this.editor?.setCursor({
              line: this.editor!.getCursor().line,
              ch: this.editor!.getCursor().ch - data.offset,
            });
          }
        }
      }
    }
    setTimeout(async () => {
      if (!getSelection()!.isCollapsed) return;

      const display = isActiveDisplayMathExists();
      if (display) await this.calcDisplayMathBracketPairs(this.editor!.getCursor());
      else await this.calcInlineMathBracketPairs(this.editor!.getCursor());
      this.highlightBracketPairs(display);
      this.highlightEnclosingBracketPair(this.editor!.getCursor()!, display);
    }, 0);
  }

  private async onMouseDown(_e: MouseEvent) {
    if (!isActiveMathExists()) return;

    let highlighted = false;
    // 括弧の計算
    const cursor = this.editor!.getCursor();
    const display = isActiveDisplayMathExists();
    if (display) await this.calcDisplayMathBracketPairs(cursor);
    else await this.calcInlineMathBracketPairs(cursor);

    // ? 特にインライン数式で, クリックすると要素が再生成されるため
    const observer = new MutationObserver(() => {
      if (!isActiveMathExists()) return;
      observer.disconnect();
      highlighted = true;
      this.highlightBracketPairs(display);
      this.highlightEnclosingBracketPair(this.editor!.getCursor()!, display);
    });
    if (!this.editor) this.editor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!this.editor) return;
    observer.observe(this.editor.containerEl, {
      childList: true,
      subtree: true,
    });
    setTimeout(() => {
      observer.disconnect();
      if (!highlighted) {
        this.highlightBracketPairs(display);
        this.highlightEnclosingBracketPair(this.editor!.getCursor()!, display);
      }
    }, 500);
  }

  async calcInlineMathBracketPairs(cursor: EditorPosition) {
    const inlineMathContent = this.extractInlineMathContentInsideDollarOutsideCursor(cursor);
    if (inlineMathContent === this.beforeInlineMathContent) return;
    this.beforeInlineMathContent = inlineMathContent;
    if (!inlineMathContent) return this.removeBracketHighlights();
    this.beforeBracketPairs = await this.plugin.typst.findBracketPairs(inlineMathContent.content);
  }

  async calcDisplayMathBracketPairs(cursor: EditorPosition) {
    const displayMathContent = this.extractDisplayMathContentInsideTwoDollarsOutsideCursor(cursor);
    if (displayMathContent === this.beforeDisplayMathContent) return;
    this.beforeDisplayMathContent = displayMathContent;
    if (!displayMathContent) return this.removeBracketHighlights();
    this.beforeBracketPairs = await this.plugin.typst.findBracketPairs(displayMathContent.content);
  }

  calcInlineMathCursorEnclosure(cursor: EditorPosition) {
    if (!this.beforeBracketPairs) return;
    if (!this.beforeInlineMathContent) return;

    const ch = cursor.ch - this.beforeInlineMathContent.startIndex;

    const candidates = this.beforeBracketPairs.filter((pair) => pair.open_column < ch && ch <= pair.close_column);
    if (!candidates.length) return;

    const shortest = candidates.reduce((a, b) =>
      a.open_column - a.close_column < b.open_column - b.close_column ? b : a,
    );

    return shortest;
  }

  calcDisplayMathCursorEnclosure(cursor: EditorPosition) {
    if (!this.beforeBracketPairs) return;
    if (!this.beforeDisplayMathContent) return;

    let ch = cursor.ch;
    if (cursor.line === this.beforeDisplayMathContent.startLine) ch -= this.beforeDisplayMathContent.startIndex;
    const line = cursor.line - this.beforeDisplayMathContent.startLine;

    const byte = this.calc_byte_pos(this.beforeDisplayMathContent.content, line, ch);

    const candidates = this.beforeBracketPairs.filter((pair) => pair.open_byte < byte && byte <= pair.close_byte);
    if (!candidates.length) return;

    const shortest = candidates.reduce((a, b) => (a.open_byte - a.close_byte < b.open_byte - b.close_byte ? b : a));

    return shortest;
  }

  private calc_byte_pos(src: string, target_line: number, target_column: number) {
    if (target_line < 0 || target_column < 0) return 0;

    const lines = src.split('\n');
    if (target_line >= lines.length) return src.length;

    // 対象行までのバイト数
    let byteIndex = 0;
    for (let i = 0; i < target_line; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      byteIndex += this.calculateUtf8Bytes(line) + 1;
    }

    // 対象行内の対象カラムまでのバイト数
    const targetLine = lines[target_line];
    if (!targetLine || target_column >= targetLine.length) {
      return byteIndex + this.calculateUtf8Bytes(targetLine || '');
    }

    // 対象カラムまでのバイト数
    let currentColumn = 0;
    let currentByteIndex = 0;

    for (let i = 0; i < targetLine.length; i++) {
      if (currentColumn >= target_column) break;

      const codePoint = targetLine.codePointAt(i);
      if (codePoint === undefined) break;

      const byteLength = this.getUtf8ByteLength(codePoint);

      if (currentColumn + 1 > target_column) break;

      currentColumn++;
      currentByteIndex += byteLength;

      if (codePoint > 0xffff) {
        i++;
      }
    }

    return byteIndex + currentByteIndex;
  }

  private calculateUtf8Bytes(str: string): number {
    let totalBytes = 0;
    for (let i = 0; i < str.length; i++) {
      const codePoint = str.codePointAt(i);
      if (codePoint === undefined) break;
      totalBytes += this.getUtf8ByteLength(codePoint);
      if (codePoint > 0xffff) i++;
    }
    return totalBytes;
  }

  private getUtf8ByteLength(codePoint: number): number {
    if (codePoint <= 0x7f) return 1;
    if (codePoint <= 0x7ff) return 2;
    if (codePoint <= 0xffff) return 3;
    return 4;
  }

  async highlightBracketPairs(display: boolean) {
    if (!isActiveMathExists()) return this.removeBracketHighlights();

    const cursor = this.editor?.getCursor();
    if (!cursor) return;
    this.removeParentBracketHighlights();
    if (display) this.highlightBracketPairsDisplayMath();
    else this.highlightBracketPairsInlineMath();
  }

  private removeBracketHighlights() {
    this.editor?.removeHighlights('typstmate-bracket-paren');
    this.editor?.removeHighlights('typstmate-bracket-bracket');
    this.editor?.removeHighlights('typstmate-bracket-brace');
  }

  private highlightBracketPairsInlineMath() {
    if (!this.beforeInlineMathContent) return;

    this.removeBracketHighlights();

    // すべての括弧をハイライト
    this.beforeBracketPairs?.forEach((pair) => {
      this.highlightLength(
        1,
        [
          {
            line: this.beforeInlineMathContent!.startLine + pair.open_line,
            ch: this.beforeInlineMathContent!.startIndex + pair.open_column,
          },
        ],
        `typstmate-bracket-${pair.kind}`,
        false,
      );
      this.highlightLength(
        1,
        [
          {
            line: this.beforeInlineMathContent!.startLine + pair.close_line,
            ch: this.beforeInlineMathContent!.startIndex + pair.close_column,
          },
        ],
        `typstmate-bracket-${pair.kind}`,
        false,
      );
    });
  }

  private highlightBracketPairsDisplayMath() {
    if (!this.beforeDisplayMathContent) return;
    this.removeBracketHighlights();

    if (!this.beforeBracketPairs) return;

    // すべての括弧をハイライト（正しい行と位置に）
    for (const pair of this.beforeBracketPairs) {
      if (pair.open_line === 0) pair.open_column += this.beforeDisplayMathContent.startIndex;
      if (pair.close_line === 0) pair.close_column += this.beforeDisplayMathContent.startIndex;
      this.highlightLength(
        1,
        [{ line: this.beforeDisplayMathContent.startLine + pair.open_line, ch: pair.open_column }],
        `typstmate-bracket-${pair.kind}`,
        false,
      );
      this.highlightLength(
        1,
        [{ line: this.beforeDisplayMathContent.startLine + pair.close_line, ch: pair.close_column }],
        `typstmate-bracket-${pair.kind}`,
        false,
      );
    }
  }

  highlightEnclosingBracketPair(cursor: EditorPosition, display: boolean) {
    if (display) this.highlightEnclosingBracketPairDisplayMath(cursor);
    else this.highlightEnclosingBracketPairInlineMath(cursor);
  }

  private removeParentBracketHighlights() {
    this.editor?.removeHighlights('typstmate-bracket-enclosing-paren');
    this.editor?.removeHighlights('typstmate-bracket-enclosing-bracket');
    this.editor?.removeHighlights('typstmate-bracket-enclosing-brace');
  }

  private highlightEnclosingBracketPairInlineMath(cursor: EditorPosition) {
    if (!this.beforeInlineMathContent) return;

    const bracket = this.calcInlineMathCursorEnclosure(cursor);
    this.removeParentBracketHighlights();
    if (!bracket) return;
    this.highlightLength(
      1,
      [{ line: cursor.line, ch: this.beforeInlineMathContent!.startIndex + bracket.open_column }],
      `typstmate-bracket-enclosing-${bracket.kind}`,
      false,
    );
    this.highlightLength(
      1,
      [{ line: cursor.line, ch: this.beforeInlineMathContent!.startIndex + bracket.close_column }],
      `typstmate-bracket-enclosing-${bracket.kind}`,
      false,
    );
  }

  private highlightEnclosingBracketPairDisplayMath(cursor: EditorPosition) {
    if (!this.beforeDisplayMathContent) return;

    const bracket = this.calcDisplayMathCursorEnclosure(cursor);

    this.removeParentBracketHighlights();
    if (!bracket) return;
    if (bracket.open_line === 0) bracket.open_column += this.beforeDisplayMathContent.startIndex;
    if (bracket.close_line === 0) bracket.close_column += this.beforeDisplayMathContent.startIndex;

    this.highlightLength(
      1,
      [
        {
          line: this.beforeDisplayMathContent.startLine + bracket.open_line,
          ch: bracket.open_column,
        },
      ],
      `typstmate-bracket-enclosing-${bracket.kind}`,
      false,
    );
    this.highlightLength(
      1,
      [
        {
          line: this.beforeDisplayMathContent.startLine + bracket.close_line,
          ch: bracket.close_column,
        },
      ],
      `typstmate-bracket-enclosing-${bracket.kind}`,
      false,
    );
  }

  onEditorChange(editor: Editor, _markdownView: MarkdownView) {
    this.editor = editor;
    if (!isActiveMathExists()) return this.hideAll();
    if (!getSelection()!.isCollapsed) return this.hideSuggests(); // 選択されている
    if (!this.plugin.settings.enableInlinePreview) return;
    if (isCursorInCodeBlock(editor) || isCursorInInlineCode(editor)) return;

    const cursor = editor.getCursor()!;
    if (this.trySuggest(cursor)) return this.hideInlinePreview();
    this.hideSuggests();

    if (isActiveDisplayMathExists()) return this.hideInlinePreview();
    this.updateInlinePreview();
  }

  hideAll() {
    this.hideInlinePreview();
    this.hideSuggests();
  }

  hideInlinePreview() {
    this.inlinePreviewEl.close();
  }

  hideSuggests() {
    this.symbolSuggestEl.close();
    this.snippetSuggestEl.close();
  }

  updateInlinePreview() {
    const cursor = this.editor?.getCursor();
    if (!cursor) return;
    const mathContent = this.extractInlineMathContentInsideDollarOutsideCursor(cursor);
    if (!mathContent) return this.hideInlinePreview();

    this.renderMathPreview(mathContent);
  }

  trySuggest(cursor: EditorPosition) {
    const lineText = this.editor!.getLine(cursor.line);
    const textBeforeCursor = lineText.slice(0, cursor.ch);

    // snippet / symbol
    if (textBeforeCursor.endsWith('@') && !textBeforeCursor.startsWith('#import')) {
      this.symbolSuggestEl.close();

      const match = textBeforeCursor.match(
        /(?:^| |\$|\(|\)|\[|\]|\{|\}|<|>|\+|-|\/|\*|=|!|\?|#|%|&|'|:|;|,|\d)(?<word>[^\W_]+)(?<value>\(.*\))?@$/,
      );
      if (match) {
        this.word = match.groups?.word;
        if (this.word === undefined) return null;

        this.value = match.groups?.value;
        this.wordLine = cursor.line;

        this.startWordIndex = cursor.ch - this.word!.length - 1;
        if (this.value) this.startWordIndex -= this.value.length;

        this.suggestSnippets(this.value !== undefined);
        return true;
      }
      this.word = undefined;
    } else if (!textBeforeCursor.endsWith(' ')) {
      this.snippetSuggestEl.close();
      const match = textBeforeCursor.match(
        /(?:^| |\$|\(|\)|\[|\]|\{|\}|<|>|\+|-|\/|\*|=|!|\?|#|%|&|'|:|;|,|\d)(?<symbol>\\?([a-zA-Z.][a-zA-Z.]+|[-<>|=[\]~:-][-<>|=[\]~:-]+))$/,
      );
      if (match) {
        this.symbol = match.groups?.symbol;
        this.symbolLine = cursor.line;
        this.startSymbolIndex = cursor.ch - this.symbol!.length;
        if (!this.symbol) return null;
        this.suggestSymbols(this.symbol);
        return true;
      }
    }

    return null;
  }

  private suggestSnippets(find: boolean) {
    if (find) {
      const snippet = this.plugin.settings.snippets?.find((s) => s.name === this.word);
      if (!snippet) return;

      this.snippetSuggestEl.snippets = [snippet];
    } else {
      const snippets = this.plugin.settings.snippets?.filter((s) => s.name.includes(this.word!));
      if (!snippets?.length) return this.snippetSuggestEl.close();
      this.snippetSuggestEl.snippets = snippets;
    }

    const position = calculatePosition(
      this.editor!,
      this.startWordIndex!,
      this.startWordIndex! + this.word!.length + 1,
    );
    if (!position) return;

    this.editor?.addHighlights(
      [
        {
          from: {
            line: this.wordLine!,
            ch: this.startWordIndex! + this.word!.length + (this.value?.length ?? 0),
          },
          to: {
            line: this.wordLine!,
            ch: this.startWordIndex! + this.word!.length + (this.value?.length ?? 0) + 1,
          },
        },
      ],
      // @ts-expect-error
      'typstmate-atmode',
      true,
    );
    this.snippetSuggestEl.render(position, this.editor!);
  }

  complementSnippet(snippet: Snippet) {
    this.replaceLength(
      `${snippet.name + (this.value ? this.value : '')}@`,
      {
        line: this.wordLine!,
        ch: this.startWordIndex!,
      },
      this.word!.length + (this.value?.length ?? 0) + 1,
    );
  }

  applySnippet(snippet: Snippet) {
    let content = snippet.content;
    if (snippet.script) {
      try {
        content = new Function('input', 'window', content)(this.value?.slice(1, -1), window);
      } catch (e) {
        new Notice(String(e));
        return;
      }
    }

    const cursorIndex = content.indexOf('#CURSOR');
    content = content.replace('#CURSOR', '');
    let replaceLength = this.word!.length + 1;
    if (this.value) replaceLength += this.value.length;
    if (cursorIndex === -1) content = `${content} `;

    this.replaceLength(
      content,
      {
        line: this.wordLine!,
        ch: this.startWordIndex!,
      },
      replaceLength,
    );
    this.editor?.setCursor(this.wordLine!, this.startWordIndex! + (cursorIndex === -1 ? content.length : cursorIndex));

    if (snippet.kind === 'inline') this.updateInlinePreview();
  }

  private suggestSymbols(name: string) {
    const symbols = searchSymbols(name);
    if (!symbols.length) return this.symbolSuggestEl.close();

    this.symbolSuggestEl.symbols = symbols;
    const position = calculatePosition(this.editor!, this.startDollarIndex!, this.startDollarIndex! + 1);
    if (!position) return;

    this.symbolSuggestEl.render(position, this.editor!, name.at(0) === '\\');
  }

  complementSymbol(editor: Editor, symbol: SymbolData) {
    if (symbol.name === this.symbol) return this.applySymbol(editor, symbol);

    this.replaceLength(
      symbol.name,
      {
        line: this.symbolLine!,
        ch: this.startSymbolIndex!,
      },
      this.symbol?.length ?? 0 + 1,
    );
  }

  applySymbol(editor: Editor, symbol: SymbolData) {
    let content: string;
    if (this.plugin.settings.complementSymbolWithUnicode) content = symbol.sym;
    else content = symbol.name;

    if (!['op', 'Large'].includes(symbol.mathClass)) content = `${content} `;

    const line = editor.getCursor().line;

    editor.replaceRange(
      content,
      {
        line,
        ch: this.startSymbolIndex!,
      },
      {
        line,
        ch: editor.getCursor().ch,
      },
    );
    this.updateInlinePreview();
  }

  private renderMathPreview(mathContent: InlineMathContentResult): void {
    const codeMirror = this.editor!.cm;

    if (!codeMirror || !window.MathJax) return;

    try {
      const position = calculatePosition(this.editor!, mathContent.startIndex - 1, mathContent.endIndex);

      this.inlinePreviewEl.render(position, mathContent.content);
    } catch {}
  }

  removeSuggest(): void {
    this.symbolSuggestEl?.close();
    // this.snippetSuggestEl?.close();
  }

  replaceLength(content: string, from: EditorPosition, length: number): number {
    this.editor?.replaceRange(content, from, {
      line: from.line,
      ch: from.ch + length,
    });
    return content.length;
  }

  highlightLength(length: number, froms: EditorPosition[], style: string, remove_previous = true) {
    this.editor?.addHighlights(
      froms.map((from) => ({
        from,
        to: {
          line: from.line,
          ch: from.ch + length,
        },
      })),
      // @ts-expect-error
      style,
      remove_previous,
    );
  }

  extractInlineMathContentInsideDollarOutsideCursor(cursor: EditorPosition): InlineMathContentResult | undefined {
    const lineText = this.editor!.getLine(cursor.line);
    const textBeforeCursor = lineText.slice(0, cursor.ch);
    const textAfterCursor = lineText.slice(cursor.ch);
    const charBeforeCursor = textBeforeCursor.at(-1);
    const charAfterCursor = textAfterCursor.at(0);
    const dollarIndexBeforeCursor = textBeforeCursor.lastIndexOf('$');
    const dollarIndexAfterCursor = textAfterCursor.indexOf('$');

    if (dollarIndexBeforeCursor === -1 || dollarIndexAfterCursor === -1) return;
    if (charBeforeCursor === '$' && charAfterCursor === ' ') return;
    if (charBeforeCursor === ' ' && charAfterCursor === '$') return;

    const content = lineText.slice(dollarIndexBeforeCursor + 1, cursor.ch + dollarIndexAfterCursor);

    return {
      content: content,
      startIndex: dollarIndexBeforeCursor + 1,
      endIndex: cursor.ch + dollarIndexAfterCursor,
      startLine: cursor.line,
    };
  }

  extractDisplayMathContentInsideTwoDollarsOutsideCursor(cursor: EditorPosition): DisplayMathContentResult | undefined {
    let content = '';
    let startLine = -1,
      endLine = -1;
    let startIndex = -1,
      endIndex = -1;

    for (let i = cursor.line; i >= 0; i--) {
      const lineText = this.editor!.getLine(i);
      const twoDollarsIndex = lineText.indexOf('$$');

      if (twoDollarsIndex !== -1) {
        startLine = i;
        startIndex = twoDollarsIndex + 2;
        if (i !== cursor.line) content = `${lineText.slice(twoDollarsIndex + 2)}\n${content}`;
        break;
      }
      content = `${lineText}\n${content}`;
    }

    const lineCount = this.editor!.lineCount();
    for (let i = cursor.line; i < lineCount; i++) {
      const lineText = this.editor!.getLine(i);
      const twoDollarsIndex = lineText.indexOf('$$');

      if (twoDollarsIndex !== -1) {
        endLine = i;
        endIndex = twoDollarsIndex;
        // ? 1行に $$...$$ が含まれる場合があるため
        if (i === startLine) content += lineText.slice(startIndex, twoDollarsIndex);
        else content += lineText.slice(0, twoDollarsIndex);
        break;
      }
      if (i !== cursor.line) content += `${lineText}\n`;
      else if (i === startLine) content += `${lineText.slice(startIndex)}\n`; // カーソル行で$$が始まったのに終わりの$$がなかったとき
    }

    if (endLine === -1 || startLine === -1 || content === '') return;

    return {
      content: content,
      startIndex: startIndex,
      endIndex: endIndex,
      startLine: startLine,
      endLine: endLine,
    };
  }
}

function isActiveDisplayMathExists() {
  return document.body.querySelector('span.cm-formatting-math.cm-math-block') !== null;
}

function isActiveMathExists() {
  return document.body.querySelector('span.cm-formatting-math') !== null;
}

function isCursorInCodeBlock(editor: Editor) {
  const cursor = editor.getCursor();
  let inBlock = false;

  for (let i = cursor.line - 1; i >= 0; i--) {
    const line = editor.getLine(i);
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) inBlock = !inBlock;
  }

  return inBlock;
}

function isCursorInInlineCode(editor: Editor) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const textBeforeCursor = line.slice(0, cursor.ch);

  let backtickCount = 0;
  for (let i = 0; i < textBeforeCursor.length; i++) {
    if (textBeforeCursor[i] === '`') {
      backtickCount++;
    }
  }
  return backtickCount % 2 === 1;
}

function calculatePosition(editor: Editor, startIndex: number, endIndex: number): Position {
  const position = editor.getCursor();

  position.ch = startIndex;
  const startCoords = editor.coordsAtPos(position, false);

  position.ch = endIndex;
  const endCoords = editor.coordsAtPos(position, false);

  const x =
    startCoords.top !== endCoords.top ? editor.coordsAtPos({ ...position, ch: 0 }, false).left : startCoords.left;

  const y = endCoords.top + (window.app?.vault.config.baseFontSize ?? DEFAULT_FONT_SIZE);

  return { x, y };
}

interface InlineMathContentResult {
  content: string;
  startIndex: number;
  endIndex: number;
  startLine: number;
}

interface DisplayMathContentResult extends InlineMathContentResult {
  startLine: number;
  endLine: number;
}

export interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface VisualSnippetData {
  content: string;
  category: string;
  offset?: number;
}

export interface Position {
  x: number;
  y: number;
}
