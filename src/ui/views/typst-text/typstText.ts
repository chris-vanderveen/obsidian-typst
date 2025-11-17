import { MarkdownView } from "obsidian";

export class TypstTextView extends MarkdownView {
  static viewtype = "typst-text";

  override getViewType() {
    return TypstTextView.viewtype as unknown as "markdown";
  }
}
