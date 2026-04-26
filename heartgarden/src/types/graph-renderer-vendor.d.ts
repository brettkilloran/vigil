declare module "troika-three-text" {
  import { Object3D } from "three";

  export class Text extends Object3D {
    text: string;
    fontSize: number;
    color: number | string;
    anchorX: string;
    anchorY: string;
    maxWidth: number;
    position: { set: (x: number, y: number, z: number) => void };
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export class BatchedText extends Object3D {
    clear(): this;
    addText(text: Text): number;
    sync(callback?: () => void): void;
  }
}

declare module "d3-force-3d" {
  export * from "d3-force";
}
