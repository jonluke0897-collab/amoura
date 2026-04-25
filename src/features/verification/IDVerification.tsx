import { useEffect, useRef, useState } from 'react';
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

  const [working, setWorking] = useState<
    'idle' | 'starting' | 'inFlight' | 'awaitingWebhook'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entry guards. The disabled prop on the Button is a
  // soft barrier — React state updates are async, so two taps in the
  // same animation frame can both pass the disabled check before
  // setWorking lands. The refs flip synchronously in the handler body
  // so the second invocation sees the guard immediately.
  const startInFlightRef = useRef(false);
  const dismissInFlightRef = useRef(false);
  // Client-side timestamp captured immediately before opening the
  // Persona browser session. The watcher detects "a new resolution
  // row landed" by checking status.idLatestAt > attemptStartedAtRef.
  //
  // Why a client Date.now() baseline instead of snapshotting
  // status.idLatestAt: a slow status load (or a user who taps Verify
  // before status resolves) would leave us snapshotting null, and
  // any subsequent status load that returns a prior verifications
  // row (idLatestAt: number) would falsely satisfy `!== null` and
  // exit awaitingWebhook against a stale row. A timestamp baseline
  // tolerates the loading race because every server-stamped
  // createdAt for a fresh row is strictly greater than this snapshot.
  // Clock skew between client and server is usually <1s, well within
  // the resolution we need.
  const attemptStartedAtRef = useRef<number>(0);

  useEffect(() => {
    // `track` is a memoized callback that becomes a no-op when PostHog
    // hasn't initialized yet. Including it in deps means the prompt-
    // shown event re-fires when posthog stabilizes — covers the cold-
    // start race where the screen mounts before the analytics provider
    // is ready. useCallback's stable identity prevents endless retriggers.
    track(AnalyticsEvents.VERIFICATION_PROMPT_SHOWN, { type: 'id' });
  }, [track]);

  // Watcher: while awaitingWebhook, flip back to idle once a new
  // verifications row has landed (idLatestAt is later than our
  // attempt-started snapshot). The screen's existing isApproved
  // branch then renders the success panel; rejected lands the user
  // back on the prompt for a retry. Comparing by createdAt rather
  // than status enum is what makes this work for consecutive
  // rejections (both reads are 'rejected', but the timestamp moves
  // forward on each new row).
  useEffect(() => {
    if (working !== 'awaitingWebhook') return;
    if (!status) return;
    if (
      status.idLatestAt !== null &&
      status.idLatestAt > attemptStartedAtRef.current
    ) {
      setWorking('idle');
    }
  }, [working, status]);

  // Timeout fallback: if the Persona webhook never arrives (network
  // partition, Persona outage, mis-configured webhook URL), don't
  // strand the user on "Waiting for result…" indefinitely. After 60s
  // we flip back to idle with a retry-prompt error. Persona's typical
  // resolve time is sub-30s; 60s is generous enough that legitimate
  // slow paths complete first.
  useEffect(() => {
    if (working !== 'awaitingWebhook') return;
    const timeout = setTimeout(() => {
      setWorking('idle');
      setError(
        'Verification is taking longer than expected. Please try again in a moment.',
      );
    }, 60_000);
    return () => clearTimeout(timeout);
  }, [working]);

  // The in-app browser doesn't tell us "approved vs rejected" directly —
  // the webhook is the source of truth. After the browser session
  // closes, we wait briefly for the webhook to fire and the status
  // query to update. If the user already had an approved row from a
  // prior attempt, we celebrate that instead of waiting.
  const isApproved = status?.id === 'approved';

  // While status is still loading (undefined), assume the worst case
  // — required mode — so a user in the locked-out state never briefly
  // sees a Cancel button during the load window. Once status resolves
  // we trust idVerifyRequiredAt.
  const dismissable = status !== undefined && !status.idVerifyRequiredAt;

  async function handleStart(): Promise<void> {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setWorking('starting');
    setError(null);
    try {
      const { url } = await startId();
      track(AnalyticsEvents.VERIFICATION_STARTED, { type: 'id' });
      // Snapshot the attempt-started timestamp BEFORE opening the
      // browser. Persona can finalize the inquiry and fire the
      // webhook while the browser session is still open — by the
      // time openAuthSessionAsync resolves, status.idLatestAt may
      // already reflect the new row. Capturing the timestamp before
      // launch ensures the watcher's `idLatestAt > attemptStartedAt`
      // comparison correctly detects any row created after this
      // moment, including ones that landed mid-session.
      attemptStartedAtRef.current = Date.now();
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
      // actually updates state. Stay in 'awaitingWebhook' until the
      // status query reflects a new row — otherwise the user could
      // re-tap the CTA between browser-close and webhook-land and
      // spawn a duplicate Persona inquiry.
      setWorking('awaitingWebhook');
    } catch (e) {
      console.warn('[IDVerification] startId failed', e);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not start verification. Try again in a moment.',
      );
      setWorking('idle');
    } finally {
      startInFlightRef.current = false;
    }
  }

  async function handleNotNow(): Promise<void> {
    if (dismissInFlightRef.current) return;
    dismissInFlightRef.current = true;
    track(AnalyticsEvents.VERIFICATION_DISMISSED, { type: 'id' });
    try {
      await recordDismiss();
    } catch {
      // Recording the dismiss is best-effort. If it fails, the user
      // gets back to the app and the next sign-in will surface the
      // prompt again — no harm.
    } finally {
      dismissInFlightRef.current = false;
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
            // Chevron back goes through handleNotNow so the dismissal
            // counts toward the gate. router.back() alone would let
            // users tap-tap-tap the chevron forever without ever hitting
            // the lockout, which defeats the dismissable-twice rule.
            // Disabled while non-idle for consistency with "Not now" —
            // dismissing mid-startId would race against the inquiry
            // creation and leave the user in a confusing state.
            onPress={handleNotNow}
            disabled={working !== 'idle'}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityState={{ disabled: working !== 'idle' }}
            hitSlop={12}
            className={`h-10 w-10 items-center justify-center -ml-2 ${working !== 'idle' ? 'opacity-50' : ''}`}
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
                : working === 'awaitingWebhook'
                  ? 'Waiting for result…'
                  : 'Verify my ID'
          }
          onPress={handleStart}
          loading={working === 'starting' || working === 'awaitingWebhook'}
          // Block while any non-idle state is in flight. The Button's
          // disabled prop is a soft barrier (synchronous re-entry guard
          // on startInFlightRef is the hard one); both belt and braces
          // matter because React state updates are async.
          disabled={working !== 'idle'}
        />
        {dismissable && (
          <View className="mt-3">
            <Button
              label="Not now"
              variant="ghost"
              onPress={handleNotNow}
              disabled={working !== 'idle'}
            />
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
