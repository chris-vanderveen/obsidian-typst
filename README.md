# Typst Mate

<a href="https://typst.app/docs/changelog/">
  <img alt="Typst Version" src="https://img.shields.io/badge/typst-0.13.1-orange" />
</a>

Render math expressions in [Obsidian](https://obsidian.md) using [Typst](https://typst.app/) instead of MathJax.

[![TypstMate](https://raw.githubusercontent.com/azyarashi/obsidian-typst-mate/main/assets/demo.png)](#demo)

For details about the processor, see [Processor.md](https://github.com/azyarashi/obsidian-typst-mate/blob/main/Processor.md).

---

## Features

- Support *inline math*, *display math*, and *code blocks*
- Additional styling customization
  - e.g., an option `inline-middle` to vertically center *inline math* so it lines up naturally with the surrounding text
- Inline math preview
- Use custom fonts and import system fonts (desktop app only for import)
- All Typst packages are supported! (desktop app only for import local packages)
- Excalidraw support
- Table support (except code blocks)

## Installation

Currently, it's under review for the official plugin list. This process may take several months.
Until then, please install using the official plugin [BRAT](https://tfthacker.com/brat-quick-guide).

[![Screenshot](https://raw.githubusercontent.com/azyarashi/obsidian-typst-mate/main/assets/brat.png)](#brat)

## Compatibility

### Obsidian App

- PDF Export

### Other Plugins

- [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) (use the `typst-render-to-excalidraw` command)
- [Markmind](https://github.com/MarkMindCkm/obsidian-markmind) (requires background rendering to be disabled)
- [Webpage HTML Export](https://github.com/KosmosisDire/obsidian-webpage-export) (don't forget to include CSS from Style Options)

### Default Preamble

```typst
#set page(margin: 0pt, width: auto, height: auto)
#show raw: set text(1.25em)
#set text(size: fontsize)
```

### Custom Styling

You can apply your own custom CSS, not just the styling included in the plugin.
Depending on the three modes (`inline`, `display`, `codeblock`), the styling method (`style`), and the identifier (`id`), the following CSS classes will be added:

- `typstmate-(mode)`
- `typstmate-style-(style)`
- `typstmate-id-(id)`

---

Typst Mate leverages the following open-source project:

- [Typst](https://typst.app/) – a powerful typesetting system

I'm grateful to the Typst developers for making this plugin possible.
