import { proxy, type Remote, wrap } from 'comlink';
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
import type $ from '@/lib/worker';
import { zip } from './lib/util';
import Typst from './lib/worker';
import TypstWorker from './lib/worker?worker&inline';

interface GitHubAsset {
  name: string;
  url: string;
}

export default class ObsidianTypstMate extends Plugin {
  pluginId = 'typst-mate';
  pluginDirPath!: string;

  baseDirPath!: string;
  fontsDirPath!: string;
  cachesDirPath!: string;
  packagesDirPath!: string;
  originalTex2chtml: any;

  settings!: Settings;

  typst!: $ | Remote<$>;

  worker?: Worker;

  typstManager!: TypstManager;

  override async onload() {
    // ユーザーの設定(data.json)を読み込む
    await this.loadSettings();
    const adapter = this.app.vault.adapter;

    // よく用いるパスを設定する
    this.baseDirPath = adapter.basePath;
    this.pluginDirPath = `${this.app.vault.configDir}/plugins/${this.pluginId}`;
    this.fontsDirPath = `${this.pluginDirPath}/fonts`;
    this.cachesDirPath = `${this.pluginDirPath}/caches`;
    this.packagesDirPath = `${this.pluginDirPath}/packages`;
    const cachesDirPath = this.cachesDirPath;
    const packagesDirPath = this.packagesDirPath;

    // ? ディレクトリの存在確認の挙動が安定しないので, 作成して例外を無視する
    await this.tryCreateDirs([
      this.fontsDirPath,
      this.cachesDirPath,
      this.packagesDirPath,
    ]);

    // Wasmをダウンロード
    const manifest = this.app.plugins.getPlugin(this.pluginId)?.manifest;
    if (!manifest) throw new Error('Failed to load manifest.');

    const wasmPath = `${this.pluginDirPath}/typst-${manifest.version}.wasm`;
    console.log(wasmPath);
    if (!(await this.app.vault.adapter.exists(wasmPath))) {
      const oldWasms = (
        await this.app.vault.adapter.list(this.pluginDirPath)
      ).files.filter((file) => file.endsWith('.wasm'));
      for (const wasm of oldWasms) {
        await this.app.vault.adapter.remove(wasm);
      }

      new Notice('Downloading wasm...');

      await this.downloadAsset(`typst-${manifest.version}.wasm`);
      new Notice('Downloaded successfully!');
    }

    // MathJaxを読み込む
    await loadMathJax(); // MathJaxが読み込まれると解決する
    if (window.MathJax === undefined)
      throw new Error('Failed to load MathJax.');
    renderMath('', false); // ? 副作用(スタイル)のため
    this.originalTex2chtml = window.MathJax.tex2chtml; // ? Pluginをunloadしたときに戻すため. Fallback処理のため.

    // TypstManagerを設定する
    const main = {
      notice(message: string) {
        new Notice(message);
      },
      readBinary(path: string) {
        return adapter.readBinary(path);
      },
      writePackage(path: string, files: tarFile[]) {
        const map = new Map<string, Uint8Array>();

        // ディレクトリ
        for (const f of files.filter((f) => f.type === '5')) {
          adapter.mkdir(`${packagesDirPath}/${path}/${f.name}`);
        }

        // ファイル
        for (const f of files.filter((f) => f.type === '0')) {
          adapter.writeBinary(`${packagesDirPath}/${path}/${f.name}`, f.buffer);
          map.set(`${path}/${f.name}`, new Uint8Array(f.buffer));
        }

        // シンボリックリンク
        for (const f of files.filter((f) => f.type === '2')) {
          adapter.copy(
            `${packagesDirPath}/${path}/${f.name}`,
            `${packagesDirPath}/${path}/${f.linkname}`,
          );
          map.set(`${path}/${f.linkname}`, map.get(`${path}/${f.name}`)!);
        }

        const [namespace, name, version] = path.split('/');

        adapter
          .writeBinary(
            // ? .DS_STORE などが紛れ込まないようにするため
            `${cachesDirPath}/${namespace}_${name}_${version}.cache`,
            zip(map).slice().buffer,
          )
          .then(() => {
            new Notice('Cached successfully!');
          });
      },
    };

    const wasm = await adapter.readBinary(wasmPath);
    if (this.settings.general.enableBackgroundRendering) {
      this.worker = new TypstWorker();
      const api = wrap<typeof $>(this.worker);
      this.typst = await new api(wasm, packagesDirPath);
      await this.typst.setMain(proxy(main));
    } else {
      this.typst = new Typst(wasm, packagesDirPath);
      this.typst.setMain(main);
    }

    this.typstManager = new TypstManager(this);
    await this.typstManager.init();
    await this.typstManager.registerOnce();

    this.addSettingTab(new SettingTab(this.app, this));

    // Leafを登録
    // ? iframeがモバイルで使えないため無効化
    if (Platform.isMobileApp) return;
    this.registerView(
      TypstToolsView.viewtype,
      (leaf) => new TypstToolsView(leaf),
    );
    this.activateLeaf();
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
    this.addCommand({
      id: 'typst-switch-rendering-engine',
      name: 'Switch Rendering Engine',
      callback: async () => {
        this.settings.general.enableBackgroundRendering =
          !this.settings.general.enableBackgroundRendering;
        await this.saveSettings();
        await this.reload(false);
      },
    });
  }

  override async onunload() {
    // Workerを終了
    this.worker?.terminate();

    // MathJaxのオーバーライドを解除
    if (window.MathJax !== undefined)
      window.MathJax.tex2chtml = this.originalTex2chtml;

    // MarkdownCodeBlockProcessorのオーバーライドは自動で解除

    // 登録したLeafを閉じる
    const leafs = this.app.workspace.getLeavesOfType(TypstToolsView.viewtype);
    for (const leaf of leafs) {
      leaf.detach();
    }
  }

  async tryCreateDirs(dirPaths: string[]) {
    await Promise.allSettled(
      dirPaths.map((dirPath) => this.app.vault.adapter.mkdir(dirPath)),
    ).catch(() => {});
  }

  async downloadAsset(name: string) {
    // バージョンを取得
    const manifestPath = `${this.pluginDirPath}/manifest.json`;
    const manifestContent = await this.app.vault.adapter.read(manifestPath);
    const version = JSON.parse(manifestContent)?.version;
    if (!version) throw new Error('Version not found in manifest.json');

    const releaseUrl = `https://api.github.com/repos/azyarashi/obsidian-typst-mate/releases/tags/${version}`;
    const releaseResponse = await requestUrl(releaseUrl);
    const releaseData = (await releaseResponse.json) as {
      assets: GitHubAsset[];
    };

    const asset = releaseData.assets.find((asset) => asset.name === name);
    if (!asset) throw new Error(`Could not find ${name} in release assets`);

    await this.download(asset.url, `${this.pluginDirPath}/${name}`);
  }

  async download(url: string, filePath: string) {
    const response = await requestUrl({
      url,
      headers: { Accept: 'application/octet-stream' },
    });
    const data = response.arrayBuffer;

    await this.app.vault.adapter.writeBinary(filePath, data);
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
    },
    500,
    true,
  );

  async init(initTypst = false) {
    if (initTypst) await this.typstManager.init();

    this.app.workspace
      .getActiveViewOfType(MarkdownView)
      ?.previewMode.rerender(true);
  }

  async initTypst() {
    await this.typstManager.init();
  }

  // ? MarkdownCodeBlockProcessorのunregistが行われる
  async reload(openSettingsTab = true) {
    await this.app.plugins.disablePlugin(this.pluginId); // ? onunloadも呼ばれる
    await this.app.plugins.enablePlugin(this.pluginId);
    if (openSettingsTab) this.app.setting.openTabById(this.pluginId);
  }
}
