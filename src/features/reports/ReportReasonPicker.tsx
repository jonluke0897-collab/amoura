import { Pressable, View } from 'react-native';
import { Text } from '~/src/components/ui/Text';
import { REPORT_REASON_LABELS, type ReportReason } from './reportReasons';

export type { ReportReason };

type ReasonOption = {
  value: ReportReason;
  description: string;
};

// Per-reason descriptions live here (not in the shared module) because
// they're only shown at report-submission time. The shared module owns
// the label catalogue; this array adds the picker-only disambiguation
// copy on top.
const REASON_DESCRIPTIONS: Readonly<Record<ReportReason, string>> = {
  fetishization: 'Treating someone as a body type or category, not a person.',
  transphobia: 'Slurs, misgendering on purpose, or hateful language.',
  'unwanted-sexual-content': 'Explicit messages or photos you didn’t ask for.',
  harassment: 'Threats, repeated unwanted contact, intimidation.',
  'safety-concern': 'Self-harm, danger to themselves or others.',
  'fake-profile': 'Impersonation, catfishing, or stolen photos.',
  underage: 'You believe this person is under 18.',
  spam: 'Promotion, off-platform redirects, or fraud.',
  other: 'Tell us in your own words on the next step.',
};

// Build options in the canonical display order from the shared label map.
// Object.entries on a typed Record preserves declaration order at runtime,
// so the order matches the shared module's source.
const REASONS: readonly ReasonOption[] = (
  Object.keys(REPORT_REASON_LABELS) as ReportReason[]
).map((value) => ({
  value,
  description: REASON_DESCRIPTIONS[value],
}));

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
        const label = REPORT_REASON_LABELS[option.value];
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${label}. ${option.description}`}
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
                {label}
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
