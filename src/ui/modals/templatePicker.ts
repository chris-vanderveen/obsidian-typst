import { type App, FuzzySuggestModal, TAbstractFile, Notice } from "obsidian";
import type ObsidianTypstMate from "../../main";

export class TemplatePickerModal extends FuzzySuggestModal<TAbstractFile> {
  private plugin: ObsidianTypstMate;

  constructor(app: App, plugin: ObsidianTypstMate) {
    super(app);
    this.plugin = plugin;
  }

  getItems(): TAbstractFile[] {
    return (
      this.app.vault.getFolderByPath(this.plugin.templatesDir)?.children ?? []
    );
  }

  getItemText(file: TAbstractFile): string {
    return file.name;
  }

  onChooseItem(template: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
    new Notice(`Selected ${template.name}`);
  }
}
