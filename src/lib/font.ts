import { TypstSnippet } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { _resolveAssets } from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import { get_font_info } from '@myriaddreamin/typst-ts-web-compiler';
import { Notice } from 'obsidian';

import type ObsidianTypstMate from '@/main';

// 参照: https://github.com/Myriad-Dreamin/typst.ts/blob/3eeb078e2a21caf8256585e4f533df1810c33a09/packages/typst.ts/src/options.init.mts
export const FontAssetTypeTokens = ['text', 'cjk', 'emoji'] as const;
export type FontAssetType = (typeof FontAssetTypeTokens)[number];

// ? window.queryLocalFonts() の型 Promise<FontData[]> に用いる
export interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
}

// ? function get_font_info(buffer: Uint8Array) の型 FontInfo[] に用いる
export interface FontInfo {
  family: string;
  variant: FontVariant;
  flags: string;
  coverage: Uint32Array;
}

export interface FontVariant {
  style: FontStyle;
  weight?: number;
  stretch?: number;
}

export const FontStyleTokens = ['normal', 'italic', 'oblique'] as const;
export type FontStyle = (typeof FontStyleTokens)[number];

export const FontWeightTokens = {
  THIN: 100,
  EXTRALIGHT: 200,
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
  EXTRABOLD: 800,
  BLACK: 900,
};
export const roundFontWeight = (weight: number | undefined): string => {
  if (weight === undefined) {
    return 'undefined';
  }

  return Math.clamp(Math.round(weight / 100) * 100, 100, 900).toString();
};

export const FontStretchTokens = {
  ULTRA_CONDENSED: '50%',
  EXTRA_CONDENSED: '62.5%',
  CONDENSED: '75%',
  SEMI_CONDENSED: '87.5%',
  NORMAL: '100%',
  SEMI_EXPANDED: '112.5%',
  EXPANDED: '125%',
  EXTRA_EXPANDED: '150%',
  ULTRA_EXPANDED: '200%',
};
export const roundFontStretch = (ratio: number | undefined): string => {
  if (ratio === undefined) {
    return 'undefined';
  }

  const weight = Math.round(Math.clamp(ratio, 500, 2000));
  if (weight < 563) {
    return FontStretchTokens.ULTRA_CONDENSED;
  } else if (563 <= weight && weight < 688) {
    return FontStretchTokens.EXTRA_CONDENSED;
  } else if (688 <= weight && weight < 813) {
    return FontStretchTokens.CONDENSED;
  } else if (813 <= weight && weight < 938) {
    return FontStretchTokens.SEMI_CONDENSED;
  } else if (938 <= weight && weight < 1063) {
    return FontStretchTokens.NORMAL;
  } else if (1063 <= weight && weight < 1188) {
    return FontStretchTokens.SEMI_EXPANDED;
  } else if (1188 <= weight && weight < 1375) {
    return FontStretchTokens.EXPANDED;
  } else if (1375 <= weight && weight < 1750) {
    return FontStretchTokens.EXTRA_EXPANDED;
  } else if (1750 <= weight) {
    return FontStretchTokens.ULTRA_EXPANDED;
  }

  return 'some error';
};

export const FontFlagTokens = ['MONOSPACE', 'SERIF', 'MATH', 'VARIABLE'];

export default class FontManager {
  plugin: ObsidianTypstMate;

  constructor(plugin: ObsidianTypstMate) {
    this.plugin = plugin;
  }

  private async loadFont(u8aBuffer: Uint8Array) {
    try {
      this.plugin.typstManager.providers.push(
        TypstSnippet.preloadFontData(u8aBuffer),
      );
    } catch (err) {
      console.error(err);
      new Notice('Font load failed');
    }
  }

  async getImportedFontPaths() {
    const fontPaths = await this.plugin.app.vault.adapter
      .list(this.plugin.fontsDirPath)
      .then((res) =>
        res.files.filter(
          (filePath) =>
            filePath.endsWith('.font') && filePath.split('.').length >= 3,
        ),
      )
      .catch(() => []);

    return fontPaths;
  }

  async loadImportedFonts() {
    const fontPaths = await this.getImportedFontPaths();

    for (const fontPath of fontPaths) {
      await this.loadFont(
        new Uint8Array(
          await this.plugin.app.vault.adapter.readBinary(fontPath),
        ),
      );
    }
  }

  async getAssetFontPaths(assetType: FontAssetType) {
    const fontPaths = await this.plugin.app.vault.adapter
      .list(`${this.plugin.fontsDirPath}/${assetType}`)
      .then((res) => res.files)
      .catch(() => []);

    return fontPaths;
  }

  async loadAssetFonts() {
    for (const assetFontType of this.plugin.settings.font.assetFontTypes) {
      const fonts = await this.getAssetFontPaths(assetFontType);
      for (const font of fonts) {
        await this.loadFont(
          new Uint8Array(await this.plugin.app.vault.adapter.readBinary(font)),
        );
      }
    }
  }

  resolveAssets(assetType: FontAssetType) {
    return _resolveAssets({ assets: [assetType] });
  }

  async downloadFontAssets() {
    new Notice('Downloading...');

    const failedUrls: string[] = [];
    for (const assetType of FontAssetTypeTokens) {
      // ? 既存のフォントアセットがあれば一度削除し, 本来のTypst環境に合わせる. 余分なフォントを削除し, 起動時間を短縮する.
      await this.plugin.app.vault.adapter
        .rmdir(`${this.plugin.fontsDirPath}/${assetType}`, true)
        .catch(() => {});
      await this.plugin.app.vault.adapter.mkdir(
        `${this.plugin.fontsDirPath}/${assetType}`,
      );

      const urls = this.resolveAssets(assetType);
      for (const url of urls) {
        try {
          const response = await fetch(url);
          // ? fetchはネットワークエラー以外で例外を投げない
          if (!response.ok) {
            throw new Error('Failed to fetch font asset');
          }

          const buffer = await response.arrayBuffer();

          await this.plugin.app.vault.adapter.writeBinary(
            `${this.plugin.fontsDirPath}/${assetType}/${url.split('/').pop()}`,
            buffer,
          );
        } catch {
          failedUrls.push(url);
        }
      }
    }
    if (failedUrls.length === 0) {
      new Notice('Downloaded Successfully!');
    } else {
      new Notice(
        `Failed to download ${failedUrls.length} file(s). Some text may not display as expected.`,
      );
    }
  }

  async getSystemFontDataList(): Promise<FontData[]> {
    if (window.queryLocalFonts) return await window.queryLocalFonts();

    return [];
  }

  getFontInfo(u8aBuffer: Uint8Array): FontInfo[] {
    try {
      // ? Compiler が初期化されていないとうまく動作しないので注意
      return get_font_info(u8aBuffer).info as FontInfo[];
    } catch {
      new Notice('Failed to get font info');
      return [];
    }
  }

  async getFontArrayBufferFromFontData(
    fontData: FontData,
  ): Promise<ArrayBuffer> {
    const blob = await fontData.blob();
    return await blob.arrayBuffer();
  }

  async getFontUint8ArrayFromFontData(fontData: FontData): Promise<Uint8Array> {
    const arrayBuffer = await this.getFontArrayBufferFromFontData(fontData);
    return new Uint8Array(arrayBuffer);
  }
}
