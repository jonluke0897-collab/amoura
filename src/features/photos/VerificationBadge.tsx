import { View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

export type VerificationBadgeProps = {
  status: 'verified' | 'unverified';
  size?: number;
};

/**
 * Placeholder for Phase 5 selfie-verification (TASK-059+). The badge component
 * supports both states so the rest of the UI can be built against a stable
 * contract; Phase 2 always passes status="unverified", so the rendered output
 * is a neutral pill until real verification ships.
 */
export function VerificationBadge({ status, size = 20 }: VerificationBadgeProps) {
  const color = status === 'verified' ? '#6D28D9' : '#A78BFA';
  return (
    <View
      className="rounded-full p-1.5"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
      accessibilityLabel={
        status === 'verified' ? 'Verified profile' : 'Not yet verified'
      }
    >
      <BadgeCheck color={color} size={size} />
    </View>
  );
}
