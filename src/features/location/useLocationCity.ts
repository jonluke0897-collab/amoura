import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';

export type LocationCityStatus =
  | 'idle'
  | 'requesting'
  | 'saving'
  | 'denied'
  | 'unavailable'
  | 'error';

/**
 * Hook that orchestrates the "detect my city via GPS" path for TASK-042.
 *
 * Flow:
 *   1. Request foreground location permission.
 *   2. Read current position at low accuracy (city name doesn't need precision).
 *   3. Reverse-geocode to extract a city name.
 *   4. Save via `profiles.updatePreferences` — stored as a string, never as
 *      raw coordinates.
 *
 * The hook never writes lat/lng to Convex; that's deliberate (roadmap
 * TASK-042). `unavailable` covers the geocode-returned-no-city case — rare on
 * mobile but possible in remote areas — so the UI can route to the manual
 * picker without treating it as an error.
 */
export function useLocationCity() {
  const updatePreferences = useMutation(api.profiles.updatePreferences);
  const [status, setStatus] = useState<LocationCityStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const detectAndSave = useCallback(async (): Promise<string | null> => {
    setError(null);
    setStatus('requesting');
    try {
      const { status: permStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        setStatus('denied');
        return null;
      }

      // Low accuracy is enough for city resolution and faster to return — we
      // don't need street-level precision for reverse geocode.
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const results = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const city = extractCity(results);
      if (!city) {
        setStatus('unavailable');
        return null;
      }

      setStatus('saving');
      await updatePreferences({ city });
      setStatus('idle');
      return city;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Location error');
      return null;
    }
  }, [updatePreferences]);

  const saveManualCity = useCallback(
    async (city: string) => {
      setError(null);
      setStatus('saving');
      try {
        await updatePreferences({ city });
        setStatus('idle');
        return true;
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Could not save city');
        return false;
      }
    },
    [updatePreferences],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, detectAndSave, saveManualCity, reset };
}

// `city` is the canonical field on Geocoded results but can be null for rural
// addresses; `subregion` is the usual fallback (borough / county). We
// deliberately don't surface region/country because the feed index is keyed
// on city only.
function extractCity(results: Location.LocationGeocodedAddress[]): string | null {
  for (const r of results) {
    const candidate = r.city ?? r.subregion ?? null;
    if (candidate && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}
