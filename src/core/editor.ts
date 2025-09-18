import type { Editor, MarkdownView } from 'obsidian';

import type ObsidianTypstMate from '@/main';

function isCursorInBlock(editor: Editor): boolean {
  const cursor = editor.getCursor();
  let inBlock = false;

  for (let i = cursor.line; i >= 0; i--) {
    const line = editor.getLine(i);
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~') || trimmedLine.startsWith('$$'))
      inBlock = !inBlock;
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

interface MathContentResult {
  content: string;
  startIndex: number;
  endIndex: number;
}

export class EditorHelper {
  private plugin: ObsidianTypstMate;

  private previewElement: HTMLElement | null = null;
  private readonly PREVIEW_OFFSET = 6; // px

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;
  }

  updatePreview(editor: Editor): void {
    const mathContent = this.extractMathContent(editor);
    if (!mathContent) return;

    this.renderMathPreview(editor, mathContent);
  }

  private shouldSkipPreview(editor: Editor): boolean {
    return isCursorInBlock(editor) || isCursorInInlineCode(editor);
  }

  private extractMathContent(editor: Editor): MathContentResult | null {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const textBeforeCursor = lineText.slice(0, cursor.ch);
    const textAfterCursor = lineText.slice(cursor.ch);

    if (textBeforeCursor.indexOf('$') === -1 && textAfterCursor.indexOf('$') === -1) {
      return null;
    }

    const totalUnescapedDollarsBefore = this.countUnescapedDollarsInDocument(editor, cursor.line, cursor.ch);

    if (totalUnescapedDollarsBefore % 2 === 0) {
      return null;
    }

    const lastDollarBefore = textBeforeCursor.lastIndexOf('$');
    const firstDollarAfter = textAfterCursor.indexOf('$');

    if (
      lastDollarBefore === -1 ||
      firstDollarAfter === -1 ||
      this.hasUnescapedDollar(textBeforeCursor, lastDollarBefore)
    ) {
      return null;
    }

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

  private renderMathPreview(editor: Editor, mathContent: MathContentResult): void {
    const cursor = editor.getCursor();
    const codeMirror = editor.cm;

    if (!codeMirror || !window.MathJax) return;

    const endOffset = editor.posToOffset({
      line: cursor.line,
      ch: mathContent.endIndex,
    });
    const coordinates = codeMirror.coordsAtPos(endOffset);

    if (!coordinates) return;

    try {
      const mathHtml = window.MathJax.tex2chtml(mathContent.content, {
        display: false,
      });

      this.createAndAppendPreview(mathHtml, coordinates);
    } catch (error) {
      console.warn('MathJax rendering failed:', error);
    }
  }

  private createAndAppendPreview(mathHtml: HTMLElement, coordinates: { left: number; bottom: number }): void {
    const preview = document.createElement('div');
    preview.className = 'typstmate-inline-preview';
    preview.style.setProperty('--preview-left', `${coordinates.left}px`);
    preview.style.setProperty('--preview-top', `${coordinates.bottom + this.PREVIEW_OFFSET}px`);
    preview.appendChild(mathHtml);

    this.plugin.app.workspace.containerEl.appendChild(preview);
    this.previewElement = preview;
  }

  removePreview(): void {
    if (this.previewElement?.parentElement) {
      this.previewElement.parentElement.removeChild(this.previewElement);
    }
    this.previewElement = null;
  }

  onEditorChange(editor: Editor, _markdownView: MarkdownView) {
    if (!this.plugin.settings.enableInlinePreview) return;
    this.removePreview();
    if (this.shouldSkipPreview(editor)) return;

    this.updatePreview(editor);
  }
}
