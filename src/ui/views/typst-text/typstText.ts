import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

const VIEW_TYPE_TYPST_TEXT = "typst-text-view";

export class TypstTextView extends ItemView {
  static readonly viewtype = VIEW_TYPE_TYPST_TEXT;
  file: TFile | null = null;
  editor: EditorView | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TYPST_TEXT;
  }

  getDisplayText(): string {
    return this.file?.basename || "Typst Template";
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();

    const editorContainer = this.contentEl.createDiv({
      cls: "typst-editor-container",
    });

    editorContainer.style.height = "100%";
    editorContainer.style.width = "100%";

    let initialContent = "";
    if (this.file) {
      try {
        initialContent = await this.app.vault.read(this.file);
      } catch (error) {
        console.error("Error reading file:", error);
        initialContent = "";
      }
    }

    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        keymap.of(defaultKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && this.file) {
            // Save changes back to file
            const content = update.state.doc.toString();
            this.app.vault.modify(this.file, content);
          }
        }),
      ],
    });

    this.editor = new EditorView({
      state: startState,
      parent: editorContainer,
    });
  }

  override async onClose(): Promise<void> {
    // Cleanup CodeMirror instance
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  async setFile(file: TFile): Promise<void> {
    this.file = file;
    if (this.contentEl) {
      await this.onOpen();
    }
  }
}
