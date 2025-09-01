import { type App, Modal, Setting } from 'obsidian';

import type { Diagnostic } from '@/lib/worker';

export class DiagnosticModal extends Modal {
  constructor(app: App, diagnosticArray: Diagnostic[]) {
    super(app);

    diagnosticArray.forEach((diagnostic) => {
      new Setting(this.contentEl).setName(diagnostic.message).setHeading();
      diagnostic.hints.forEach((hint) => {
        new Setting(this.contentEl).setName(`hint: ${hint}`);
      });
    });
  }
}
