import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { IdentityForm } from '~/src/features/onboarding/IdentityForm';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function IdentityScreen() {
  const upsertIdentity = useMutation(api.profiles.upsertIdentity);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const track = useTrack();

  return (
    <View className="flex-1 px-5 pt-4">
      <IdentityForm
        submitting={submitting}
        errorMessage={error}
        onSubmit={async (values) => {
          setSubmitting(true);
          setError(null);
          try {
            await upsertIdentity({
              pronouns: values.pronouns,
              genderIdentity: values.genderIdentity,
              genderModality: values.genderModality,
              orientation: values.orientation,
              t4tPreference: values.t4tPreference,
            });
            track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: 'identity' });
            router.replace('/(onboarding)/intentions');
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
