# Typst Mate

<a href="https://typst.app/docs/changelog/">
  <img alt="Typst Version" src="https://img.shields.io/badge/typst-0.13.1-orange" />
</a>

Render math expressions in [Obsidian](https://obsidian.md) using [Typst](https://typst.app/) instead of MathJax.
Typst Mate also provides flexible styling options to customize the look of your formulas.

---

Currently, the processor description is insufficient.
For better understanding, please refer to this:
https://github.com/azyarashi/obsidian-typst-mate/issues/2

## Features

- Replaces MathJax with Typst for rendering math in Obsidian
- Supports inline math (`$...$`)
- Supports display math (`$$...$$`)
- Supports code blocks (\`\`\`...\`\`\`) (***reload required to take effect***)
- Additional styling customization for better readability
- Allows easy import of system fonts to your vault (Desktop app only)

## Custom Styling

You can apply your own custom CSS, not just the styling included in the plugin.
Depending on the three modes (inline, display, codeblock), the styling method (style), and the identifier (id), the following CSS classes will be added:
- `typstmate-(mode)`
- `typstmate-style-(style)`
- `typstmate-id-(id)`

## Note
- `time` and `fontsize` are fixed to the value at plugin startup.
- Only the first page is subject to rendering.

### Default Preamble

```typst
#set page(margin: (x: 0pt, y: 0pt), width: auto, height: auto)
#show raw: set text(1.25em)
#set text(size: fontsize)
```

## TODO
- 不具合修正: 設定の変更後に `onConfigFileChange` が2回呼ばれてしまう.
- 不具合修正: フォントサイズが絶妙に合っていない.
- 不具合修正(MobileApp): スタイルが正しく適用されない.
- 最適化: プラグインを再読み込みせずに `MarkdownCodeBlockProcessor` の登録を解除する.
- 最適化: SVGではなくHTMLをレンダリングするようにする.
- 最適化(DesktopApp): デスクトップ版では, コンパイラとアクセスモデルにNode APIとElectron APIを組み込んで高速化する.
- 機能: ローカルパッケージを利用できるようにする.
- 機能: プラグイン外で画像やbibliography, wasmなどのアセットを読み込めるようにする.
- 機能: フォーマット編集でシンタックスハイライトを有効にする.
- 機能: エラー・ヒント箇所がわかるようにする. また, 表示を改善する.
- 機能(MobileApp): モバイル版からでもカスタムフォントを読み込めるようにする.

---

Typst Mate leverages the following open-source projects:

- [Typst](https://typst.app/) – a powerful typesetting system

I am grateful to the developers of these projects for making this plugin possible.