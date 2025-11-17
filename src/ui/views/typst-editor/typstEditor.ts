import { TextFileView, WorkspaceLeaf } from "obsidian";
import { basicSetup } from "codemirror";
import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { EditorState, type Extension } from "@codemirror/state";

const VIEW_TYPE_TYPST_EDITOR = "typst-editor-view";

export class TypstEditorView extends TextFileView {
  static viewtype = VIEW_TYPE_TYPST_EDITOR;

  editor: EditorView | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TYPST_EDITOR;
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();

    // Create the CodeMirror editor
    this.editor = new EditorView({
      doc: this.data,
      parent: this.contentEl,
      extensions: [
        lineNumbers(),
        foldGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.data = update.state.doc.toString();
            this.requestSave();
          }
        }),
      ],
    });
  }

  override async onClose(): Promise<void> {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;

    if (this.editor) {
      const transaction = this.editor.state.update({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: data,
        },
      });
      this.editor.dispatch(transaction);
    }
  }

  clear(): void {
    this.data = "";
    if (this.editor) {
      const transaction = this.editor.state.update({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: "",
        },
      });
      this.editor.dispatch(transaction);
    }
  }
}
