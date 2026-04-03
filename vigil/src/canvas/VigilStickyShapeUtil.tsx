"use client";

import "@/src/types/vigil-shapes";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  useEditor,
} from "tldraw";
import type { TLBaseShape } from "@tldraw/tlschema";
import type { RecordProps } from "@tldraw/tlschema";

import { vigilStickyShapeMigrations } from "./vigil-shape-migrations";

export type TLVigilStickyShape = TLBaseShape<
  "vigil-sticky",
  {
    w: number;
    h: number;
    color: string;
    text: string;
  }
>;

const vigilStickyShapeProps: RecordProps<TLVigilStickyShape> = {
  w: T.number,
  h: T.number,
  color: T.string,
  text: T.string,
};

function VigilStickyBody({ shape }: { shape: TLVigilStickyShape }) {
  const editor = useEditor();
  const { w, h, color, text } = shape.props;

  return (
    <HTMLContainer
      style={{
        width: w,
        height: h,
        pointerEvents: "all",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: color,
          borderRadius: 4,
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          padding: 10,
          boxSizing: "border-box",
        }}
      >
        <textarea
          value={text}
          placeholder="Sticky…"
          onChange={(e) => {
            editor.updateShape({
              id: shape.id,
              type: "vigil-sticky",
              props: { ...shape.props, text: e.target.value },
            });
          }}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            resize: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            lineHeight: 1.35,
            fontWeight: 500,
            color: "#0d0d0d",
          }}
        />
      </div>
    </HTMLContainer>
  );
}

export class VigilStickyShapeUtil extends BaseBoxShapeUtil<TLVigilStickyShape> {
  static override type = "vigil-sticky" as const;
  static override props = vigilStickyShapeProps;
  static override migrations = vigilStickyShapeMigrations;

  override getDefaultProps(): TLVigilStickyShape["props"] {
    return {
      w: 200,
      h: 120,
      color: "#00f5a0",
      text: "",
    };
  }

  override getGeometry(shape: TLVigilStickyShape) {
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    });
  }

  override component(shape: TLVigilStickyShape) {
    return <VigilStickyBody shape={shape} />;
  }

  override indicator(shape: TLVigilStickyShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={4} ry={4} />
    );
  }

  override canEdit() {
    return true;
  }
}
