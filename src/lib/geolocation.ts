// Native acquisition timeouts exclude time spent answering the permission prompt.
// A watch can also be cancelled when the user retries or leaves the map.
export function requestLocation(
  geolocation: Geolocation,
  onSuccess: PositionCallback,
  onError: PositionErrorCallback,
) {
  let watch: number | undefined;
  let cancelled = false;
  let retried = false;
  const clear = () => {
    if (watch !== undefined) geolocation.clearWatch(watch);
    watch = undefined;
  };
  const start = (highAccuracy: boolean) => {
    watch = geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        cancelled = true;
        clear();
        onSuccess(position);
      },
      (error) => {
        if (cancelled) return;
        clear();
        if (error.code !== 1 && !retried) {
          retried = true;
          start(false);
          return;
        }
        cancelled = true;
        onError(error);
      },
      { enableHighAccuracy: highAccuracy, timeout: 20000, maximumAge: 60000 },
    );
  };
  start(true);
  return () => {
    cancelled = true;
    clear();
  };
}
