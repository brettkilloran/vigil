# Storybook Reorg Mapping Matrix

This matrix maps the current Storybook layout to the new design-system-first taxonomy and folder layout.

## Target Roots

- `src/components/design-system/primitives/`
- `src/components/design-system/tokens/`
- `src/components/product-ui/flowers/`
- `src/components/product-ui/canvas/`
- `src/components/product-ui/lore/`
- `src/components/experiments/`

## Story Mapping

| Current Story File | Current Title | Target Folder | Target Title |
| --- | --- | --- | --- |
| `src/components/StorybookOverview.stories.tsx` | `Heartgarden/Overview` | `src/components/StorybookOverview.stories.tsx` | `Heartgarden/Design System/Overview` |
| `src/components/ui/Button.stories.tsx` | `Heartgarden/UI/Button` | `src/components/design-system/primitives/Button.stories.tsx` | `Heartgarden/Design System/Primitives/Button` |
| `src/components/ui/Tag.stories.tsx` | `Heartgarden/UI/Tag` | `src/components/design-system/primitives/Tag.stories.tsx` | `Heartgarden/Design System/Primitives/Tag` |
| `src/components/ui/ContextMenu.stories.tsx` | `Heartgarden/UI/Context menu` | `src/components/design-system/primitives/ContextMenu.stories.tsx` | `Heartgarden/Design System/Primitives/Context menu` |
| `src/components/ui/HeartgardenPinField.stories.tsx` | `Heartgarden/UI/Pin field` | `src/components/design-system/primitives/HeartgardenPinField.stories.tsx` | `Heartgarden/Design System/Primitives/Pin field` |
| `src/components/ui/HeartgardenMediaPlaceholderImg.stories.tsx` | `Heartgarden/UI/Media placeholder` | `src/components/design-system/primitives/HeartgardenMediaPlaceholderImg.stories.tsx` | `Heartgarden/Design System/Primitives/Media placeholder` |
| `src/components/editing/BufferedTextInput.stories.tsx` | `Heartgarden/UI/Buffered text input` | `src/components/design-system/primitives/BufferedTextInput.stories.tsx` | `Heartgarden/Design System/Primitives/Buffered text input` |
| `src/components/editing/BufferedContentEditable.stories.tsx` | `Heartgarden/UI/Buffered content editable` | `src/components/design-system/primitives/BufferedContentEditable.stories.tsx` | `Heartgarden/Design System/Primitives/Buffered content editable` |
| `src/components/foundation/DesignSystemTokens.stories.tsx` | `Heartgarden/UI/Tokens source of truth` | `src/components/design-system/tokens/DesignSystemTokens.stories.tsx` | `Heartgarden/Design System/Tokens/Source of truth` |
| `src/components/foundation/VigilBootFlowerCatalog.stories.tsx` | `Heartgarden/UI/Boot flower catalog` | `src/components/product-ui/flowers/VigilBootFlowerCatalog.stories.tsx` | `Heartgarden/Product UI/Flowers/Boot flower catalog` |
| `src/components/foundation/VigilAppBootScreen.stories.tsx` | `Heartgarden/UI/Boot screen` | `src/components/product-ui/flowers/VigilAppBootScreen.stories.tsx` | `Heartgarden/Product UI/Flowers/Boot screen` |
| `src/components/product-ui/flowers/VigilBootFlowerGarden.stories.tsx` | _new_ | `src/components/product-ui/flowers/VigilBootFlowerGarden.stories.tsx` | `Heartgarden/Product UI/Flowers/Boot flower garden` |
| `src/components/foundation/ArchitecturalCanvasApp.stories.tsx` | `Heartgarden/UI/Full canvas` | `src/components/product-ui/canvas/ArchitecturalCanvasApp.stories.tsx` | `Heartgarden/Product UI/Canvas/Full canvas` |
| `src/components/foundation/ArchitecturalBottomDock.stories.tsx` | `Heartgarden/UI/Bottom dock` | `src/components/product-ui/canvas/ArchitecturalBottomDock.stories.tsx` | `Heartgarden/Product UI/Canvas/Bottom dock` |
| `src/components/foundation/ArchitecturalToolRail.stories.tsx` | `Heartgarden/UI/Tool rail` | `src/components/product-ui/canvas/ArchitecturalToolRail.stories.tsx` | `Heartgarden/Product UI/Canvas/Tool rail` |
| `src/components/foundation/ArchitecturalToolButton.stories.tsx` | `Heartgarden/UI/Tool button` | `src/components/product-ui/canvas/ArchitecturalToolButton.stories.tsx` | `Heartgarden/Product UI/Canvas/Tool button` |
| `src/components/foundation/ArchitecturalButton.stories.tsx` | `Heartgarden/UI/Shell button` | `src/components/product-ui/canvas/ArchitecturalButton.stories.tsx` | `Heartgarden/Product UI/Canvas/Shell button` |
| `src/components/foundation/ArchitecturalFocusCloseButton.stories.tsx` | `Heartgarden/UI/Focus close button` | `src/components/product-ui/canvas/ArchitecturalFocusCloseButton.stories.tsx` | `Heartgarden/Product UI/Canvas/Focus close button` |
| `src/components/foundation/ArchitecturalStatusBar.stories.tsx` | `Heartgarden/UI/Status bar` | `src/components/product-ui/canvas/ArchitecturalStatusBar.stories.tsx` | `Heartgarden/Product UI/Canvas/Status bar` |
| `src/components/foundation/ArchitecturalStatusBadge.stories.tsx` | `Heartgarden/UI/Status badge` | `src/components/product-ui/canvas/ArchitecturalStatusBadge.stories.tsx` | `Heartgarden/Product UI/Canvas/Status badge` |
| `src/components/foundation/ArchitecturalStatusMetric.stories.tsx` | `Heartgarden/UI/Status metric` | `src/components/product-ui/canvas/ArchitecturalStatusMetric.stories.tsx` | `Heartgarden/Product UI/Canvas/Status metric` |
| `src/components/foundation/ArchitecturalCreateMenu.stories.tsx` | `Heartgarden/UI/Create menu` | `src/components/product-ui/canvas/ArchitecturalCreateMenu.stories.tsx` | `Heartgarden/Product UI/Canvas/Create menu` |
| `src/components/foundation/ArchitecturalParentExitThreshold.stories.tsx` | `Heartgarden/UI/Parent exit threshold` | `src/components/product-ui/canvas/ArchitecturalParentExitThreshold.stories.tsx` | `Heartgarden/Product UI/Canvas/Parent exit threshold` |
| `src/components/foundation/ArchitecturalRemotePresenceLayer.stories.tsx` | `Heartgarden/UI/Remote presence cursors` | `src/components/product-ui/canvas/ArchitecturalRemotePresenceLayer.stories.tsx` | `Heartgarden/Product UI/Canvas/Remote presence cursors` |
| `src/components/foundation/ArchitecturalNodeCard.stories.tsx` | `Heartgarden/UI/Node card` | `src/components/product-ui/canvas/ArchitecturalNodeCard.stories.tsx` | `Heartgarden/Product UI/Canvas/Node card` |
| `src/components/foundation/ArchitecturalNodeHeader.stories.tsx` | `Heartgarden/UI/Node header` | `src/components/product-ui/canvas/ArchitecturalNodeHeader.stories.tsx` | `Heartgarden/Product UI/Canvas/Node header` |
| `src/components/foundation/ArchitecturalNodeBody.stories.tsx` | `Heartgarden/UI/Node body` | `src/components/product-ui/canvas/ArchitecturalNodeBody.stories.tsx` | `Heartgarden/Product UI/Canvas/Node body` |
| `src/components/foundation/ArchitecturalNodeTape.stories.tsx` | `Heartgarden/UI/Node tape` | `src/components/product-ui/canvas/ArchitecturalNodeTape.stories.tsx` | `Heartgarden/Product UI/Canvas/Node tape` |
| `src/components/foundation/ArchitecturalFolderCard.stories.tsx` | `Heartgarden/UI/Folder card` | `src/components/product-ui/canvas/ArchitecturalFolderCard.stories.tsx` | `Heartgarden/Product UI/Canvas/Folder card` |
| `src/components/foundation/ArchitecturalFormatToolbar.stories.tsx` | `Heartgarden/UI/Format toolbar` | `src/components/product-ui/canvas/ArchitecturalFormatToolbar.stories.tsx` | `Heartgarden/Product UI/Canvas/Format toolbar` |
| `src/components/foundation/ArchitecturalTooltip.stories.tsx` | `Heartgarden/UI/Tooltip` | `src/components/product-ui/canvas/ArchitecturalTooltip.stories.tsx` | `Heartgarden/Product UI/Canvas/Tooltip` |
| `src/components/foundation/CanvasViewportToast.stories.tsx` | `Heartgarden/UI/Canvas viewport toast` | `src/components/product-ui/canvas/CanvasViewportToast.stories.tsx` | `Heartgarden/Product UI/Canvas/Canvas viewport toast` |
| `src/components/foundation/CanvasMinimap.stories.tsx` | `Heartgarden/Foundation/Canvas minimap` | `src/components/product-ui/canvas/CanvasMinimap.stories.tsx` | `Heartgarden/Product UI/Canvas/Canvas minimap` |
| `src/components/foundation/VigilAppChromeAudioMuteButton.stories.tsx` | `Heartgarden/UI/App audio mute` | `src/components/product-ui/canvas/VigilAppChromeAudioMuteButton.stories.tsx` | `Heartgarden/Product UI/Canvas/App audio mute` |
| `src/components/ui/CommandPalette.stories.tsx` | `Heartgarden/UI/Command palette` | `src/components/product-ui/canvas/CommandPalette.stories.tsx` | `Heartgarden/Product UI/Canvas/Command palette` |
| `src/components/ui/LinkGraphOverlay.stories.tsx` | `Heartgarden/UI/Link graph overlay` | `src/components/product-ui/canvas/LinkGraphOverlay.stories.tsx` | `Heartgarden/Product UI/Canvas/Link graph overlay` |
| `src/components/ui/ArchitecturalLinksPanel.stories.tsx` | `Heartgarden/UI/Links panel (debug)` | `src/components/product-ui/canvas/ArchitecturalLinksPanel.stories.tsx` | `Heartgarden/Product UI/Canvas/Links panel` |
| `src/components/ui/CanvasDebugInspectorShell.stories.tsx` | `Heartgarden/UI/Debug inspector shell` | `src/components/product-ui/canvas/CanvasDebugInspectorShell.stories.tsx` | `Heartgarden/Product UI/Canvas/Debug inspector shell` |
| `src/components/foundation/ArchitecturalLoreCharacterCanvasNode.stories.tsx` | `Heartgarden/UI/Lore canvas · character coverage` | `src/components/product-ui/lore/ArchitecturalLoreCharacterCanvasNode.stories.tsx` | `Heartgarden/Product UI/Lore/Character canvas coverage` |
| `src/components/foundation/ArchitecturalLoreLocationCanvasNode.stories.tsx` | `Heartgarden/UI/Lore canvas · location coverage` | `src/components/product-ui/lore/ArchitecturalLoreLocationCanvasNode.stories.tsx` | `Heartgarden/Product UI/Lore/Location canvas coverage` |
| `src/components/foundation/ArchitecturalLoreFactionArchiveCanvasNode.stories.tsx` | `Heartgarden/UI/Lore canvas · organization coverage` | `src/components/product-ui/lore/ArchitecturalLoreFactionArchiveCanvasNode.stories.tsx` | `Heartgarden/Product UI/Lore/Organization canvas coverage` |
| `src/components/foundation/ArchitecturalLoreReviewPanel.stories.tsx` | `Heartgarden/UI/Vault review panel` | `src/components/product-ui/lore/ArchitecturalLoreReviewPanel.stories.tsx` | `Heartgarden/Product UI/Lore/Vault review panel` |
| `src/components/ui/LoreAskPanel.stories.tsx` | `Heartgarden/UI/Lore ask panel` | `src/components/product-ui/lore/LoreAskPanel.stories.tsx` | `Heartgarden/Product UI/Lore/Lore ask panel` |
| `src/components/transition-experiment/VigilFlowRevealOverlay.stories.tsx` | `Heartgarden/Experiments/Flow reveal overlay` | `src/components/experiments/VigilFlowRevealOverlay.stories.tsx` | `Heartgarden/Experiments/Flow reveal overlay` |

