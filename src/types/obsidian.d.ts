import "obsidian";

declare module "obsidian" {
  interface Workspace {
    on(
      name: "editor-change",
      callback: (editor: Editor, markdownView: MarkdownView) => void,
      ctx?: any,
    ): EventRef;
  }
}
