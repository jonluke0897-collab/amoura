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

export type PasswordLoginSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Fast sign-in sheet for returning users with a password set. Separate from
 * the email-code sheet so the decision ("I have a password" vs "send me a
 * code") is made on the welcome screen — one tap, no intermediate choice
 * dialog. Accounts without a password set still use the code flow.
 */
export function PasswordLoginSheet({ visible, onClose }: PasswordLoginSheetProps) {
  const { signInWithPassword, busy } = useOAuthFlow();
  const track = useTrack();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Delayed-reset timer handle. Stored in a ref so a close → reopen
  // within the 200ms window can cancel the stale timer before it wipes
  // the user's new input.
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setError(null);
  };

  // Cancel any pending reset when the sheet reopens — otherwise a
  // close→open within 200ms would let the stale timer wipe the user's
  // new input. Kept separate from the unmount cleanup below because a
  // combined effect with [visible] deps would ALSO fire its cleanup on
  // close (visible true→false), cancelling the timer `handleClose` just
  // scheduled and preventing the delayed reset from ever running.
  useEffect(() => {
    if (visible && resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, [visible]);

  // Unmount-only cleanup: empty deps so this cleanup runs exactly once,
  // when the PasswordLoginSheet actually unmounts.
  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const handleClose = () => {
    // Mirrors the SignInCard guard: while signInWithPassword is awaiting
    // Clerk, a tap on X or the backdrop would let the request resolve and
    // still call router.replace('/'), silently signing the user in after
    // they tried to cancel. No-op when busy so the sheet can only be
    // dismissed from a settled state.
    if (busy === 'email') return;
    onClose();
    // Delay reset so the sheet animates out before the fields clear —
    // avoids the flash of empty inputs mid-dismiss.
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      reset();
      resetTimerRef.current = null;
    }, 200);
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    track(AnalyticsEvents.SIGN_IN_ATTEMPTED, { method: 'email_password' });
    try {
      const result = await signInWithPassword(trimmed, password);
      if (result.status === 'complete') {
        track(AnalyticsEvents.SIGN_IN_SUCCEEDED, { method: 'email_password' });
        handleClose();
        router.replace('/');
      } else if (result.status === 'invalid_credentials') {
        // Hook already collapsed wrong-identifier / wrong-password into
        // this single status — the generic copy is by design so we don't
        // leak "user exists but password is wrong".
        track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email_password' });
        setError(SIGN_IN.logInFailed);
      } else {
        // 'incomplete' — Clerk needs more factors (future MFA). Surface
        // a generic retry message; we don't handle 2FA yet. Tracked as
        // a failure with a distinct reason so the analytics funnel can
        // separate "bad credentials" from "MFA wall".
        track(AnalyticsEvents.SIGN_IN_FAILED, {
          method: 'email_password',
          reason: 'mfa_required',
        });
        setError('Additional verification is required. Please contact support.');
      }
    } catch (e) {
      track(AnalyticsEvents.SIGN_IN_FAILED, { method: 'email_password' });
      setError(e instanceof Error ? e.message : 'Log in failed.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-cream-50"
      >
        <View className="flex-row justify-end p-4">
          <Pressable
            onPress={handleClose}
            disabled={busy === 'email'}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityState={{ disabled: busy === 'email' }}
            className="p-2"
          >
            <X color={busy === 'email' ? '#A78BFA' : '#6D28D9'} size={24} />
          </Pressable>
        </View>
        <View className="flex-1 px-5">
          <Text variant="heading" className="text-3xl text-plum-900 mb-2">
            {SIGN_IN.logInSheetTitle}
          </Text>
          <Text variant="caption" className="mb-6">
            {SIGN_IN.logInSheetHelp}
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
          <View className="h-3" />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder={SIGN_IN.passwordInputPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
          />
          {error ? (
            <Text variant="caption" className="mt-2 text-rose-700">
              {error}
            </Text>
          ) : null}
          <Button
            className="mt-6"
            label={SIGN_IN.logInSubmitCta}
            size="lg"
            loading={busy === 'email'}
            disabled={
              busy !== null || email.trim().length === 0 || password.length === 0
            }
            onPress={handleSubmit}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
