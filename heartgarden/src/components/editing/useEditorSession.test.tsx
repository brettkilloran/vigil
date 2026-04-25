// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorCommitReason } from "@/src/components/editing/useEditorSession";
import { useEditorSession } from "@/src/components/editing/useEditorSession";

type SessionApi = ReturnType<typeof useEditorSession>;

function Harness({
  value,
  debounceMs,
  normalizeOnCommit,
  onCommit,
  onReady,
}: {
  value: string;
  debounceMs?: number;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string, reason: EditorCommitReason) => void;
  onReady: (session: SessionApi) => void;
}) {
  const session = useEditorSession({
    debounceMs,
    normalizeOnCommit,
    onCommit,
    value,
  });
  onReady(session);
  return null;
}

describe("useEditorSession", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("debounces and normalizes commits", () => {
    const commits: Array<{ value: string; reason: EditorCommitReason }> = [];
    let session: SessionApi | null = null;

    act(() => {
      root.render(
        <Harness
          debounceMs={100}
          normalizeOnCommit={(value) => value.trim()}
          onCommit={(value, reason) => commits.push({ reason, value })}
          onReady={(next) => {
            session = next;
          }}
          value="Alpha"
        />
      );
    });

    expect(session).not.toBeNull();
    act(() => {
      session?.beginEditing();
      session?.onDraftChange("  Beta  ");
      vi.advanceTimersByTime(99);
    });
    expect(commits).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(commits).toEqual([{ reason: "debounce", value: "Beta" }]);
  });

  it("cancels draft and resets to last committed value", () => {
    const commits: Array<{ value: string; reason: EditorCommitReason }> = [];
    let session: SessionApi | null = null;

    act(() => {
      root.render(
        <Harness
          debounceMs={100}
          onCommit={(value, reason) => commits.push({ reason, value })}
          onReady={(next) => {
            session = next;
          }}
          value="Original"
        />
      );
    });

    act(() => {
      session?.beginEditing();
      session?.onDraftChange("Changed");
      session?.cancelEditing();
      vi.advanceTimersByTime(100);
    });

    expect(commits).toHaveLength(0);
    expect(session?.draft).toBe("Original");
  });
});
