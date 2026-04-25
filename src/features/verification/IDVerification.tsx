import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Button } from '~/src/components/ui/Button';
import { Text } from '~/src/components/ui/Text';
import { AnalyticsEvents, useTrack } from '~/src/lib/analytics';

/**
 * ID verification entry. Opens Persona's hosted inquiry flow in an
 * in-app browser session via `expo-web-browser`. Persona handles the
 * ID-document + selfie capture entirely; the result lands via the
 * `/persona-webhook` HTTP route, which writes the verifications row.
 *
 * Why hosted (not the embedded SDK): the Persona React Native SDK
 * adds a native dep that requires its own EAS rebuild and version
 * management; the hosted flow uses `expo-web-browser` (already
 * installed) and never falls out of sync with Persona's API. UX is
 * comparable — the browser session looks "in-app" enough on iOS
 * (SFAuthenticationSession) and Android (Custom Tabs) that users
 * don't perceive an external context switch.
 *
 * Dismissal model (TASK-060): the prompt is dismissible the first
 * two times. On the third open, `users.idVerifyRequiredAt` is set
 * server-side and the Cancel button is hidden. The status query
 * exposes both pieces of state.
 */
export function IDVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const track = useTrack();
  const status = useQuery(api.verifications.status);
  const startId = useAction(api.verificationActions.startId);
  const recordDismiss = useMutation(api.verifications.recordIdDismiss);

  const [working, setWorking] = useState<'idle' | 'starting' | 'inFlight'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track(AnalyticsEvents.VERIFICATION_PROMPT_SHOWN, { type: 'id' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The in-app browser doesn't tell us "approved vs rejected" directly —
  // the webhook is the source of truth. After the browser session
  // closes, we wait briefly for the webhook to fire and the status
  // query to update. If the user already had an approved row from a
  // prior attempt, we celebrate that instead of waiting.
  const isApproved = status?.id === 'approved';

  const dismissable =
    !status?.idVerifyRequiredAt;

  async function handleStart(): Promise<void> {
    setWorking('starting');
    setError(null);
    try {
      const { url } = await startId();
      track(AnalyticsEvents.VERIFICATION_STARTED, { type: 'id' });
      setWorking('inFlight');
      // openAuthSessionAsync gives us iOS SFAuthenticationSession +
      // Android Custom Tabs treatment, with the deep-link redirect
      // closing the session on completion. Result.type === 'success'
      // means the redirect fired; 'cancel' means the user backed out.
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        // The redirect URL Persona sends the browser back to. Set
        // PERSONA_REDIRECT_URL on the server to match this scheme.
        'amoura://verify-id-return',
      );
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed the browser before completing. Don't increment
        // the dismiss counter here — the user opened the flow once,
        // which counts as engagement; only dismissing the wrapper
        // screen counts toward the gate.
        setWorking('idle');
        return;
      }
      // 'success' just means the redirect fired. The webhook is what
      // actually updates state. The status query subscription will
      // re-render when the row lands.
      setWorking('idle');
    } catch (e) {
      console.warn('[IDVerification] startId failed', e);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not start verification. Try again in a moment.',
      );
      setWorking('idle');
    }
  }

  async function handleNotNow(): Promise<void> {
    track(AnalyticsEvents.VERIFICATION_DISMISSED, { type: 'id' });
    try {
      await recordDismiss();
    } catch {
      // Recording the dismiss is best-effort. If it fails, the user
      // gets back to the app and the next sign-in will surface the
      // prompt again — no harm.
    }
    router.back();
  }

  if (isApproved) {
    return (
      <ResultPanel
        heading="ID verified."
        body="Your account is now ID-verified. The plum check applies."
        ctaLabel="Done"
        onCta={() => router.back()}
      />
    );
  }

  return (
    <View
      className="flex-1 bg-cream-50 px-6"
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: Math.max(insets.bottom, 24),
      }}
    >
      <View className="flex-row items-center mb-2">
        {dismissable && (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            className="h-10 w-10 items-center justify-center -ml-2"
          >
            <ChevronLeft color="#6D28D9" size={22} />
          </Pressable>
        )}
      </View>

      <View className="flex-1 items-center justify-center">
        <View className="h-20 w-20 rounded-full bg-plum-50 items-center justify-center mb-5">
          <ShieldCheck color="#6D28D9" size={40} />
        </View>
        <Text variant="heading" className="text-2xl text-plum-900 mb-3 text-center">
          Verify your ID.
        </Text>
        <Text variant="body" className="text-base text-plum-700 mb-2 text-center">
          A quick photo of your government ID and a selfie. Helps keep this
          place real for everyone.
        </Text>
        <Text variant="caption" className="text-xs text-plum-400 mb-6 text-center">
          Your ID is checked by our verification partner and never shown to
          anyone else on Amoura.
        </Text>
        {!dismissable && (
          <View className="rounded-md bg-plum-50 border border-plum-100 p-3 mb-6">
            <Text variant="body" className="text-sm text-plum-900 text-center">
              You’ve postponed this twice. To keep using Amoura, please verify
              before continuing.
            </Text>
          </View>
        )}
        {error && (
          <Text variant="body" className="text-sm text-rose-700 mb-4 text-center">
            {error}
          </Text>
        )}
      </View>

      <View>
        <Button
          label={
            working === 'starting'
              ? 'Opening…'
              : working === 'inFlight'
                ? 'Continue verification'
                : 'Verify my ID'
          }
          onPress={handleStart}
          loading={working === 'starting'}
          disabled={working === 'starting'}
        />
        {dismissable && (
          <View className="mt-3">
            <Button label="Not now" variant="ghost" onPress={handleNotNow} />
          </View>
        )}
      </View>
    </View>
  );
}

function ResultPanel({
  heading,
  body,
  ctaLabel,
  onCta,
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-cream-50 px-6 items-center justify-center"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <View className="h-20 w-20 rounded-full bg-plum-600 items-center justify-center mb-5">
        <ShieldCheck color="#FAFAFF" size={40} />
      </View>
      <Text variant="heading" className="text-2xl text-plum-900 mb-3 text-center">
        {heading}
      </Text>
      <Text variant="body" className="text-base text-plum-700 mb-6 text-center">
        {body}
      </Text>
      <View className="w-full max-w-sm">
        <Button label={ctaLabel} onPress={onCta} />
      </View>
    </View>
  );
}
