import { TextFileView, TFile } from "obsidian";

export class TypstTextView extends TextFileView {
  static viewtype = "typst-text";

  override getViewType(): string {
    return TypstTextView.viewtype;
  }

  override getDisplayText(): string {
    return this.file?.basename || "Typst";
  }

  override async onLoadFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    this.setViewData(content, false);
  }

  override setViewData(data: string, clear: boolean): void {
    this.contentEl.empty();
    const textarea = this.contentEl.createEl("textarea");
    textarea.value = data;
    textarea.style.width = "100%";
    textarea.style.height = "100%";

    textarea.addEventListener("input", async () => {
      if (this.file) {
        await this.app.vault.modify(this.file, textarea.value);
      }
    });
  }

  override getViewData(): string {
    const textarea = this.contentEl.querySelector(
      "textarea",
    ) as HTMLTextAreaElement;
    return textarea?.value || "";
  }

  override clear(): void {
    this.contentEl.empty();
  }
}
