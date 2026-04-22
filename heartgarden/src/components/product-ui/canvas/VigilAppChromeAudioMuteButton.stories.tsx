"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { VigilAppChromeAudioMuteButton } from "@/src/components/foundation/VigilAppChromeAudioMuteButton";

const meta = {
  title: "Heartgarden/Product UI/Canvas/App audio mute",
  component: VigilAppChromeAudioMuteButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Post-boot chrome control; reads/writes the same mute preference as the boot splash (ambient + UI sounds).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--vigil-border)] bg-[var(--ui-glass-bg)] px-4 py-3 backdrop-blur-xl">
        <Story />
        <span className="text-sm text-[var(--sem-text-muted)]">Toggle updates shared app audio prefs</span>
      </div>
    ),
  ],
} satisfies Meta<typeof VigilAppChromeAudioMuteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <VigilAppChromeAudioMuteButton />,
};
