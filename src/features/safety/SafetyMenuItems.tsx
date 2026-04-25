import { Pressable, View } from 'react-native';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { useBlockAction } from '~/src/features/blocks/BlockAction';

export type SafetyMenuItemsProps = {
  reportedUserId: Id<'users'>;
  reportedDisplayName: string;
  /**
   * Called when Report is tapped. Caller closes its parent menu and opens
   * the ReportSheet (composition belongs to the surface).
   */
  onReportPress: () => void;
  /**
   * Called when Block is tapped (before the confirm dialog). Use to close
   * the parent menu so the dialog doesn't render through the open menu.
   */
  onBlockPress?: () => void;
  /**
   * Called after the block lands. Both surfaces (ChatHeader, profile
   * detail) currently use this to `router.back()` since the surface
   * itself becomes invalid post-block.
   */
  onBlockSuccess?: () => void;
  /**
   * Whether to render a divider above the Report row. Set when the
   * surface has menu items above (e.g., ChatHeader's View profile);
   * leave off when the surface starts the menu with these items.
   */
  showLeadingDivider?: boolean;
  /**
   * Whether to render a divider below the Block row. Set when the
   * surface has menu items below (e.g., ChatHeader's Unmatch).
   */
  showTrailingDivider?: boolean;
};

/**
 * The Report + Block pair, rendered as two adjacent menu rows with a
 * divider between them. Designed to be dropped into an existing menu
 * Modal — the surface owns the Modal, the backdrop, and the absolute
 * positioning; this component owns the two rows themselves so the copy,
 * styling, and block-action wiring stay in one place across surfaces.
 *
 * Used by ChatHeader (alongside View profile + Unmatch) and
 * ProfileDetailScreen (alone). Extracted in Wave 2 round-1 to dedupe
 * the per-row rendering — the previous duplicates were drifting in
 * accessibilityLabels and onPress shape.
 */
export function SafetyMenuItems({
  reportedUserId,
  reportedDisplayName,
  onReportPress,
  onBlockPress,
  onBlockSuccess,
  showLeadingDivider = false,
  showTrailingDivider = false,
}: SafetyMenuItemsProps) {
  const blockUser = useBlockAction();

  return (
    <>
      {showLeadingDivider && <View className="h-px bg-plum-50" />}
      <Pressable
        onPress={onReportPress}
        className="px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={`Report ${reportedDisplayName}`}
      >
        <Text variant="body" className="text-plum-900">
          Report
        </Text>
      </Pressable>
      <View className="h-px bg-plum-50" />
      <Pressable
        onPress={() => {
          onBlockPress?.();
          blockUser({
            targetUserId: reportedUserId,
            displayName: reportedDisplayName,
            onSuccess: onBlockSuccess,
          });
        }}
        className="px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={`Block ${reportedDisplayName}`}
      >
        <Text variant="body" className="text-rose-700">
          Block
        </Text>
      </Pressable>
      {showTrailingDivider && <View className="h-px bg-plum-50" />}
    </>
  );
}
