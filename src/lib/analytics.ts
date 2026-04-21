import { usePostHog } from 'posthog-react-native';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type EventProperties = Record<string, JsonValue>;

export function useTrack() {
  const posthog = usePostHog();
  return (event: string, properties?: EventProperties) => {
    posthog?.capture(event, properties);
  };
}
