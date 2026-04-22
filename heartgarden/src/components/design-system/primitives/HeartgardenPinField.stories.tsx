"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ComponentProps } from "react";

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
  props: Omit<ComponentProps<typeof HeartgardenPinField>, "value" | "onValueChange" | "onSubmit"> & {
    onSubmit?: () => void;
  },
) {
  const [value, setValue] = useState("");
  return (
    <HeartgardenPinField
      {...props}
      value={value}
      onValueChange={setValue}
      onSubmit={props.onSubmit ?? (() => {})}
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
      legend="Access code"
      value={value}
      onValueChange={setValue}
      onSubmit={() => {}}
      errorMessage="Access denied."
    />
  );
}

export const WithError: Story = {
  render: () => <WithErrorStory />,
};

export const Disabled: Story = {
  render: (args) => <InteractivePinField {...args} disabled />,
};
