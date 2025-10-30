# Contributing to Typst Mate

I appreciate your consideration to contribute to this project!
This document is a guide to help make your contribution easier and more effective.

## Getting Started

### Prerequisites

- JavaScript runtime: [Bun](https://bun.sh)
- Rust runtime: [Rustup](https://rustup.rs)
- Wasm compiler: [wasm-pack](https://drager.github.io/wasm-pack/) (install with `cargo install wasm-pack`)
- Task runner: [Taskfile](https://taskfile.dev)
- Code styler: [Biome](https://biomejs.dev/) and the [its IDE extension](https://biomejs.dev/guides/editors/first-party-extensions/)
- Hot-Reload Plugin: [Hot-Reload](https://github.com/obsidianmd/obsidian-hot-reload) (install via [BRAT](https://obsidian.md/plugins?id=obsidian42-brat))

### Installation

1. Clone the repository, move to the directory and install dependencies

```bash
git clone https://github.com/azyarashi/obsidian-typst-mate.git
cd obsidian-typst-mate
bun install
```

2. Add your `.env` file

```
CONFIG_DIR='/path/to/your_vault/.obsidian'
```

3. Place static files into your vault

```
task placestatic
```

## Development

### Scripts

The main scripts used during development are:

- `task wasm`: Build the wasm file in development mode and copy it to the plugin directory
- `task dev`:  Build the plugin files in development mode, copy them to plugin directory, and watch for changes
- `bun check`: Run formatter and linter

### 注意事項

- 3.0.0ブランチは開発中であり, 正しく動作しません. また, 大規模なコードロジックの変更が含まれています. mainブランチを使用してください.

### Structure (before 3.0.0)

- `src/core/editor`: インラインプレビューやスニペットなど
- `src/core/settings/`: 設定タブのUI
- `src/libs/typst.ts`, `src/libs/worker.ts`, `src/libs/`


## How to Contribute

Please open an Issue before submitting a Pull Request.
If you are planning to submit a PR, mention it in the Issue.

