"use client";

import { Sparkle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";

import { Button } from "@/src/components/ui/Button";

export type LoreAskSource = {
  itemId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  excerpt: string;
};

type LoreResponse = {
  ok?: boolean;
  answer?: string | null;
  sources?: LoreAskSource[];
  model?: string | null;
  error?: unknown;
};

export function LoreAskPanel({
  open,
  onClose,
  spaceId,
  spaceScopedAllowed,
  onOpenSource,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string | null;
  spaceScopedAllowed: boolean;
  onOpenSource: (itemId: string) => void;
}) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState("");
  const [scopeCurrentSpace, setScopeCurrentSpace] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<LoreAskSource[]>([]);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setScopeCurrentSpace(true);
      setLoading(false);
      setError(null);
      setAnswer(null);
      setSources([]);
      setModel(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      const root = rootRef.current;
      const t = e.target;
      if (!root || !(t instanceof Node)) {
        e.preventDefault();
        return;
      }
      if (!root.contains(t)) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [open]);

  const submit = useCallback(async () => {
    const q = question.trim();
    if (!q || loading) return;
    playVigilUiSound("button");
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    setModel(null);
    try {
      const body: { question: string; spaceId?: string; limit?: number } = {
        question: q,
        limit: 14,
      };
      if (spaceScopedAllowed && scopeCurrentSpace && spaceId) {
        body.spaceId = spaceId;
      }
      const res = await fetch("/api/lore/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as LoreResponse;
      if (!res.ok || !data.ok) {
        const err = data.error;
        let msg = "Request failed — check ANTHROPIC_API_KEY and try again.";
        if (typeof err === "string") msg = err;
        else if (err && typeof err === "object" && "formErrors" in err) {
          const fe = (err as { formErrors?: string[] }).formErrors;
          if (Array.isArray(fe) && fe[0]) msg = fe[0];
          else msg = "Invalid request";
        }
        playVigilUiSound("caution");
        setError(msg);
        if (Array.isArray(data.sources)) setSources(data.sources);
        return;
      }
      playVigilUiSound("notification");
      setAnswer(data.answer ?? "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setModel(typeof data.model === "string" ? data.model : null);
    } catch {
      playVigilUiSound("caution");
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [loading, question, scopeCurrentSpace, spaceId, spaceScopedAllowed]);

  const onKeyDownRoot = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submit();
      }
    },
    [onClose, submit],
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-hg-portal-root="lore"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1210,
        pointerEvents: "none",
      }}
    >
      <div
        data-hg-lore="overlay"
        aria-hidden="true"
        style={{ pointerEvents: "auto" }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div data-hg-lore="dialog" role="presentation">
        <div
          ref={rootRef}
          data-hg-lore="root"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onKeyDownRoot}
        >
          <div data-hg-lore="header">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkle className="size-5 shrink-0 text-[var(--sem-accent-primary)]" weight="bold" aria-hidden />
              <h2 id={titleId} data-hg-lore="title">
                Ask lore
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              tone="glass"
              size="icon"
              iconOnly
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-4" weight="bold" aria-hidden />
            </Button>
          </div>

          <p data-hg-lore="lede">
            Answers use search hits from your canvas (full-text), then Claude. Requires{" "}
            <code className="text-[12px] opacity-90">ANTHROPIC_API_KEY</code>.
          </p>

          <textarea
            ref={textareaRef}
            data-hg-lore="textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Who is allied with the river houses?"
            rows={4}
            disabled={loading}
          />

          {spaceScopedAllowed && spaceId ? (
            <label data-hg-lore="scope">
              <input
                type="checkbox"
                checked={scopeCurrentSpace}
                onChange={(e) => setScopeCurrentSpace(e.target.checked)}
                disabled={loading}
              />
              <span>Limit retrieval to current space</span>
            </label>
          ) : null}

          <div data-hg-lore="actions">
            <Button
              type="button"
              variant="primary"
              tone="solid"
              size="sm"
              disabled={loading || !question.trim()}
              onClick={() => void submit()}
            >
              {loading ? "Thinking…" : "Ask"}
            </Button>
            <span data-hg-lore="hint">
              <kbd className="font-sans text-[11px]">⌘</kbd>
              <kbd className="font-sans text-[11px]">↵</kbd> submit
            </span>
          </div>

          {error ? (
            <div data-hg-lore="error" role="alert">
              {error}
            </div>
          ) : null}

          {answer != null && answer !== "" ? (
            <div data-hg-lore="answer-wrap">
              <div data-hg-lore="answer-label">Answer</div>
              <div data-hg-lore="answer">{answer}</div>
              {model ? <div data-hg-lore="model">{model}</div> : null}
            </div>
          ) : null}

          {answer != null && answer === "" && !error && !loading ? (
            <div data-hg-lore="empty-answer">No answer text returned.</div>
          ) : null}

          {sources.length > 0 ? (
            <details data-hg-lore="sources">
              <summary>Sources used ({sources.length})</summary>
              <ul>
                {sources.map((s) => (
                  <li key={s.itemId}>
                    <Button
                      type="button"
                      variant="ghost"
                      tone="glass"
                      size="sm"
                      className="h-auto min-h-0 w-full max-w-full justify-start py-1.5 text-left"
                      onClick={() => {
                        onOpenSource(s.itemId);
                        onClose();
                      }}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{s.title}</span>
                        <span className="text-[var(--sem-text-muted)] text-[12px]">
                          {" "}
                          · {s.spaceName}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </div>,
    getVigilPortalRoot(),
  );
}
