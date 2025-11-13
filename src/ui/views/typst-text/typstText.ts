import { TextFileView } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";

const VIEW_TYPE_TYPST_TEXT = "typst-text-view";

export class TypstTextView extends TextFileView {
  static viewtype = VIEW_TYPE_TYPST_TEXT;

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean) {
    this.data = data;

    this.contentEl.empty();
    this.contentEl.createDiv({ text: this.data });
  }

  clear() {
    this.data = "";
  }

  getViewType() {
    return VIEW_TYPE_TYPST_TEXT;
  }
}
