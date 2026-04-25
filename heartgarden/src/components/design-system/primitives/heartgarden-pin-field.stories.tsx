"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { type ComponentProps, useState } from "react";

import { HeartgardenPinField } from "@/src/components/ui/heartgarden-pin-field";

const meta: Meta<typeof HeartgardenPinField> = {
  args: {
    autoFocus: false,
    disabled: false,
    errorMessage: null,
    legend: "Access code",
    submitting: false,
  },
  argTypes: {
    onSubmit: { control: false },
    onValueChange: { control: false },
    value: { control: false },
  },
  component: HeartgardenPinField,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          minHeight: 200,
          padding: 32,
        }}
      >
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Design System/Primitives/Pin field",
};

export default meta;
type Story = StoryObj<typeof HeartgardenPinField>;

function InteractivePinField(
  props: Omit<
    ComponentProps<typeof HeartgardenPinField>,
    "value" | "onValueChange" | "onSubmit"
  > & {
    onSubmit?: () => void;
  }
) {
  const [value, setValue] = useState("");
  return (
    <HeartgardenPinField
      {...props}
      onSubmit={
        props.onSubmit ??
        (() => {
          /* noop */
        })
      }
      onValueChange={setValue}
      value={value}
    />
  );
}

export const Playground: Story = {
  render: (args) => <InteractivePinField {...args} />,
};

function WithErrorStory() {
  const [value, setValue] = useState("abcdefgh");
  return (
    <HeartgardenPinField
      errorMessage="Access denied."
      legend="Access code"
      onSubmit={() => {
        /* noop */
      }}
      onValueChange={setValue}
      value={value}
    />
  );
}

export const WithError: Story = {
  render: () => <WithErrorStory />,
};

export const Disabled: Story = {
  render: (args) => <InteractivePinField {...args} disabled />,
};
