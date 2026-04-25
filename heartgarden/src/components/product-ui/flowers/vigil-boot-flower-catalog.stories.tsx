import type { Meta, StoryObj } from "@storybook/nextjs";

import { VigilBootFlowerCatalog } from "./vigil-boot-flower-catalog";

const meta = {
  component: VigilBootFlowerCatalog,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
  title: "Heartgarden/Product UI/Flowers/Boot flower catalog",
} satisfies Meta<typeof VigilBootFlowerCatalog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every bloom shape × every species (full-size cluster at stem tip). */
export const AllFullBlooms: Story = {
  args: { kind: "full" },
};

/** Same matrix with mini / blocked blooms (early-death variant). */
export const AllMiniBlooms: Story = {
  args: { kind: "mini" },
};
