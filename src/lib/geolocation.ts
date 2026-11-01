// Keep a recent successful fix in memory only; never persist coordinates.
const recentPositions = new WeakMap<Geolocation, { position: GeolocationPosition; receivedAt: number }>();
const CACHE_AGE = 10000;
export const LOCATION_TIMEOUT = 8000;

export function requestLocation(
  geolocation: Geolocation,
  onSuccess: PositionCallback,
  onError: PositionErrorCallback,
) {
  let watch: number | undefined;
  let cancelled = false;
  const clear = () => {
    if (watch !== undefined) geolocation.clearWatch(watch);
    watch = undefined;
  };
  const cancel = () => { cancelled = true; clear(); };
  const cached = recentPositions.get(geolocation);
  if (cached && Date.now() - cached.receivedAt < CACHE_AGE) {
    queueMicrotask(() => { if (!cancelled) onSuccess(cached.position); });
    return cancel;
  }
  watch = geolocation.watchPosition(
    position => {
      if (cancelled) return;
      cancel();
      recentPositions.set(geolocation, { position, receivedAt: Date.now() });
      onSuccess(position);
    },
    error => {
      if (cancelled) return;
      cancel();
      onError(error);
    },
    // Ask for the quickest available fix, rather than waiting for a precise GPS fix.
    // The native timeout excludes time spent answering the permission prompt.
    { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT, maximumAge: CACHE_AGE },
  );
  return cancel;
}
