import { type App, Modal, Notice, Setting } from 'obsidian';

import type { FontInfo } from '@/lib/worker';
export class FontModal extends Modal {
  constructor(app: App, fontInfoArray: FontInfo[]) {
    super(app);

    fontInfoArray.forEach((fontInfo) => {
      new Setting(this.contentEl)
        .setName(fontInfo.family)
        .setHeading()
        .addButton((button) => {
          button.setIcon('copy');
          button.setTooltip('Copy Font Family Name');

          button.onClick(async () => {
            navigator.clipboard.writeText(fontInfo.family);
            new Notice('Copied!');
          });
        });

      new Setting(this.contentEl).setName(`style: ${fontInfo.variant.style}`);

      new Setting(this.contentEl).setName(
        `weight: ${fontWeightAliasFromNumber(fontInfo.variant.weight)}`,
      );

      new Setting(this.contentEl).setName(
        `stretch: ${fontStretchAliasFromRatio(fontInfo.variant.stretch)}`,
      );

      new Setting(this.contentEl).setName(
        `flags: ${fontFlagsToArray(fontInfo.flags)}`,
      );
    });
  }
}

export const FontWeightAlias = {
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
export const fontWeightAliasFromNumber = (weight: number) => {
  if (weight < 150) {
    return FontWeightAlias.THIN;
  } else if (weight < 250) {
    return FontWeightAlias.EXTRALIGHT;
  } else if (weight < 350) {
    return FontWeightAlias.LIGHT;
  } else if (weight < 450) {
    return FontWeightAlias.REGULAR;
  } else if (weight < 550) {
    return FontWeightAlias.MEDIUM;
  } else if (weight < 650) {
    return FontWeightAlias.SEMIBOLD;
  } else if (weight < 750) {
    return FontWeightAlias.BOLD;
  } else if (weight < 850) {
    return FontWeightAlias.EXTRABOLD;
  } else {
    return FontWeightAlias.BLACK;
  }
};

export const FontStretchAlias = {
  ULTRA_CONDENSED: 500,
  EXTRA_CONDENSED: 625,
  CONDENSED: 750,
  SEMI_CONDENSED: 875,
  NORMAL: 1000,
  SEMI_EXPANDED: 1125,
  EXPANDED: 1250,
  EXTRA_EXPANDED: 1500,
  ULTRA_EXPANDED: 2000,
};
export const fontStretchAliasFromRatio = (ratio: number) => {
  const weight = Math.round(clamp(ratio, 0.5, 2.0) * 1000.0);
  if (weight < 563) {
    return FontStretchAlias.ULTRA_CONDENSED;
  } else if (563 <= weight && weight < 688) {
    return FontStretchAlias.EXTRA_CONDENSED;
  } else if (688 <= weight && weight < 813) {
    return FontStretchAlias.CONDENSED;
  } else if (813 <= weight && weight < 938) {
    return FontStretchAlias.SEMI_CONDENSED;
  } else if (938 <= weight && weight < 1063) {
    return FontStretchAlias.NORMAL;
  } else if (1063 <= weight && weight < 1188) {
    return FontStretchAlias.SEMI_EXPANDED;
  } else if (1188 <= weight && weight < 1375) {
    return FontStretchAlias.EXPANDED;
  } else if (1375 <= weight && weight < 1750) {
    return FontStretchAlias.EXTRA_EXPANDED;
  } else if (1750 <= weight) {
    return FontStretchAlias.ULTRA_EXPANDED;
  }
};

export enum FontFlagAlias {
  monospace = 1 << 0, // 等幅フォント
  serif = 1 << 1, // セリフフォント
  math = 1 << 2, // 数式フォント
  variable = 1 << 3, // 可変フォント
}
export const fontFlagsToArray = (bits: number): string[] => {
  const result: string[] = [];

  for (const [key, value] of Object.entries(FontFlagAlias)) {
    if (typeof value !== 'number') continue;
    if ((bits & value) !== 0) {
      result.push(key.toUpperCase());
    }
  }

  return result;
};

function clamp(ratio: number, arg1: number, arg2: number) {
  return Math.max(arg1, Math.min(ratio, arg2));
}

// 参照: https://github.com/typst/typst/blob/main/crates/typst-kit/src/fonts.rs
