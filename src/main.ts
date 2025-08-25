import type * as fsModule from 'node:fs';

import {
  debounce,
  loadMathJax,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  renderMath,
  requestUrl,
  type WorkspaceLeaf,
} from 'obsidian';

import { TypstToolsView } from '@/core/leaf';
import { DEFAULT_SETTINGS, type Settings, SettingTab } from '@/core/settings';
import TypstManager from '@/lib/typst';

export default class ObsidianTypstMate extends Plugin {
  pluginId = 'typst-mate';
  pluginDirPath!: string;

  baseDirPath!: string;
  fontsDirPath!: string;
  cachesDirPath!: string;
  packagesDirPath!: string;
  originalTex2chtml: any;

  settings!: Settings;

  typstManager!: TypstManager;

  fs?: typeof fsModule;

  override async onload() {
    // ユーザーの設定(data.json)を読み込む
    await this.loadSettings();

    // Node API を読み込む
    // ? DesktopAppのみ有効
    if (Platform.isDesktopApp) {
      this.fs = require('node:fs');
    }

    // よく用いるパスを設定する
    this.baseDirPath = this.app.vault.adapter.basePath;
    this.pluginDirPath = `${this.app.vault.configDir}/plugins/${this.pluginId}`;
    this.fontsDirPath = `${this.pluginDirPath}/fonts`;
    this.cachesDirPath = `${this.pluginDirPath}/caches`;
    this.packagesDirPath = `${this.pluginDirPath}/packages`;

    // ? ディレクトリの存在確認の挙動が安定しないので, 作成して例外を無視する
    await this.tryCreateDirs([
      this.fontsDirPath,
      this.cachesDirPath,
      this.packagesDirPath,
    ]);

    // Wasmをダウンロードする
    const rendererPath = `${this.pluginDirPath}/renderer.wasm`;
    const compilerPath = `${this.pluginDirPath}/compiler.wasm`;
    if (
      !(await this.app.vault.adapter.exists(rendererPath)) ||
      !(await this.app.vault.adapter.exists(compilerPath))
    ) {
      new Notice('Downloading renderer and compiler...');
      await this.downloadWasm()
        .then(() => new Notice('Downloaded successfully!'))
        .catch(() => new Notice('Failed to download wasm files.'));
    }

    // MathJaxを読み込む
    await loadMathJax(); // MathJaxが読み込まれると解決する
    if (window.MathJax === undefined)
      throw new Error('Failed to load MathJax.');
    renderMath('', false); // ? 副作用(スタイル)のため
    this.originalTex2chtml = window.MathJax.tex2chtml; // ? Pluginをunloadしたときに戻すため. Fallback処理のため.

    // TypstManagerを設定する
    this.typstManager = new TypstManager(this);
    await this.init();
    await this.typstManager.registerOnce();

    // 設定タブを追加
    this.addSettingTab(new SettingTab(this.app, this));

    // Leafを登録
    // ? iframeがモバイルで使えないため無効化
    if (Platform.isMobileApp) return;

    this.registerView(
      TypstToolsView.viewtype,
      (leaf) => new TypstToolsView(leaf),
    );
    this.addCommand({
      id: 'typst-tools-open',
      name: 'Typst Tools',
      callback: async () => {
        const leaf = await this.activateLeaf();
        if (leaf) {
          this.app.workspace.revealLeaf(leaf);
        }
      },
    });
    this.activateLeaf();
  }

  override async onunload() {
    // MathJaxのオーバーライドを解除
    if (window.MathJax !== undefined)
      window.MathJax.tex2chtml = this.originalTex2chtml;

    // ? MarkdownCodeBlockProcessorのオーバーライドは自動で解除

    // 登録したLeafを閉じる
    const leafs = this.app.workspace.getLeavesOfType(TypstToolsView.viewtype);
    for (const leaf of leafs) {
      leaf.detach();
    }
  }

  async downloadWasm() {
    const manifestPath = `${this.pluginDirPath}/manifest.json`;
    const manifestContent = await this.app.vault.adapter.read(manifestPath);
    const version = (JSON.parse(manifestContent) as { version: string })
      ?.version;

    if (!version) {
      throw new Error('Version not found in manifest.json');
    }

    const releaseUrl = `https://api.github.com/repos/azyarashi/obsidian-typst-mate/releases/tags/${version}`;
    const releaseResponse = await requestUrl(releaseUrl);
    const releaseData = await releaseResponse.json;

    const getAsset = (name: string) =>
      releaseData.assets.find((a: any) => a.name === name);

    const rendererAsset = getAsset('renderer.wasm');
    const compilerAsset = getAsset('compiler.wasm');

    if (!rendererAsset || !compilerAsset) {
      throw new Error(
        'Could not find renderer.wasm or compiler.wasm in release assets',
      );
    }

    await this.downloadAsset(
      rendererAsset.url,
      `${this.pluginDirPath}/renderer.wasm`,
    );
    await this.downloadAsset(
      compilerAsset.url,
      `${this.pluginDirPath}/compiler.wasm`,
    );
  }

  async downloadAsset(url: string, path: string) {
    const response = await requestUrl({
      url,
      headers: { Accept: 'application/octet-stream' },
    });
    const data = response.arrayBuffer;
    await this.app.vault.adapter.writeBinary(path, data);
  }

  async tryCreateDirs(dirPaths: string[]) {
    await Promise.allSettled(
      dirPaths.map((dirPath) => this.app.vault.adapter.mkdir(dirPath)),
    ).catch(() => {});
  }

  async activateLeaf() {
    let leaf: WorkspaceLeaf | null | undefined;
    [leaf] = this.app.workspace.getLeavesOfType(TypstToolsView.viewtype);

    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false);
      await leaf?.setViewState({ type: TypstToolsView.viewtype });
    }

    return leaf;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ? 同期に対応
  // ! 2回呼ばれるのを修正
  override onConfigFileChange = debounce(
    async () => {
      await this.loadSettings();
      await this.init();
    },
    500,
    true,
  );

  async init() {
    await this.typstManager.init();

    this.app.workspace
      .getActiveViewOfType(MarkdownView)
      ?.previewMode.rerender(true);
  }

  // ? MarkdownCodeBlockProcessorをunregistできる
  // ! プラグインを再読み込みせずにunregistする
  async reload() {
    await this.app.plugins.disablePlugin(this.pluginId);
    await this.app.plugins.enablePlugin(this.pluginId);
    this.app.setting.openTabById(this.pluginId);
  }
}
