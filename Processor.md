# Processor

## What is a Processor?

A Processor is a collection of options that customize the rendering results, including code shortcuts, rendering modes, styling, and more.

## Why are Processors needed?

Typst achieves fast rendering through a mechanism called incremental compilation.
By having each processor function as a single file, Typst's powerful performance is realized.

This is particularly useful when previewing display math in real-time with heavy packages.
Typst Mate also includes an inline preview feature that leverages this capability.

## How do Processors work?

Each processor has a specific way to specify its ID.
Processors are checked in order from the top-level processor that matches the ID.
Additionally, all processors are compiled when the plugin is loaded.

## Types of Processors

### Inline Processor

Works with *inline math* (`$...$`).
To specify a processor, place the ID at the beginning followed by a colon and then the code, like `id:code`.

The `inline-middle` styling option vertically centers inline math so it lines up naturally with the surrounding text. Since it may be offset from regular text input, please use it appropriately depending on the situation.
[Screenshot](https://raw.githubusercontent.com/azyarashi/obsidian-typst-mate/main/assets/inline.png)

### Display Processor

Works with *display math* (`$$...$$`).
To specify a processor, enter the ID after the initial `$$`.

### CodeBlock Processor

Works with *Code Block* (<code>\`\`\` ... \`\`\`</code>) or (`~~~...~~~`).
To specify a processor, enter the ID after the initial <code>\`\`\`</code> or `~~~`.

Note that adding or editing code block IDs will not take effect and are fixed when the plugin is loaded. This is due to Obsidian's constraints.

### Excalidraw Processor

Becomes available when the Excalidraw plugin is installed. Can be added using the `typst-render-to-excalidraw` command.
Please note the following:

- Settings like `Use Theme Text Color` and `Base Color` do not work.
- Currently, editing is not supported. However, you can view the original code using a method similar to LaTeX (`Obsidian Tools Panel > Utility actions > Open the image-link or LaTeX-formula editor`).

## Notes

- The `fontsize` Layout/Length Value references Obsidian's default settings and is fixed to the value when the plugin is loaded.
- The `time` Foundations/Datetime value is fixed to the value when the plugin is loaded based on the local timezone.
- Only the first page is rendered.
- In tables, use *display math* instead of *code blocks*. `<br>` will be automatically replaced with line breaks.
- While there are examples of using Typst for Syntax Highlighting in CodeBlock Processor, we recommend using the [Obsidian Shiki Plugin](https://github.com/mProjectsCode/obsidian-shiki-plugin).
- Do not include special characters, especially slashes `/`, in Processors. This may cause issues.
- `<br>` is automatically removed for table support.