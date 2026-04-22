import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { Input } from '~/src/components/ui/Input';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { SIGN_IN } from '~/src/features/onboarding/onboardingCopy';
import { useOAuthFlow } from './useOAuthFlow';

export function SignInCard() {
  const { signInWith, sendMagicLink, busy } = useOAuthFlow();
  const track = useTrack();

  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (method: 'apple' | 'google') => {
    setError(null);
    track(AnalyticsEvents.SIGN_IN_ATTEMPTED, { method });
    try {
      const result = await signInWith(method);
      if (result.status === 'complete') {
        track(AnalyticsEvents.SIGN_IN_SUCCEEDED, { method });
        // Bounce to / so the root router re-evaluates against the newly-signed-in state.
        router.replace('/');
      } else {
        // User dismissed the OAuth sheet. Not a failure — track separately for funnel analysis.
        track(AnalyticsEvents.SIGN_IN_CANCELLED, { method });
      }
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method });
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again?');
    }
  };

  // Basic structural check (local@domain.tld). Clerk handles real validation server-side;
  // this just stops obvious malformed inputs from making a round trip.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    track(AnalyticsEvents.SIGN_IN_ATTEMPTED, { method: 'email' });
    try {
      await sendMagicLink(trimmed);
      setEmailSent(trimmed);
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email' });
      setError(e instanceof Error ? e.message : 'Could not send the link. Try again?');
    }
  };

  return (
    <View>
      <Text variant="heading" className="text-4xl text-plum-600">
        {SIGN_IN.brand}
      </Text>
      <Text variant="body" className="mt-2 text-lg">
        {SIGN_IN.heading}
      </Text>
      <Text variant="caption" className="mt-1">
        {SIGN_IN.subhead}
      </Text>

      <View className="mt-10 gap-3">
        <Button
          label={SIGN_IN.appleCta}
          size="lg"
          loading={busy === 'apple'}
          disabled={busy !== null}
          onPress={() => handleOAuth('apple')}
        />
        <Button
          label={SIGN_IN.googleCta}
          variant="secondary"
          size="lg"
          loading={busy === 'google'}
          disabled={busy !== null}
          onPress={() => handleOAuth('google')}
        />
        <Button
          label={SIGN_IN.emailCta}
          variant="ghost"
          size="lg"
          disabled={busy !== null}
          onPress={() => {
            setEmail('');
            setEmailSent(null);
            setError(null);
            setEmailSheetOpen(true);
          }}
        />
      </View>

      {error && !emailSheetOpen ? (
        <Text variant="caption" className="mt-4 text-rose-700">
          {error}
        </Text>
      ) : null}

      <Text variant="caption" className="mt-8 text-xs">
        {SIGN_IN.termsFooter}
      </Text>

      <Modal
        visible={emailSheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEmailSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-cream-50"
        >
          <View className="flex-row justify-end p-4">
            <Pressable
              onPress={() => setEmailSheetOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="p-2"
            >
              <X color="#6D28D9" size={24} />
            </Pressable>
          </View>
          <View className="flex-1 px-5">
            {emailSent ? (
              <>
                <Text variant="heading" className="text-3xl text-plum-900 mb-3">
                  {SIGN_IN.emailSentTitle}
                </Text>
                <Text variant="body" className="text-plum-900 leading-6 mb-6">
                  {SIGN_IN.emailSentBody.replace('{email}', emailSent)}
                </Text>
                <Button
                  label="Done"
                  variant="secondary"
                  onPress={() => setEmailSheetOpen(false)}
                />
              </>
            ) : (
              <>
                <Text variant="heading" className="text-3xl text-plum-900 mb-2">
                  {SIGN_IN.emailSheetTitle}
                </Text>
                <Text variant="caption" className="mb-6">
                  {SIGN_IN.emailSheetHelp}
                </Text>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder={SIGN_IN.emailInputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
                {error ? (
                  <Text variant="caption" className="mt-2 text-rose-700">
                    {error}
                  </Text>
                ) : null}
                <Button
                  className="mt-6"
                  label={SIGN_IN.emailSendCta}
                  size="lg"
                  loading={busy === 'email'}
                  disabled={busy !== null || email.trim().length === 0}
                  onPress={handleEmailSubmit}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
