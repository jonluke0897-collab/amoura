import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { RespectPledgeStandard } from '~/src/features/onboarding/RespectPledgeStandard';
import { RespectPledgeExtended } from '~/src/features/onboarding/RespectPledgeExtended';
import { PLEDGE_VERSION } from '~/src/features/onboarding/pledgeCopy';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function PledgeScreen() {
  const status = useQuery(api.profiles.getMineStatus);
  const acceptPledge = useMutation(api.profiles.acceptPledge);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard against rapid double-taps. setState is asynchronous and
  // doesn't flip the button's disabled prop until the next render, so two taps
  // landing in the same frame could both enter handleAccept. The ref closes
  // that window.
  const inFlightRef = useRef(false);
  const track = useTrack();

  if (status === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6D28D9" />
      </View>
    );
  }

  // Not signed in / user row missing — bounce back to the root router.
  if (status === null) return <Redirect href="/" />;

  // Modality unset (webhook race or back-button edge case): send them back to identity
  // rather than defaulting to standard based on null-as-not-cis.
  if (status.isCis === null) return <Redirect href="/(onboarding)/identity" />;

  const pledgeType: 'standard' | 'extended' = status.isCis === true ? 'extended' : 'standard';

  const handleAccept = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await acceptPledge({ pledgeType, pledgeVersion: PLEDGE_VERSION });
      track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 'pledge' });
      // ONBOARDING_COMPLETED now fires from the complete screen, after
      // photos and prompts land. Pledge is no longer the completion boundary.
      router.replace('/(onboarding)/photos');
    } catch (e) {
      // Full error details go to the dev console for diagnostics. The user-visible
      // message intentionally keeps e.message because our server-thrown errors
      // (e.g. "Complete intentions step first") are user-actionable guidance, not
      // internal leakage. Phase 7 polish will replace these with advisor-reviewed
      // copy; until then this is the most useful surface for both users and devs.
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[pledge] acceptPledge failed:', e);
      }
      setError(e instanceof Error ? e.message : 'Something went sideways. Try again?');
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  return (
    <View className="flex-1 px-5 pt-4">
      {pledgeType === 'extended' ? (
        <RespectPledgeExtended
          submitting={submitting}
          errorMessage={error}
          onAccept={handleAccept}
          onDisagree={() => router.replace('/(onboarding)/pledge-exit')}
        />
      ) : (
        <RespectPledgeStandard
          submitting={submitting}
          errorMessage={error}
          onAccept={handleAccept}
        />
      )}
    </View>
  );
}
