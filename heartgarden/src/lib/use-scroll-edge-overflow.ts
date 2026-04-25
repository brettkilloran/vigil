import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Reflect a scroll container's actual overflow state onto data attributes so CSS can paint an
 * opt-in edge fade only when content is clipped on that edge:
 *
 *   - `data-hg-scroll-overflow-top="true"` → there is content above the visible window.
 *   - `data-hg-scroll-overflow-bottom="true"` → there is content below the visible window.
 *
 * Consumers (e.g. `.a4DocumentBody`) pair these with a `mask-image` linear gradient; short
 * docs that fit their container get no attributes → no mask → no phantom "more below" hint.
 *
 * Updates are coalesced through `requestAnimationFrame`. Re-measures on scroll, on container
 * resize (ResizeObserver), on content resize (ResizeObserver on first child), and on DOM
 * mutations inside the container (MutationObserver) — covers TipTap / contenteditable edits.
 */
export function useScrollEdgeOverflowAttrs(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const overflow = scrollHeight - clientHeight > 1;
      const overflowTop = overflow && scrollTop > 0;
      const overflowBottom =
        overflow && scrollTop + clientHeight < scrollHeight - 1;
      if (overflowTop) {
        el.setAttribute("data-hg-scroll-overflow-top", "true");
      } else {
        el.removeAttribute("data-hg-scroll-overflow-top");
      }
      if (overflowBottom) {
        el.setAttribute("data-hg-scroll-overflow-bottom", "true");
      } else {
        el.removeAttribute("data-hg-scroll-overflow-bottom");
      }
    };
    const schedule = () => {
      if (raf) {
        return;
      }
      raf = requestAnimationFrame(update);
    };

    update();
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    const firstChild = el.firstElementChild;
    if (firstChild) {
      ro.observe(firstChild);
    }
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      el.removeEventListener("scroll", schedule);
      ro.disconnect();
      mo.disconnect();
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [ref]);
}
