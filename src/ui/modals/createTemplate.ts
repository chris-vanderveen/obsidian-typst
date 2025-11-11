import { type App, Modal } from "obsidian";

import type ObsidianTypstMate from "@/main";

export class CreateTemplateModal extends Modal {
  constructor(
    app: App,
    private plugin: ObsidianTypstMate,
  ) {
    super(app);
  }

  private resolve: (value: string | null) => void = () => {};

  static async show(
    app: App,
    plugin: ObsidianTypstMate,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new CreateTemplateModal(app, plugin);
      modal.resolve = resolve;
      modal.open();
    });
  }

  override async onOpen() {
    this.titleEl.setText("Create Template");

    const inputEl = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "Enter template name",
      cls: "typst-template-name-input",
    });

    inputEl.style.width = "100%";
    inputEl.style.marginBottom = "1rem";

    const buttonContainer = this.contentEl.createEl("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "0.5rem";
    buttonContainer.style.justifyContent = "flex-end";

    const createButton = buttonContainer.createEl("button", {
      text: "Create",
      cls: "mod-cta",
    });

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
    });

    const handleCreate = () => {
      const value = inputEl.value.trim();
      if (value) {
        this.close();
        this.resolve(value);
      }
    };

    createButton.onclick = handleCreate;
    cancelButton.onclick = () => {
      this.close();
      this.resolve(null);
    };

    inputEl.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      }
    };

    setTimeout(() => inputEl.focus(), 0);
  }
}
