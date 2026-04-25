"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { VigilAppChromeAudioMuteButton } from "@/src/components/foundation/vigil-app-chrome-audio-mute-button";

const meta = {
  component: VigilAppChromeAudioMuteButton,
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--vigil-border)] bg-[var(--ui-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <Story />
        <span className="text-[var(--sem-text-muted)] text-sm">
          Toggle updates shared app audio prefs
        </span>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Post-boot chrome control; reads/writes the same mute preference as the boot splash (ambient + UI sounds).",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Product UI/Canvas/App audio mute",
} satisfies Meta<typeof VigilAppChromeAudioMuteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <VigilAppChromeAudioMuteButton />,
};
