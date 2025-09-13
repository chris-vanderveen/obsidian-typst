# Typst Mate

<a href="https://typst.app/docs/changelog/">
  <img alt="Typst Version" src="https://img.shields.io/badge/typst-0.13.1-orange" />
</a>

Render math expressions in [Obsidian](https://obsidian.md) using [Typst](https://typst.app/) instead of MathJax.

---

## Features

- Support *inline math*, *display math*, and *code blocks*
- Additional styling customization
  - e.g., an option `inline-middle` to vertically center *inline math* so it lines up naturally with the surrounding text
- Inline math preview
- Use custom fonts and import system fonts (Desktop app only for import)
- All Typst packages are supported!

## Compatibility

### Obsidian App

- PDF Export

### Other Plugins

- [Markmind](https://github.com/MarkMindCkm/obsidian-markmind) (requires background rendering to be disabled)
- [Webpage HTML Export](https://github.com/KosmosisDire/obsidian-webpage-export) (Don't forget to include CSS from Style Options)

## Note

- `time` and `fontsize` are fixed to the value at plugin startup.
- Only the first page is rendered.

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
