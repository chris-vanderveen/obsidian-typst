import { Notice, type Editor, type EditorPosition, type MarkdownView } from 'obsidian';
import { DEFAULT_FONT_SIZE } from '@/constants';
import type { Snippet } from '@/libs/snippet';
import type ObsidianTypstMate from '@/main';
import type InlinePreviewElement from '@/ui/components/InlinePreview';
import type SnippetSuggestElement from '@/ui/components/SnippetSuggest';
import type SymbolSuggestElement from '@/ui/components/SymbolSuggest';
import { type SymbolData, searchSymbols } from '@/utils/symbolSearcher';

export interface Position {
  x: number;
  y: number;
}

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

  keyListener = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;

    this.inlinePreviewEl = document.createElement('typstmate-inline-preview') as InlinePreviewElement;
    this.removePreview();
    this.inlinePreviewEl.plugin = this.plugin;
    this.inlinePreviewEl.addClasses(['typstmate-inline-preview', 'typstmate-temporary']);

    this.snippetSuggestEl = document.createElement('typstmate-snippets') as SnippetSuggestElement;
    this.snippetSuggestEl.plugin = this.plugin;
    this.snippetSuggestEl.container = document.createElement('div');
    this.snippetSuggestEl.addClasses(['typstmate-snippets', 'typstmate-temporary', 'typstmate-hidden']);
    this.snippetSuggestEl.appendChild(this.snippetSuggestEl.container);

    this.symbolSuggestEl = document.createElement('typstmate-symbols') as SymbolSuggestElement;
    this.symbolSuggestEl.plugin = this.plugin;
    this.symbolSuggestEl.container = document.createElement('div');
    this.symbolSuggestEl.container.addClass('container');
    this.symbolSuggestEl.addClasses(['typstmate-symbols', 'typstmate-temporary', 'typstmate-hidden']);
    this.symbolSuggestEl.appendChild(this.symbolSuggestEl.container);

    document.addEventListener('keydown', this.keyListener, { capture: true });
  }

  appendChildren(): void {
    document.body.setAttribute('typstmate-loaded', 'true');
    this.plugin.app.workspace.containerEl.appendChild(this.inlinePreviewEl);
    this.plugin.app.workspace.containerEl.appendChild(this.snippetSuggestEl);
    this.plugin.app.workspace.containerEl.appendChild(this.symbolSuggestEl);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      if (this.snippetSuggestEl.isOpen || this.symbolSuggestEl.isOpen) return;
      if (!isCursorMath()) return;

      const cursor = this.editor?.getCursor();
      if (!cursor) return;
      let line = cursor.line;

      let lineText = this.editor?.getLine(line);
      let cursorIndex = lineText?.indexOf('#CURSOR');
      // ? 初めの #CURSOR は別で置き換わるので, cursorIndex === 0 は気にしなくていい
      if (!cursorIndex) return;

      // ない場合は次の行も確認
      if (cursorIndex === -1) {
        line++;

        lineText = this.editor?.getLine(line);
        cursorIndex = lineText?.indexOf('#CURSOR');
        if (!cursorIndex) return;

        // なければ次の行に移動
        if (cursorIndex === -1) {
          e.preventDefault();
          this.editor?.setCursor({
            line,
            ch: 0,
          });
          return;
        }
      }

      // ある場合は置き換える
      e.preventDefault();
      this.replaceLength(
        this.editor!,
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
    }
  }

  private shouldSkipPreview(editor: Editor): boolean {
    return isCursorInCodeBlock(editor) || isCursorInInlineCode(editor);
  }

  onEditorChange(editor: Editor, _markdownView: MarkdownView) {
    this.editor = editor;
    if (!getSelection()!.isCollapsed) return; // 選択されている
    if (!this.plugin.settings.enableInlinePreview) return;
    if (this.shouldSkipPreview(editor)) return;

    this.updatePreview(editor);
  }

  updatePreview(editor: Editor) {
    const mathContent = this.extractMathContent(editor);
    if (!mathContent) return this.removePreview();

    this.renderMathPreview(editor, mathContent);
  }

  private extractMathContent(editor: Editor): MathContentResult | null {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const textBeforeCursor = lineText.slice(0, cursor.ch);
    const textAfterCursor = lineText.slice(cursor.ch);

    const lastDollarBefore = textBeforeCursor.lastIndexOf('$');
    const firstDollarAfter = textAfterCursor.indexOf('$');

    // 数式内にいない
    if (!isCursorMath()) return null;

    const inDisplay = isCursorDisplayMath();

    // インライン数式の範囲外
    if (!inDisplay && (lastDollarBefore === -1 || firstDollarAfter === -1)) return null;

    // snippet / symbol
    if (this.plugin.typstManager.beforeProcessor?.disableSuggest) {
    } else if (textBeforeCursor.endsWith('@') && !textBeforeCursor.startsWith('#import')) {
      this.removePreview();
      this.symbolSuggestEl.close();

      const match = textBeforeCursor.match(/(?<word>[^\W_]+)(?<value>\(.*\))?@$/);
      if (match) {
        this.word = match.groups?.word;
        if (this.word === null) return null;

        this.value = match.groups?.value;
        this.wordLine = cursor.line;

        this.startWordIndex = cursor.ch - this.word!.length - 1;
        if (this.value) this.startWordIndex -= this.value.length;

        this.suggestSnippets(editor, this.value !== undefined);
        return null;
      }
      this.word = undefined;
    } else if (!textBeforeCursor.endsWith(' ')) {
      const match = textBeforeCursor.match(/(?<symbol>\\?([a-zA-Z.][a-zA-Z.]+|[-<>|=[\]~:-][-<>|=[\]~:-]+))$/);
      if (match) {
        this.symbol = match.groups?.symbol;
        this.symbolLine = cursor.line;
        this.startSymbolIndex = cursor.ch - this.symbol!.length;
        if (!this.symbol) return null;
        this.suggestSymbols(editor, this.symbol);
        return null;
      }
      this.symbolSuggestEl.close();
    }

    // ディスプレイ数式中
    if (inDisplay) return null;

    this.symbolSuggestEl.close();
    const mathContent = textBeforeCursor.slice(lastDollarBefore + 1) + textAfterCursor.slice(0, firstDollarAfter);

    return {
      content: mathContent,
      startIndex: lastDollarBefore + 1,
      endIndex: cursor.ch + firstDollarAfter,
    };
  }

  private suggestSnippets(editor: Editor, find: boolean) {
    if (find) {
      const snippet = this.plugin.settings.snippets?.find((s) => s.name === this.word);
      if (!snippet) return;

      this.snippetSuggestEl.snippets = [snippet];
    } else {
      const snippets = this.plugin.settings.snippets?.filter((s) => s.name.includes(this.word!));
      if (!snippets?.length) return this.snippetSuggestEl.close();
      this.snippetSuggestEl.snippets = snippets;
    }

    const position = calculatePosition(editor, this.startWordIndex!, this.startWordIndex! + this.word!.length + 1);
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
    this.snippetSuggestEl.render(position, editor);
  }

  complementSnippet(editor: Editor, snippet: Snippet) {
    this.removePreview();

    this.replaceLength(
      editor,
      `${snippet.name + (this.value ? this.value : '')}@`,
      {
        line: this.wordLine!,
        ch: this.startWordIndex!,
      },
      this.word!.length + (this.value?.length ?? 0) + 1,
    );
  }

  applySnippet(editor: Editor, snippet: Snippet) {
    this.removePreview();
    this.snippetSuggestEl.close();

    let content = snippet.content;
    if (snippet.script) {
      try {
        content = new Function('input', content)(this.value?.slice(1, -1));
        console.log(content);
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
      editor,
      content,
      {
        line: this.wordLine!,
        ch: this.startWordIndex!,
      },
      replaceLength,
    );
    editor.setCursor(this.wordLine!, this.startWordIndex! + (cursorIndex === -1 ? content.length : cursorIndex));

    if (snippet.kind === 'inline') this.updatePreview(editor);
  }

  private suggestSymbols(editor: Editor, name: string) {
    this.removePreview();

    const symbols = searchSymbols(name);
    if (!symbols.length) return this.symbolSuggestEl.close();

    this.symbolSuggestEl.symbols = symbols;
    const position = calculatePosition(editor, this.startDollarIndex!, this.startDollarIndex! + 1);
    if (!position) return;

    this.symbolSuggestEl.render(position, editor, name.at(0) === '\\');
  }

  complementSymbol(editor: Editor, symbol: SymbolData) {
    this.removePreview();
    this.snippetSuggestEl.close();

    if (symbol.name === this.symbol) return this.applySymbol(editor, symbol);

    this.replaceLength(
      editor,
      symbol.name,
      {
        line: this.symbolLine!,
        ch: this.startSymbolIndex!,
      },
      this.symbol?.length ?? 0 + 1,
    );
  }

  applySymbol(editor: Editor, symbol: SymbolData) {
    this.removePreview();
    this.symbolSuggestEl.close();
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
    this.updatePreview(editor);
  }

  private renderMathPreview(editor: Editor, mathContent: MathContentResult): void {
    const codeMirror = editor.cm;

    if (!codeMirror || !window.MathJax) return;

    try {
      const position = calculatePosition(editor, mathContent.startIndex - 1, mathContent.endIndex);

      this.inlinePreviewEl.render(position, mathContent.content);
    } catch {}
  }

  removePreview(): void {
    this.inlinePreviewEl?.hide();
  }

  removeSuggest(): void {
    this.symbolSuggestEl?.close();
    // this.snippetSuggestEl?.close();
  }

  replaceLength(editor: Editor, content: string, from: EditorPosition, length: number): number {
    editor.replaceRange(content, from, {
      line: from.line,
      ch: from.ch + length,
    });
    return content.length;
  }
}

function isCursorDisplayMath(): boolean {
  return document.body.querySelector('span.cm-formatting-math.cm-math-block') !== null;
}

function isCursorMath(): boolean {
  return document.body.querySelector('span.cm-formatting-math') !== null;
}

function isCursorInCodeBlock(editor: Editor): boolean {
  const cursor = editor.getCursor();
  let inBlock = false;

  for (let i = cursor.line - 1; i >= 0; i--) {
    const line = editor.getLine(i);
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) inBlock = !inBlock;
  }

  return inBlock;
}

function isCursorInInlineCode(editor: Editor): boolean {
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

interface MathContentResult {
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
