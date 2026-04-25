"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  ARCH_TOOLTIP_AVOID_BOTTOM,
  ArchitecturalTooltip,
} from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import {
  readAppAudioMuted,
  subscribeAppAudioMuted,
  writeAppAudioMuted,
} from "@/src/lib/vigil-audio-prefs";

/**
 * Same preference as boot splash mute: ambient loops + SND UI sounds.
 * Shown in canvas chrome after boot dismisses (boot dock keeps its own control while splash is visible).
 */
export function VigilAppChromeAudioMuteButton() {
  const [muted, setMuted] = useState(() => readAppAudioMuted());

  useEffect(
    () => subscribeAppAudioMuted(() => setMuted(readAppAudioMuted())),
    []
  );

  const onToggle = useCallback(() => {
    const nextMuted = !muted;
    writeAppAudioMuted(nextMuted);
    setMuted(nextMuted);
  }, [muted]);

  const icon = muted ? (
    <SpeakerSlash aria-hidden size={18} weight="bold" />
  ) : (
    <SpeakerHigh aria-hidden size={18} weight="bold" />
  );

  const tip = muted
    ? "Unmute audio (ambient + interface sounds)"
    : "Mute audio (ambient + interface sounds)";

  return (
    <ArchitecturalTooltip
      avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
      content={tip}
      delayMs={320}
      side="top"
    >
      <Button
        aria-label={
          muted
            ? "Unmute audio — ambient layers and interface sounds"
            : "Mute audio — ambient layers and interface sounds"
        }
        data-hg-chrome="app-audio-mute"
        iconOnly
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        size="icon"
        tone="glass"
        type="button"
        variant="ghost"
      >
        {icon}
      </Button>
    </ArchitecturalTooltip>
  );
}
