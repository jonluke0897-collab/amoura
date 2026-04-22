import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { IdentityForm } from '~/src/features/onboarding/IdentityForm';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

export default function IdentityScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';
  const me = useQuery(api.users.me, isEditMode ? {} : 'skip');
  const upsertIdentity = useMutation(api.profiles.upsertIdentity);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const track = useTrack();

  // Wait for the initial profile snapshot in edit mode so we can pre-fill the
  // form. Skipping this would flash an empty form, then re-render with values
  // once the query lands.
  if (isEditMode && me === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6D28D9" />
      </View>
    );
  }

  const initialValues = isEditMode && me?.profile
    ? {
        pronouns: me.profile.pronouns,
        genderIdentity: me.profile.genderIdentity,
        genderModality: me.profile.genderModality,
        orientation: me.profile.orientation,
        t4tPreference: me.profile.t4tPreference,
      }
    : undefined;

  return (
    <View className="flex-1 px-5 pt-4">
      <IdentityForm
        submitting={submitting}
        errorMessage={error}
        initialValues={initialValues}
        submitLabel={isEditMode ? 'Save' : undefined}
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
            if (isEditMode) router.back();
            else router.replace('/(onboarding)/intentions');
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
