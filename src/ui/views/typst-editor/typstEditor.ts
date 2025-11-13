import { TextFileView, WorkspaceLeaf } from "obsidian";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
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
        basicSetup,
        keymap.of(defaultKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.data = this.editor?.state.doc.toString() ?? "";
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
