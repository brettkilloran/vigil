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

import { vigilNoteShapeMigrations } from "./vigil-shape-migrations";

export type TLVigilNoteShape = TLBaseShape<
  "vigil-note",
  {
    w: number;
    h: number;
    color: string;
    text: string;
  }
>;

const vigilNoteShapeProps: RecordProps<TLVigilNoteShape> = {
  w: T.number,
  h: T.number,
  color: T.string,
  text: T.string,
};

function VigilNoteBody({ shape }: { shape: TLVigilNoteShape }) {
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
          borderRadius: 12,
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
          padding: 12,
          boxSizing: "border-box",
        }}
      >
        <textarea
          value={text}
          placeholder="Note…"
          onChange={(e) => {
            editor.updateShape({
              id: shape.id,
              type: "vigil-note",
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
            fontSize: 14,
            lineHeight: 1.45,
            color: "#1a1a1a",
          }}
        />
      </div>
    </HTMLContainer>
  );
}

export class VigilNoteShapeUtil extends BaseBoxShapeUtil<TLVigilNoteShape> {
  static override type = "vigil-note" as const;
  static override props = vigilNoteShapeProps;
  static override migrations = vigilNoteShapeMigrations;

  override getDefaultProps(): TLVigilNoteShape["props"] {
    return {
      w: 280,
      h: 180,
      color: "#ffffff",
      text: "",
    };
  }

  override getGeometry(shape: TLVigilNoteShape) {
    return new Rectangle2d({
      width: Math.max(shape.props.w, 1),
      height: Math.max(shape.props.h, 1),
      isFilled: true,
    });
  }

  override component(shape: TLVigilNoteShape) {
    return <VigilNoteBody shape={shape} />;
  }

  override indicator(shape: TLVigilNoteShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
    );
  }

  override canEdit() {
    return true;
  }
}
