declare module "obsidian-excalidraw-plugin/docs/API/ExcalidrawAutomate" {
  type FileId = string & {
    _brand: "FileId";
  };
  import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

  interface ImageInfo {
    mimeType: string;
    id: FileId;
    dataURL: string;
    created: number;
    file: any | null;
    hasSVGwithBitmap: boolean;
    latex?: string;
  }

  export interface ExcalidrawAutomate {
    imagesDict: {
      [key: FileId]: ImageInfo;
    };
    elementsDict: {
      [key: string]: ExcalidrawElement;
    };

    setView(): void;
    clear(): void;
    getViewLastPointerPosition(): { x: number; y: number };
    convertStringToDataURL(data: string, type?: string): Promise<string>;
    addElementsToView(
      repositionToCursor?: boolean,
      save?: boolean,
      newElementsOnTop?: boolean,
      shouldRestoreElements?: boolean,
    ): Promise<boolean>;

    boxedElement(
      id: string,
      eltype: string,
      x: number,
      y: number,
      w: number,
      h: number,
      link?: string | null,
      scale?: [number, number],
    ): ExcalidrawElement;
  }

  export type { ExcalidrawAutomate as default };
}
