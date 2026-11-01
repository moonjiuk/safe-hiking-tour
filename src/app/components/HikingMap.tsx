"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Kakao SDK has no bundled TypeScript definitions. */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { MapBounds, Tour } from "@/lib/map-types";
import type { HikingPlace } from "@/lib/places";
import { requestLocation } from "@/lib/geolocation";
declare global {
  interface Window {
    kakao: any;
  }
}
let sdk: Promise<void> | undefined;
function loadSdk(key: string) {
  if (!sdk)
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(
        () => reject(new Error("지도 연결 시간이 초과되었습니다.")),
        12000,
      );
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=clusterer`;
      script.onload = () => {
        clearTimeout(timeout);
        if (!window.kakao?.maps)
          return reject(new Error("지도 서비스 권한을 확인해 주세요."));
        window.kakao.maps.load(resolve);
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("지도 연결에 실패했습니다."));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      sdk = undefined;
      throw error;
    });
  return sdk;
}
function HikingMap({
  places,
  focusPlace,
  onSelect,
  onBounds, tours, activeTour, onTourSelect,
}: {
  places: HikingPlace[];
  focusPlace: HikingPlace | null;
  onSelect: (p: HikingPlace) => void;
  onBounds: (b: MapBounds) => void;
  tours: Tour[];
  activeTour: Tour | null;
  onTourSelect: (t: Tour) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const locationMarker = useRef<any>(null);
  const locationRequest = useRef(0);
  const cancelLocation = useRef<(() => void) | undefined>(undefined);
  const flight = useRef<number | null>(null);
  const stopFlight = useCallback(() => {
    if (flight.current !== null) cancelAnimationFrame(flight.current);
    flight.current = null;
  }, []);
  const moveTo = useCallback((lat: number, lng: number, targetLevel?: number) => {
    stopFlight();
    const activeMap = map.current;
    if (!activeMap) return;
    const k = window.kakao.maps;
    const target = new k.LatLng(lat, lng);
    const start = activeMap.getCenter();
    const startLevel = activeMap.getLevel();
    const endLevel = targetLevel ?? startLevel;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      activeMap.setLevel(endLevel);
      activeMap.setCenter(target);
      return;
    }
    const bounds = activeMap.getBounds();
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const distance = Math.max(Math.abs(lat - start.getLat()) / Math.max(ne.getLat() - sw.getLat(), .001), Math.abs(lng - start.getLng()) / Math.max(ne.getLng() - sw.getLng(), .001));
    // Zoom out for long trips so intermediate frames do not load many detailed tiles.
    const travelLevel = Math.min(13, Math.max(startLevel, endLevel, startLevel + Math.max(0, Math.ceil(Math.log2(Math.max(1, distance))))));
    const started = performance.now();
    const duration = distance > 1 ? 1000 : 600;
    let lastFrame = -Infinity;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const frame = (now: number) => {
      if (map.current !== activeMap) return stopFlight();
      const progress = Math.min(1, (now - started) / duration);
      if (progress === 1) {
        flight.current = null;
        activeMap.setLevel(endLevel);
        activeMap.setCenter(target);
        return;
      }
      if (now - lastFrame >= 32) {
        lastFrame = now;
        const positionProgress = ease(progress);
        const level = progress < .35 ? startLevel + (travelLevel - startLevel) * ease(progress / .35) : progress > .65 ? travelLevel + (endLevel - travelLevel) * ease((progress - .65) / .35) : travelLevel;
        const nextLevel = Math.round(level);
        if (activeMap.getLevel() !== nextLevel) activeMap.setLevel(nextLevel);
        activeMap.setCenter(new k.LatLng(start.getLat() + (lat - start.getLat()) * positionProgress, start.getLng() + (lng - start.getLng()) * positionProgress));
      }
      flight.current = requestAnimationFrame(frame);
    };
    flight.current = requestAnimationFrame(frame);
  }, [stopFlight]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationDiagnostic, setLocationDiagnostic] = useState("");
  const [locationPermission, setLocationPermission] = useState("unknown");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const locateMe = useCallback(() => {
    const activeMap = map.current;
    if (!activeMap) return;
    cancelLocation.current?.();
    const requestId = ++locationRequest.current;
    setLocationError("");
    setLocationDiagnostic("");
    navigator.permissions?.query?.({name: "geolocation"}).then(permission => {
      if (requestId === locationRequest.current) setLocationPermission(permission.state);
    }).catch(() => {});
    if (!navigator.geolocation) {
      setLocationError("이 브라우저는 위치 확인을 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    const success = ({coords}: GeolocationPosition) => {
        if (requestId !== locationRequest.current || map.current !== activeMap)
          return;
        const k = window.kakao.maps;
        const position = new k.LatLng(coords.latitude, coords.longitude);
        locationMarker.current?.setMap(null);
        const content = document.createElement("div");
        content.className = "my-location-marker";
        content.setAttribute("role", "img");
        content.setAttribute("aria-label", "내 위치");
        locationMarker.current = new k.CustomOverlay({
          map: activeMap,
          position,
          content,
          yAnchor: 0.5,
          zIndex: 10,
        });
        moveTo(coords.latitude, coords.longitude, 5);
        setLocating(false);
        setLocationDiagnostic("success");
        setLocationPermission("granted");
      };
    const fail = (error: GeolocationPositionError) => {
        if (requestId !== locationRequest.current || map.current !== activeMap)
          return;
        setLocating(false);
        setLocationDiagnostic(`${error.code}: ${error.message}`);
        if (error.code === 1) setLocationPermission("denied");
        setLocationError(
          error.code === 1
            ? "위치 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 위치 접근을 허용해 주세요."
            : error.code === 3
              ? "위치 확인 시간이 초과되었습니다. 다시 눌러 주세요."
              : "현재 위치를 확인할 수 없습니다. 기기의 위치 서비스를 확인해 주세요.",
        );
      };
    cancelLocation.current = requestLocation(navigator.geolocation, success, fail);
  }, [moveTo]);
  useEffect(() => stopFlight, [stopFlight]);
  useEffect(() => () => {
    locationRequest.current++;
    cancelLocation.current?.();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
    setError("");
    if (!key) {
      setError(
        "지도 API 연결이 필요합니다. 장소 검색과 저장된 산행 정보는 계속 이용하실 수 있습니다.",
      );
      return;
    }
    loadSdk(key)
      .then(() => {
        if (cancelled || !container.current) return;
        map.current = new window.kakao.maps.Map(container.current, {
          center: new window.kakao.maps.LatLng(36.886124, 128.105896),
          level: 6,
        });
        map.current.addControl(new window.kakao.maps.ZoomControl(), window.kakao.maps.ControlPosition.RIGHT);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
      locationMarker.current?.setMap(null);
      locationMarker.current = null;
      map.current = null;
      setReady(false);
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !container.current) return;
    const activeMap = map.current;
    const observer = new ResizeObserver(() => {
      const center = activeMap.getCenter();
      activeMap.relayout();
      activeMap.setCenter(center);
    });
    const element = container.current;
    const interrupt = () => {
      if (flight.current === null) return;
      stopFlight();
      activeMap.setCenter(activeMap.getCenter());
    };
    element.addEventListener('pointerdown', interrupt, true);
    element.addEventListener('wheel', interrupt, {passive: true});
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      element.removeEventListener('pointerdown', interrupt, true);
      element.removeEventListener('wheel', interrupt);
    };
  }, [ready, stopFlight]);
  useEffect(() => {
    if (ready) locateMe();
  }, [ready, locateMe]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const k = window.kakao.maps;
    const activeMap = map.current;
    const cluster = new k.MarkerClusterer({
      map: activeMap,
      averageCenter: true,
      minLevel: 6,
      gridSize: 70,
    });
    const images = Object.fromEntries(["peak", "shelter", "danger"].map(category => [
      category, new k.MarkerImage(`/Image/${category === "danger" ? "dangerous" : category}_marker.png`, new k.Size(28, 28), {offset: new k.Point(14, 14)}),
    ]));
    const cache = new Map<string, {marker: any; click: () => void}>();
    let visible = new Set<string>();
    // Only create markers near the viewport. Keep a margin to avoid popping
    // during drags, and update membership once movement has finished.
    const updateVisible = () => {
      if (flight.current !== null) return;
      const bounds = activeMap.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onBounds({south: sw.getLat(), north: ne.getLat(), west: sw.getLng(), east: ne.getLng()});
      const latMargin = (ne.getLat() - sw.getLat()) * 0.25;
      const lngMargin = (ne.getLng() - sw.getLng()) * 0.25;
      const next = new Set<string>();
      const added: any[] = [];
      for (const p of places) {
        if (p.lat < sw.getLat() - latMargin || p.lat > ne.getLat() + latMargin ||
          p.lng < sw.getLng() - lngMargin || p.lng > ne.getLng() + lngMargin) continue;
        next.add(p.id);
        if (visible.has(p.id)) continue;
        let entry = cache.get(p.id);
        if (!entry) {
          const marker = new k.Marker({
            position: new k.LatLng(p.lat, p.lng),
            title: `${p.name} · 클릭하여 상세 보기`,
            image: images[p.category],
          });
          const click = () => onSelect(p);
          k.event.addListener(marker, "click", click);
          entry = {marker, click};
          cache.set(p.id, entry);
        }
        added.push(entry.marker);
      }
      const removed = [...visible].filter(id => !next.has(id)).map(id => cache.get(id)!.marker);
      if (removed.length) cluster.removeMarkers(removed, true);
      if (added.length) cluster.addMarkers(added, true);
      if (removed.length || added.length) cluster.redraw();
      visible = next;
    };
    updateVisible();
    k.event.addListener(activeMap, "idle", updateVisible);
    return () => {
      k.event.removeListener(activeMap, "idle", updateVisible);
      cluster.clear();
      cache.forEach(({marker, click}) => k.event.removeListener(marker, "click", click));
      cache.clear();
      cluster.setMap(null);
    };
  }, [ready, places, onSelect, onBounds]);
  useEffect(() => {
    if (!ready || !focusPlace || !map.current) return;
    moveTo(focusPlace.lat, focusPlace.lng, 5);
  }, [ready, focusPlace, moveTo]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const k = window.kakao.maps;
    const markers = tours.map(t => {
      const marker = new k.Marker({map: map.current, position: new k.LatLng(Number(t.mapy), Number(t.mapx)), title: t.title, zIndex: 5});
      const click = () => onTourSelect(t);
      k.event.addListener(marker, 'click', click);
      return {marker, click};
    });
    return () => markers.forEach(({marker, click}) => {
      k.event.removeListener(marker, 'click', click);
      marker.setMap(null);
    });
  }, [ready, tours, onTourSelect]);
  useEffect(() => {
    if (ready && activeTour && map.current) {
      const k = window.kakao.maps;
      const position = new k.LatLng(Number(activeTour.mapy), Number(activeTour.mapx));
      moveTo(Number(activeTour.mapy), Number(activeTour.mapx));
      const content = document.createElement('div');
      content.className = 'tour-map-label';
      content.textContent = activeTour.title;
      const overlay = new k.CustomOverlay({map: map.current, position, content, yAnchor: 2, zIndex: 7});
      return () => overlay.setMap(null);
    }
  }, [ready, activeTour, moveTo]);
  return (
    <>
      <div className="map-canvas" ref={container} />
      <div className="location-controls">
        <button
          className="locate-button"
          onClick={locateMe}
          disabled={!ready}
          aria-label="내 위치로 이동"
          data-location-result={locationDiagnostic}
          data-location-permission={locationPermission}
          title={locating ? "현재 위치 확인 중" : locationError || "내 위치로 이동"}
          aria-busy={locating}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </button>

      </div>
      {error && (
        <div className="map-empty">
          <div className="mountain-symbol" aria-hidden="true">
            △
          </div>
          <small>READY FOR YOUR NEXT TRAIL</small>
          <h2>다음 산행을 준비하는 시간</h2>
          <p role="status">{error}</p>
          <button onClick={() => setAttempt((v) => v + 1)}>
            지도 다시 연결 ↗
          </button>
        </div>
      )}
    </>
  );
}
export default memo(HikingMap);
