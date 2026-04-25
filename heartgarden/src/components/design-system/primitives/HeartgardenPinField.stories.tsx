"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { type ComponentProps, useState } from "react";

import { HeartgardenPinField } from "@/src/components/ui/HeartgardenPinField";

const meta: Meta<typeof HeartgardenPinField> = {
  title: "Heartgarden/Design System/Primitives/Pin field",
  component: HeartgardenPinField,
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 32,
          minHeight: 200,
          background: "var(--sem-surface-base)",
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    legend: "Access code",
    disabled: false,
    submitting: false,
    errorMessage: null,
    autoFocus: false,
  },
  argTypes: {
    onValueChange: { control: false },
    onSubmit: { control: false },
    value: { control: false },
  },
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
      onSubmit={props.onSubmit ?? (() => {})}
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
      onSubmit={() => {}}
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
