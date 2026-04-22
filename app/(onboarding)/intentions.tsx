import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { IntentionPicker } from '~/src/features/onboarding/IntentionPicker';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function IntentionsScreen() {
  const upsertIntentions = useMutation(api.profiles.upsertIntentions);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const track = useTrack();

  return (
    <View className="flex-1 px-5 pt-4">
      <IntentionPicker
        submitting={submitting}
        errorMessage={error}
        onSubmit={async (intentions) => {
          setSubmitting(true);
          setError(null);
          try {
            await upsertIntentions({ intentions });
            track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 'intentions' });
            router.replace('/(onboarding)/pledge');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went sideways. Try again?');
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </View>
  );
}
