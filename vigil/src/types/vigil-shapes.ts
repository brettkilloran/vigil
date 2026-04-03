import type {} from "@tldraw/tlschema";

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "vigil-note": {
      w: number;
      h: number;
      color: string;
      text: string;
    };
    "vigil-sticky": {
      w: number;
      h: number;
      color: string;
      text: string;
    };
  }
}

export {};
