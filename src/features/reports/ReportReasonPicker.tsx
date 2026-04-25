import { Pressable, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';

/**
 * The schema-level enum for report reasons (PRD § 6 FR-021). Keep in lockstep
 * with `convex/schema.ts` reports.reason — adding or renaming a value here
 * without updating the schema validator (or vice versa) will throw at submit
 * time. The display label is curated copy; do not derive it from the enum
 * value programmatically because the wording matters and is reviewed with
 * trans advisors per TASK-068.
 */
export type ReportReason =
  | 'fetishization'
  | 'transphobia'
  | 'unwanted-sexual-content'
  | 'harassment'
  | 'safety-concern'
  | 'fake-profile'
  | 'underage'
  | 'spam'
  | 'other';

type ReasonOption = {
  value: ReportReason;
  label: string;
  description: string;
};

const REASONS: readonly ReasonOption[] = [
  {
    value: 'fetishization',
    label: 'Fetishizing behavior',
    description: 'Treating someone as a body type or category, not a person.',
  },
  {
    value: 'transphobia',
    label: 'Transphobia',
    description: 'Slurs, misgendering on purpose, or hateful language.',
  },
  {
    value: 'unwanted-sexual-content',
    label: 'Unwanted sexual content',
    description: 'Explicit messages or photos you didn’t ask for.',
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Threats, repeated unwanted contact, intimidation.',
  },
  {
    value: 'safety-concern',
    label: 'Safety concern',
    description: 'Self-harm, danger to themselves or others.',
  },
  {
    value: 'fake-profile',
    label: 'Fake profile',
    description: 'Impersonation, catfishing, or stolen photos.',
  },
  {
    value: 'underage',
    label: 'Underage',
    description: 'You believe this person is under 18.',
  },
  {
    value: 'spam',
    label: 'Spam or scam',
    description: 'Promotion, off-platform redirects, or fraud.',
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Tell us in your own words on the next step.',
  },
];

export type ReportReasonPickerProps = {
  selected: ReportReason | null;
  onSelect: (reason: ReportReason) => void;
};

/**
 * Vertical list of report reasons with two-line cells (label + description).
 * Single-select; tapping a row sets it as the chosen reason. Descriptions
 * are advisor-reviewed copy (TASK-068) — they do double duty as the
 * disambiguation cue for the reporter and as moderator-facing context for
 * what category the reporter intended.
 */
export function ReportReasonPicker({
  selected,
  onSelect,
}: ReportReasonPickerProps) {
  return (
    <View>
      {REASONS.map((option, index) => {
        const isSelected = selected === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label}. ${option.description}`}
            className={`flex-row items-start py-3 px-2 ${index > 0 ? 'border-t border-plum-50' : ''}`}
          >
            {/* Custom radio: an outlined circle that fills with plum-600 when
                selected. Avoids importing a third-party radio component and
                stays consistent with the rest of the app's hand-rolled
                interactive primitives (see Button.tsx, ToggleRow). */}
            <View
              className={`mt-1 h-5 w-5 rounded-full border-2 items-center justify-center ${
                isSelected ? 'border-plum-600' : 'border-plum-400'
              }`}
            >
              {isSelected && (
                <View className="h-2.5 w-2.5 rounded-full bg-plum-600" />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text
                variant="body"
                className={`text-base ${isSelected ? 'text-plum-900' : 'text-plum-700'}`}
              >
                {option.label}
              </Text>
              <Text variant="caption" className="text-xs text-plum-600 mt-0.5">
                {option.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
