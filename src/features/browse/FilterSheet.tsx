import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMutation, useQuery } from 'convex/react';
import { X } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

const INTENTION_OPTIONS: { id: IntentionValue; label: string }[] = [
  { id: 'hookup', label: 'Hookup' },
  { id: 'dating', label: 'Dating' },
  { id: 'serious', label: 'Serious' },
  { id: 'friendship', label: 'Friendship' },
  { id: 'community', label: 'Community' },
  { id: 'figuring-it-out', label: 'Figuring it out' },
];

type IntentionValue =
  | 'hookup'
  | 'dating'
  | 'serious'
  | 'friendship'
  | 'community'
  | 'figuring-it-out';

const VALID_INTENTION_IDS = new Set<IntentionValue>(
  INTENTION_OPTIONS.map((o) => o.id),
);

function sanitizeIntentions(input: unknown): IntentionValue[] {
  if (!Array.isArray(input)) return [];
  return input.filter((i): i is IntentionValue =>
    typeof i === 'string' && VALID_INTENTION_IDS.has(i as IntentionValue),
  );
}

const AGE_MIN = 18;
const AGE_MAX = 70;
const DISTANCE_MIN = 5;
const DISTANCE_MAX = 100;

// Plum-600 — primary accent for active slider track and switch thumb.
const ACCENT = '#6D28D9';
// Plum-50 — inactive slider track color, keeps contrast low so the thumb
// reads as the focal point.
const TRACK_INACTIVE = '#F5F3FF';

export type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
};

export function FilterSheet({ visible, onClose, onApplied }: FilterSheetProps) {
  const prefs = useQuery(api.profiles.getMinePreferences);
  const updatePreferences = useMutation(api.profiles.updatePreferences);
  const track = useTrack();

  const [ageMin, setAgeMin] = useState(AGE_MIN);
  const [ageMax, setAgeMax] = useState(AGE_MAX);
  const [distanceKm, setDistanceKm] = useState(50);
  const [intentions, setIntentions] = useState<IntentionValue[]>([]);
  const [t4tOnly, setT4tOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showVerifiedHint, setShowVerifiedHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rehydrate from server prefs whenever the sheet opens. Keeping local state
  // lets the user adjust sliders freely without round-tripping to Convex on
  // every drag; Apply is the commit point.
  useEffect(() => {
    if (visible && prefs) {
      setAgeMin(clamp(prefs.ageMin ?? AGE_MIN, AGE_MIN, AGE_MAX));
      setAgeMax(clamp(prefs.ageMax ?? AGE_MAX, AGE_MIN, AGE_MAX));
      setDistanceKm(clamp(prefs.maxDistanceKm ?? 50, DISTANCE_MIN, DISTANCE_MAX));
      // Defence in depth: don't trust the server shape. Unknown/stale values
      // from a pre-enum-expansion profile would otherwise flow into
      // intentions.includes() checks and render invalid chip state.
      setIntentions(sanitizeIntentions(prefs.intentions));
      setT4tOnly(prefs.t4tPreference === 't4t-only');
      setVerifiedOnly(false);
      setShowVerifiedHint(false);
      setError(null);
    }
  }, [visible, prefs]);

  useEffect(() => {
    if (visible) track(AnalyticsEvents.FILTERS_OPENED);
    // `track` is stable; intentionally omit to avoid double-firing when the
    // PostHog provider re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isCis = prefs?.genderModality === 'cis';

  const toggleIntention = (value: IntentionValue) => {
    setIntentions((current) =>
      current.includes(value)
        ? current.filter((i) => i !== value)
        : // Cap at 3 intentions to match the onboarding rule.
          current.length >= 3
          ? current
          : [...current, value],
    );
  };

  const handleApply = async () => {
    if (!prefs) {
      // If the sheet is opened before getMinePreferences resolves, our local
      // state is still the AGE_MIN/AGE_MAX defaults rather than the user's
      // saved prefs. Applying now would silently overwrite with defaults.
      setError('Preferences are still loading. Please try again.');
      return;
    }
    if (ageMin > ageMax) {
      setError('Minimum age must not exceed maximum age.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({
        ageMin,
        ageMax,
        maxDistanceKm: distanceKm,
        intentions,
        // updatePreferences coerces cis → 'open' server-side, but also avoid
        // writing a redundant value if the sheet toggle is off on a cis user.
        t4tPreference: isCis ? 'open' : t4tOnly ? 't4t-only' : 'open',
      });
      track(AnalyticsEvents.FILTERS_APPLIED, {
        ageMin,
        ageMax,
        distanceKm,
        intentionCount: intentions.length,
        t4tOnly,
        verifiedOnly,
      });
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save filters');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-plum-900/40 justify-end">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
        <View className="bg-cream-50 rounded-t-lg max-h-[85%] pt-2 shadow-modal">
          <View className="items-center pb-2">
            <View className="w-10 h-1 rounded-full bg-plum-50" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2">
            <Text variant="heading" className="text-2xl text-plum-900">
              Filters
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              hitSlop={12}
            >
              <X color="#6D28D9" size={22} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Section title="Age range">
              <View className="flex-row justify-between mb-1">
                <Text variant="body" className="text-plum-600">
                  Minimum: {ageMin}
                </Text>
                <Text variant="body" className="text-plum-600">
                  Maximum: {ageMax}
                </Text>
              </View>
              <Slider
                minimumValue={AGE_MIN}
                maximumValue={AGE_MAX}
                step={1}
                value={ageMin}
                onValueChange={(v) => {
                  const next = Math.round(v);
                  setAgeMin(next);
                  // Push max up so it stays ≥ min. Keeps the server validator
                  // happy without a separate error state.
                  if (next > ageMax) setAgeMax(next);
                }}
                minimumTrackTintColor={ACCENT}
                maximumTrackTintColor={TRACK_INACTIVE}
                thumbTintColor={ACCENT}
              />
              <Slider
                minimumValue={AGE_MIN}
                maximumValue={AGE_MAX}
                step={1}
                value={ageMax}
                onValueChange={(v) => {
                  const next = Math.round(v);
                  setAgeMax(next);
                  if (next < ageMin) setAgeMin(next);
                }}
                minimumTrackTintColor={ACCENT}
                maximumTrackTintColor={TRACK_INACTIVE}
                thumbTintColor={ACCENT}
              />
            </Section>

            <Section title="Distance">
              <View className="flex-row justify-between mb-1">
                <Text variant="body" className="text-plum-600">
                  Up to {distanceKm} km
                </Text>
                <Text variant="caption" className="text-plum-400">
                  Saved for later
                </Text>
              </View>
              <Slider
                minimumValue={DISTANCE_MIN}
                maximumValue={DISTANCE_MAX}
                step={5}
                value={distanceKm}
                onValueChange={(v) => setDistanceKm(Math.round(v / 5) * 5)}
                minimumTrackTintColor={ACCENT}
                maximumTrackTintColor={TRACK_INACTIVE}
                thumbTintColor={ACCENT}
              />
              <Text variant="caption" className="text-plum-400 mt-1">
                City match is the geographic scope today. Distance becomes a live
                filter in a later phase.
              </Text>
            </Section>

            <Section title="Looking for">
              <View className="flex-row flex-wrap">
                {INTENTION_OPTIONS.map((opt) => {
                  const active = intentions.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => toggleIntention(opt.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      className={`px-3 py-2 rounded-full mr-2 mb-2 ${
                        active ? 'bg-plum-600' : 'bg-plum-50'
                      }`}
                    >
                      <Text
                        variant="body"
                        className={`text-sm ${active ? 'text-cream-50' : 'text-plum-700'}`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="caption" className="text-plum-400 mt-1">
                Up to three.
              </Text>
            </Section>

            {!isCis && (
              <Section title="T4T">
                <ToggleRow
                  label="Show T4T matches only"
                  description="Only trans and non-binary profiles."
                  value={t4tOnly}
                  onValueChange={setT4tOnly}
                />
              </Section>
            )}

            <Section title="Verified only">
              <ToggleRow
                label="Only photo-verified profiles"
                description="Coming with verification in Phase 5."
                value={verifiedOnly}
                onValueChange={(v) => {
                  setVerifiedOnly(v);
                  if (v) setShowVerifiedHint(true);
                }}
              />
              {showVerifiedHint && (
                <Text variant="caption" className="text-plum-400 mt-1">
                  Verified-only filtering goes live when photo verification
                  ships in Phase 5.
                </Text>
              )}
            </Section>

            {error && (
              <View className="mx-5 mt-2">
                <Text variant="body" className="text-sm text-rose-700">
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="px-5 pt-2 pb-6 border-t border-plum-50 flex-row">
            <View className="flex-1 mr-2">
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </View>
            <View className="flex-1 ml-2">
              <Button
                label="Apply"
                variant="primary"
                onPress={handleApply}
                loading={saving}
                disabled={!prefs || saving}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="px-5 pt-4 pb-2">
      <Text variant="heading" className="text-base text-plum-900 mb-2">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 mr-3">
        <Text variant="body" className="text-base text-plum-900">
          {label}
        </Text>
        <Text variant="caption" className="text-plum-400 mt-0.5">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: TRACK_INACTIVE, true: ACCENT }}
        thumbColor="#FAFAFF"
      />
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
