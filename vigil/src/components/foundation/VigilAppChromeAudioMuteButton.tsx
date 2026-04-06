"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  ArchitecturalTooltip,
  ARCH_TOOLTIP_AVOID_BOTTOM,
} from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { readAppAudioMuted, subscribeAppAudioMuted, writeAppAudioMuted } from "@/src/lib/vigil-audio-prefs";

/**
 * Same preference as boot splash mute: ambient loops + SND UI sounds.
 * Shown in canvas chrome after boot dismisses (boot dock keeps its own control while splash is visible).
 */
export function VigilAppChromeAudioMuteButton() {
  const [muted, setMuted] = useState(() => readAppAudioMuted());

  useEffect(() => subscribeAppAudioMuted(() => setMuted(readAppAudioMuted())), []);

  const onToggle = useCallback(() => {
    const nextMuted = !muted;
    writeAppAudioMuted(nextMuted);
    setMuted(nextMuted);
  }, [muted]);

  const icon = muted ? (
    <SpeakerSlash size={18} weight="bold" aria-hidden />
  ) : (
    <SpeakerHigh size={18} weight="bold" aria-hidden />
  );

  const tip =
    muted
      ? "Unmute audio (ambient + interface sounds)"
      : "Mute audio (ambient + interface sounds)";

  return (
    <ArchitecturalTooltip
      content={tip}
      side="top"
      delayMs={320}
      avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
    >
      <Button
        type="button"
        variant="ghost"
        tone="glass"
        size="icon"
        iconOnly
        data-hg-chrome="app-audio-mute"
        aria-label={
          muted
            ? "Unmute audio — ambient layers and interface sounds"
            : "Mute audio — ambient layers and interface sounds"
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {icon}
      </Button>
    </ArchitecturalTooltip>
  );
}
