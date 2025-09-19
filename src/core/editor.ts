import type { Editor, EditorPosition, MarkdownView } from 'obsidian';
import { DEFAULT_FONT_SIZE } from '@/constants';
import type { Snippet } from '@/libs/snippet';
import type ObsidianTypstMate from '@/main';
import type InlinePreviewElement from '@/ui/components/InlinePreview';
import type SnippetSuggestElement from '@/ui/components/SnippetSuggest';
import type SymbolSuggestElement from '@/ui/components/SymbolSuggest';
import { type SymbolData, searchSymbols } from '@/utils/symbolSearcher';

// TODO: モバイルの処理, 判定

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
      if (!isCursorDisplayMath(this.editor!)) return;
      const cursor = this.editor?.getCursor();
      if (!cursor) return;
      const lineText = this.editor?.getLine(cursor.line);
      if (!lineText) return;
      const cursorIndex = lineText.indexOf('#CURSOR', 0);
      if (cursorIndex === -1) {
        e.preventDefault();
        this.editor?.setCursor({
          line: cursor.line + 1,
          ch: 0,
        });
        return;
      }
      e.preventDefault();
      this.replaceLength(
        this.editor!,
        '',
        {
          line: cursor.line,
          ch: cursorIndex,
        },
        7,
      );
      this.editor?.setCursor({
        line: cursor.line,
        ch: cursorIndex,
      });
    }
  }

  private shouldSkipPreview(editor: Editor): boolean {
    return isCursorInCodeBlock(editor) || isCursorInInlineCode(editor);
  }

  onEditorChange(editor: Editor, _markdownView: MarkdownView) {
    this.editor = editor;
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
    const totalUnescapedDollarsBefore = this.countUnescapedDollarsInDocument(editor, cursor.line, cursor.ch);
    const inDisplayMath = isCursorDisplayMath(editor);

    let skipFlag = false;

    // カーソル行中に$がない ... インライン数式内ではない
    if (textBeforeCursor.indexOf('$') === -1 && textAfterCursor.indexOf('$') === -1) {
      if (!inDisplayMath) {
        this.removeSuggest();
        return null;
      }
      skipFlag = true;
    }

    // カーソル行中カーソル前にある$が偶数 ... インライン数式内ではない
    if (totalUnescapedDollarsBefore % 2 === 0) {
      this.removeSuggest();
      skipFlag = true;
    }

    const lastDollarBefore = textBeforeCursor.lastIndexOf('$');
    const firstDollarAfter = textAfterCursor.indexOf('$');

    // 行中に$がない かつディスプレイ数式ではない
    if (
      (lastDollarBefore === -1 ||
        firstDollarAfter === -1 ||
        this.hasUnescapedDollar(textBeforeCursor, lastDollarBefore)) &&
      !inDisplayMath
    )
      return null;

    // snippet / symbol
    if (textBeforeCursor.endsWith('@') && !textBeforeCursor.startsWith('#import')) {
      this.removePreview();
      this.symbolSuggestEl.close();
      const suffix = '@';

      const match = textBeforeCursor.match(/(?<word>[a-zA-Z-]+)(?<value>\(.*\))?@$/);
      if (match) {
        this.word = match.groups?.word;
        this.value = match.groups?.value;
        this.wordLine = cursor.line;
        console.log(cursor.ch, this.word!.length, suffix.length);
        this.startWordIndex = cursor.ch - this.word!.length - suffix.length;
        if (this.word === null) return null;
        //if (textBeforeCursor.includes('${}')) this.startWordIndex -= 3;
        if (this.value) this.startWordIndex -= this.value.length;
        console.log(this.startWordIndex);
        this.suggestSnippets(editor, this.value !== undefined);
        return null;
      }
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
    }

    if (skipFlag) return null;

    this.symbolSuggestEl.close();
    const mathContent = textBeforeCursor.slice(lastDollarBefore + 1) + textAfterCursor.slice(0, firstDollarAfter);

    return {
      content: mathContent,
      startIndex: lastDollarBefore + 1,
      endIndex: cursor.ch + firstDollarAfter,
    };
  }

  private countUnescapedDollarsInDocument(editor: Editor, currentLine: number, currentCh: number): number {
    let totalCount = 0;

    for (let line = 0; line < currentLine; line++) {
      const lineText = editor.getLine(line);
      totalCount += this.countUnescapedDollarsInLine(lineText);
    }

    const currentLineText = editor.getLine(currentLine).slice(0, currentCh);
    totalCount += this.countUnescapedDollarsInLine(currentLineText);

    return totalCount;
  }

  private countUnescapedDollarsInLine(text: string): number {
    let count = 0;
    let backslashCount = 0;
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      if (char === '\\') {
        backslashCount++;
        i++;
        continue;
      }

      if (char === '$') {
        if (backslashCount % 2 === 0) {
          count++;
        }
        backslashCount = 0;
      } else if (char !== '\\') {
        backslashCount = 0;
      }

      i++;
    }

    return count;
  }

  private hasUnescapedDollar(text: string, dollarIndex: number): boolean {
    let backslashCount = 0;
    for (let i = dollarIndex - 1; i >= 0 && text[i] === '\\'; i--) {
      backslashCount++;
    }
    return backslashCount % 2 === 1;
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

    this.snippetSuggestEl.render(position, editor);
  }

  complementSnippet(editor: Editor, snippet: Snippet) {
    this.removePreview();
    if (this.value) return;
    this.snippetSuggestEl.close();

    this.replaceLength(
      editor,
      `${snippet.name}@`,
      {
        line: this.wordLine!,
        ch: this.startWordIndex!,
      },
      this.word!.length + 1,
    );
    // editor.setCursor(this.wordLine!, this.startWordIndex! + content.length);
  }

  applySnippet(editor: Editor, snippet: Snippet) {
    this.removePreview();
    this.snippetSuggestEl.close();
    let content = snippet.content;
    if (snippet.script) content = new Function('v', content)(this.value?.slice(1, -1));

    const cursorIndex = content.indexOf('#CURSOR');
    content = content.replace('#CURSOR', '');
    let replaceLength = this.word!.length + 1;
    console.log(content, this.value);
    if (this.value) {
      content = content.replaceAll('#VALUE', this.value.slice(1, -1));
      replaceLength += this.value.length;
    }
    if (cursorIndex === -1) content = `${content} `;

    console.log(this.startWordIndex!, this.word!.length);
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

    if (symbol.mathClass !== 'Large') content = `${content} `; // ? よく attach するため

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
    this.snippetSuggestEl?.close();
  }

  replaceLength(editor: Editor, content: string, from: EditorPosition, length: number): number {
    editor.replaceRange(content, from, {
      line: from.line,
      ch: from.ch + length,
    });
    return content.length;
  }
}

function isCursorDisplayMath(editor: Editor): boolean {
  const cursor = editor.getCursor();
  let inBlock = false;

  for (let i = cursor.line - 1; i >= 0; i--) {
    const line = editor.getLine(i);
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('$$')) inBlock = !inBlock;
  }

  return inBlock;
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
