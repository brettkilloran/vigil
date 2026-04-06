"use client";

import type { SpacePresencePeer } from "@/src/components/foundation/architectural-neon-api";
import { presenceCursorColor, presenceEmojiForClientId } from "@/src/lib/collab-presence-identity";

import styles from "./ArchitecturalRemotePresenceLayer.module.css";

type Props = {
  peers: SpacePresencePeer[];
  prefersReducedMotion: boolean;
};

export function ArchitecturalRemotePresenceCursors({ peers, prefersReducedMotion }: Props) {
  return (
    <div className={styles.remoteCursorRoot} aria-hidden>
      {peers.map((p) => {
        if (!p.pointer) return null;
        const emoji = presenceEmojiForClientId(p.clientId);
        const color = presenceCursorColor(p.clientId);
        const shortId = p.clientId.slice(-4).toLowerCase();
        return (
          <div
            key={p.clientId}
            className={`${styles.remoteCursor} ${!prefersReducedMotion ? styles.remoteCursorFloat : ""}`}
            style={{
              left: p.pointer.x,
              top: p.pointer.y,
              ["--remote-cursor-color" as string]: color,
            }}
          >
            <svg
              className={styles.remoteCursorSvg}
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M4.5 3.2L19.2 12.4L11.8 13.8L9.1 20.8L4.5 3.2Z"
                fill={color}
                stroke="color-mix(in oklch, white 55%, transparent)"
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
            </svg>
            <div className={styles.remoteCursorLabel} title={`${emoji} · …${shortId}`}>
              {emoji} <span style={{ opacity: 0.75, fontSize: 10 }}>…{shortId}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
