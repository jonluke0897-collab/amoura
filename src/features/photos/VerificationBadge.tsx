import { View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

export type VerificationBadgeProps = {
  status: 'verified' | 'unverified';
  size?: number;
};

/**
 * Placeholder for Phase 5 selfie-verification (TASK-059+). Only renders in
 * the 'verified' state: a check-mark glyph for unverified users would leak
 * the look-and-feel of a trust signal without the backing verification,
 * which weakens the meaning of the real badge when it lands in Phase 5.
 */
export function VerificationBadge({ status, size = 20 }: VerificationBadgeProps) {
  if (status !== 'verified') return null;
  return (
    <View
      className="rounded-full p-1.5"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
      accessibilityLabel="Verified profile"
    >
      <BadgeCheck color="#6D28D9" size={size} />
    </View>
  );
}
