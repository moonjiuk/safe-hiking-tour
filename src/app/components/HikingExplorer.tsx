"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  places,
  labels,
  type Category,
  type HikingPlace,
} from "@/lib/places";
import HikingMap from "./HikingMap";
import ChatBot from "./ChatBot";
import type {MapBounds, Tour} from "@/lib/map-types";
const emptyTours: Tour[] = [];
export default function HikingExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [selected, setSelected] = useState<HikingPlace | null>(null);
  const [focusPlace, setFocusPlace] = useState<HikingPlace | null>(null);
  const [activeTab, setActiveTab] = useState<"places" | "chat">("places");
  const [details, setDetails] = useState<Record<string, {tours: Tour[]; status: string}>>({});
  const tours = selected?.category === "peak" ? details[selected.id]?.tours || emptyTours : emptyTours;
  const listRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<{element: HTMLElement; top: number} | null>(null);
  useLayoutEffect(() => {
    const saved = anchor.current;
    const list = listRef.current;
    if (!saved || !list) return;
    const scroller = window.matchMedia("(max-width: 600px)").matches ? list.closest<HTMLElement>(".sidebar") || list : list;
    const preserve = () => {if (saved.element.isConnected) scroller.scrollTop += saved.element.getBoundingClientRect().top - saved.top;};
    preserve();
    const observer = new ResizeObserver(preserve);
    list.querySelectorAll('.place-entry').forEach(element => observer.observe(element));
    const timeout = setTimeout(() => {observer.disconnect(); anchor.current = null;}, 360);
    return () => {observer.disconnect(); clearTimeout(timeout);};
  }, [selected]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const selectMapPlace = useCallback((place: HikingPlace) => {
    setSelected(place.category === "peak" ? place : null);
    setPanelOpen(true);
    setActiveTab("places");
  }, []);
  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          `${p.name} ${p.trail || ""}`.includes(query.trim()),
      ),
    [query, category],
  );
  const visiblePlaces = useMemo(() => query.trim() ? filtered : bounds ? filtered.filter(p =>
    p.lat >= bounds.south && p.lat <= bounds.north && p.lng >= bounds.west && p.lng <= bounds.east
  ) : [], [filtered, bounds, query]);
  useEffect(() => {
    setActiveTour(null);
    if (!selected || selected.category !== "peak") return;
    const controller = new AbortController();
    setDetails(previous => ({...previous, [selected.id]: {tours: previous[selected.id]?.tours || [], status: "주변 여행지를 찾고 있습니다."}}));
    fetch(`/api/tourism?lat=${selected.lat}&lng=${selected.lng}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        const tours = data.items.filter((t: Tour) => Number.isFinite(Number(t.mapy)) && Number.isFinite(Number(t.mapx)) && Number(t.mapy) > 0 && Number(t.mapx) > 0);
        setDetails(previous => ({...previous, [selected.id]: {tours, status: tours.length ? "" : "주변 5km 내 관광정보가 없습니다."}}));
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setDetails(previous => ({...previous, [selected.id]: {tours: [], status: error.message || "관광정보를 불러오지 못했습니다."}}));
      });
    return () => controller.abort();
  }, [selected]);
  return (
    <div className="explorer">
      <main className={`workspace ${panelOpen ? "" : "panel-collapsed"}`}>
        <aside id="place-panel" className="sidebar" aria-label="산행 장소 탐색" aria-hidden={!panelOpen} inert={!panelOpen}>
          <Link href="/" className="brand sidebar-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-icon" src="/Image/logo.svg" width="32" height="32" alt="" />
            <span>안전산행투어<small>SAFE HIKING TOUR</small></span>
          </Link>
          <div className="sidebar-tabs" role="tablist" aria-label="산행 서비스" onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? "places" : event.key === "End" ? "chat" : activeTab === "places" ? "chat" : "places";
            setActiveTab(next);
            event.currentTarget.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
          }}>
            <button id="tab-places" role="tab" aria-selected={activeTab === "places"} aria-controls="places-view" tabIndex={activeTab === "places" ? 0 : -1} onClick={() => setActiveTab("places")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 19 9-14 9 14H3Zm5-8 4 3 4-3"/></svg>
              장소 탐색
            </button>
            <button id="tab-chat" role="tab" aria-selected={activeTab === "chat"} aria-controls="chat-view" tabIndex={activeTab === "chat" ? 0 : -1} onClick={() => setActiveTab("chat")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z"/><path d="m7 14 4-6 4 6H7"/></svg>
              산행 도우미
            </button>
          </div>
          <section id="places-view" className="sidebar-view" role="tabpanel" aria-labelledby="tab-places" hidden={activeTab !== "places"}>
          <div className="eyebrow">EXPLORE THE MOUNTAINS</div>
          <h1>어디로 떠나볼까요?</h1>
          <p className="muted">봉우리부터 대피소까지, 산행 전 살펴보세요.</p>
          <label className="search-label" htmlFor="place-search">
            산·장소 검색
          </label>
          <div className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              id="place-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="산이나 장소 이름을 입력하세요"
            />
          </div>
          <div className="filters" aria-label="장소 유형">
            {(["all", "peak", "shelter", "danger"] as const).map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "전체" : labels[c]}
              </button>

            ))}
          </div>
          <div className="result-heading">
            <strong>{query.trim() ? "전체 지역 검색 결과" : "현재 지도 안의 장소"}</strong>
            <span>{visiblePlaces.length.toLocaleString()}곳</span>
          </div>
          <div className="place-list" ref={listRef}>
            {!visiblePlaces.length && (
              <p className="empty">
                {query.trim() ? "검색 결과가 없습니다. 다른 이름이나 장소 유형으로 검색해 주세요." : "현재 지도에 표시할 장소가 없습니다. 지도를 이동하거나 검색 조건을 바꿔 주세요."}
              </p>
            )}
            {visiblePlaces.slice(0, 100).map((p) => (
              <article key={p.id} className="place-entry" data-category={p.category}>
              <button
                aria-expanded={p.category === "peak" ? selected?.id === p.id : undefined}
                aria-controls={p.category === "peak" ? `place-${p.id}` : undefined}
                className={`place-card ${selected?.id === p.id ? "selected" : ""}`}
                onClick={event => {
                  setFocusPlace({...p});
                  if (p.category !== "peak") {
                    setSelected(null);
                    return;
                  }
                  anchor.current = {element: event.currentTarget, top: event.currentTarget.getBoundingClientRect().top};
                  setSelected(selected?.id === p.id ? null : p);
                }}
              >
                <span className={`place-icon ${p.category}`}>
                  {/* Same SVG asset as the map and legend. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/Image/${p.category === "danger" ? "dangerous" : p.category}_marker.png`} width="24" height="24" alt="" />
                </span>
                <span>
                  <small>
                    {labels[p.category]}
                    {p.trail ? ` · ${p.trail}` : ""}
                  </small>
                  <strong>{p.name}</strong>
                  <span className="place-description">{p.description}</span>
                </span>
                {p.category === "peak" && <span className="arrow" aria-hidden="true">{selected?.id === p.id ? "−" : "+"}</span>}
              </button>
              {p.category === "peak" && <div className={`place-reveal ${selected?.id === p.id ? "is-open" : ""}`} aria-hidden={selected?.id !== p.id} inert={selected?.id !== p.id}>
                <div className="place-reveal-inner">
                <div className="place-expanded" id={`place-${p.id}`}>
                  <p>{p.description}</p>
                  <h3>주변 관광지 <small>5km 이내</small></h3>
                  <p className="muted" role="status">{details[p.id]?.status}</p>
                  <div className="tour-items">
                    {(details[p.id]?.tours || []).map(t => (
                      <div className={`tour-row ${activeTour?.contentid === t.contentid ? "active" : ""}`} key={t.contentid}>
                        <button onClick={() => setActiveTour(t)} aria-pressed={activeTour?.contentid === t.contentid}>
                          <strong>{t.title}</strong>
                          <small>{t.addr1} · {(Number(t.dist) / 1000).toFixed(1)}km</small>
                        </button>
                        <a href={`https://map.kakao.com/link/map/${encodeURIComponent(t.title)},${t.mapy},${t.mapx}`} target="_blank" rel="noreferrer" aria-label={`${t.title} 카카오맵에서 보기`}>↗</a>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </div>}
              </article>
            ))}
            {visiblePlaces.length > 100 && (
              <p className="muted list-note">
                100곳 표시 중 · 검색으로 범위를 좁혀보세요.
              </p>
            )}
          </div>
          </section>
          <section id="chat-view" className="sidebar-view sidebar-chat" role="tabpanel" aria-labelledby="tab-chat" hidden={activeTab !== "chat"}>
            <ChatBot />
          </section>
        </aside>
        <section className="map-panel" aria-label="산행 지도">
          <HikingMap
            places={filtered}
            focusPlace={focusPlace}
            onSelect={selectMapPlace}
            onBounds={setBounds}
            tours={tours}
            activeTour={selected?.category === "peak" ? activeTour : null}
            onTourSelect={setActiveTour}
          />

          <div className="map-legend">
            {(["peak", "shelter", "danger"] as const).map((category) => (
              <span key={category}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/Image/${category === "danger" ? "dangerous" : category}_marker.png`} width="20" height="20" alt="" />
                {labels[category]}
              </span>
            ))}
            {tours.length > 0 && <span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://t1.daumcdn.net/mapjsapi/images/marker.png" width="14" height="21" alt="" />관광지
            </span>}
          </div>
        </section>
          <button className="panel-toggle" onClick={() => setPanelOpen(v => !v)} aria-expanded={panelOpen} aria-controls="place-panel" aria-label={panelOpen ? "장소 목록 접기" : "장소 목록 열기"} title={panelOpen ? "장소 목록 접기" : "장소 목록 열기"}>
            <svg className="panel-toggle-desktop" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{panelOpen ? <path d="m15 7-5 5 5 5"/> : <path d="m9 7 5 5-5 5"/>}</svg>
            <svg className="panel-toggle-mobile" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{panelOpen ? <path d="m7 9 5 5 5-5"/> : <path d="m7 15 5-5 5 5"/>}</svg>
          </button>
      </main>

    </div>
  );
}
