import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { Input } from '~/src/components/ui/Input';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';
import { SIGN_IN } from '~/src/features/onboarding/onboardingCopy';
import { EMAIL_PATTERN } from '~/src/lib/validation';
import { useOAuthFlow } from './useOAuthFlow';
import { PasswordLoginSheet } from './PasswordLoginSheet';

const CODE_LENGTH = 6;

type Step = 'email' | 'code';

export function SignInCard() {
  const { signInWith, sendEmailCode, verifyEmailCode, busy } = useOAuthFlow();
  const track = useTrack();

  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [step, setStep] = useState<Step>('email');
  // Delayed-reset timer handle. Stored in a ref so closeEmailSheet →
  // openEmailSheet within the 200ms window can cancel the stale timer
  // before it wipes the user's fresh input.
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (method: 'apple' | 'google') => {
    setError(null);
    track(AnalyticsEvents.SIGN_IN_ATTEMPTED, { method });
    try {
      const result = await signInWith(method);
      if (result.status === 'complete') {
        track(AnalyticsEvents.SIGN_IN_SUCCEEDED, { method });
        router.replace('/');
      } else {
        track(AnalyticsEvents.SIGN_IN_CANCELLED, { method });
      }
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method });
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again?');
    }
  };

  const resetSheet = () => {
    setStep('email');
    setEmail('');
    setCode('');
    setSentTo(null);
    setError(null);
  };

  const handleSendCode = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    track(AnalyticsEvents.SIGN_IN_ATTEMPTED, { method: 'email' });
    try {
      await sendEmailCode(trimmed);
      setSentTo(trimmed);
      setStep('code');
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email' });
      setError(e instanceof Error ? e.message : 'Could not send the code. Try again?');
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (code.trim().length < CODE_LENGTH) {
      setError(SIGN_IN.emailCodeInvalid);
      return;
    }
    try {
      const result = await verifyEmailCode(code);
      if (result.status === 'complete') {
        track(AnalyticsEvents.SIGN_IN_SUCCEEDED, { method: 'email' });
        setEmailSheetOpen(false);
        resetSheet();
        router.replace('/');
      } else if (result.status === 'invalid_code') {
        // The hook detected Clerk's `form_code_incorrect`; surface the
        // typed message without message-string sniffing.
        track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email' });
        setError(SIGN_IN.emailCodeInvalid);
      } else {
        // 'incomplete' — Clerk returned a non-complete status (e.g. second
        // factor needed). We don't support 2FA yet; surface a generic
        // ask-to-retry.
        setError('Additional verification is required. Please contact support.');
      }
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email' });
      setError(e instanceof Error ? e.message : 'Could not verify the code. Try again?');
    }
  };

  const openEmailSheet = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    resetSheet();
    setEmailSheetOpen(true);
  };

  const closeEmailSheet = () => {
    setEmailSheetOpen(false);
    // Delay reset so the sheet animates out first — otherwise the user
    // sees the email step flash back as the modal closes. Clear any
    // prior pending reset so successive close calls don't stack.
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetSheet();
      resetTimerRef.current = null;
    }, 200);
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
          onPress={openEmailSheet}
        />
        <Button
          label={SIGN_IN.logInCta}
          variant="ghost"
          size="lg"
          disabled={busy !== null}
          onPress={() => setPasswordSheetOpen(true)}
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
        onRequestClose={closeEmailSheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-cream-50"
        >
          <View className="flex-row justify-end p-4">
            <Pressable
              onPress={closeEmailSheet}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="p-2"
            >
              <X color="#6D28D9" size={24} />
            </Pressable>
          </View>
          <View className="flex-1 px-5">
            {step === 'email' ? (
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
                  onPress={handleSendCode}
                />
              </>
            ) : (
              <>
                <Text variant="heading" className="text-3xl text-plum-900 mb-2">
                  {SIGN_IN.emailSentTitle}
                </Text>
                <Text variant="body" className="text-plum-900 leading-6 mb-6">
                  {SIGN_IN.emailSentBody.replace('{email}', sentTo ?? '')}
                </Text>
                <Input
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  placeholder={SIGN_IN.emailCodePlaceholder}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  autoFocus
                  maxLength={CODE_LENGTH}
                />
                {error ? (
                  <Text variant="caption" className="mt-2 text-rose-700">
                    {error}
                  </Text>
                ) : null}
                <Button
                  className="mt-6"
                  label={SIGN_IN.emailVerifyCta}
                  size="lg"
                  loading={busy === 'email'}
                  disabled={busy !== null || code.length < CODE_LENGTH}
                  onPress={handleVerifyCode}
                />
                <Button
                  className="mt-2"
                  label="Use a different email"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PasswordLoginSheet
        visible={passwordSheetOpen}
        onClose={() => setPasswordSheetOpen(false)}
      />
    </View>
  );
}
