import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressDots } from '~/src/features/onboarding/ProgressDots';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

const STEP_ORDER = [
  'identity',
  'intentions',
  'pledge',
  'photos',
  'prompts',
  'complete',
] as const;
type Step = (typeof STEP_ORDER)[number];

function pathnameToStep(pathname: string): Step | null {
  // Expo Router pathnames for routes like /(onboarding)/identity normalize to /identity.
  const match = pathname.match(
    /\/(identity|intentions|pledge|photos|prompts|complete)\b/,
  );
  return (match?.[1] as Step) ?? null;
}

export default function OnboardingLayout() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';
  const step = pathnameToStep(pathname ?? '');
  const currentIndex = step ? STEP_ORDER.indexOf(step) : 0;
  const track = useTrack();
  const lastStepRef = useRef<Step | null>(step);
  // Hold track in a ref so the AppState listener effect below can depend on []
  // without stale-closure bugs — useTrack returns a fresh function identity on
  // each render, which would otherwise re-register the listener constantly.
  const trackRef = useRef(track);
  trackRef.current = track;

  useEffect(() => {
    lastStepRef.current = step;
  }, [step]);

  // Edit mode reuses the onboarding routes but isn't a funnel in progress, so
  // don't emit ONBOARDING_ABANDONED if the user backgrounds while editing —
  // that would pollute the abandonment metric with healthy post-onboarding
  // traffic. Kept in a ref so the listener effect can stay mount-scoped.
  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        next === 'background' &&
        !isEditModeRef.current &&
        lastStepRef.current &&
        lastStepRef.current !== 'complete'
      ) {
        trackRef.current(AnalyticsEvents.ONBOARDING_ABANDONED, { lastStep: lastStepRef.current });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream-50">
      {!isEditMode && (
        <View className="px-5 pt-3 pb-2">
          <ProgressDots total={STEP_ORDER.length} currentIndex={currentIndex} />
        </View>
      )}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAFAFF' } }} />
    </SafeAreaView>
  );
}
