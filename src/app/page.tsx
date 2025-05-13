"use client";
import "./global.scss";

// 라이브러리
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { marked } from "marked";
import axios from "axios";

// 이미지 파일
import PeakMarker from "../../public/Image/peak_marker.png";
import DangerousMarker from "../../public/Image/dangerous_marker.png";
import ShelterMarker from "../../public/Image/shelter_marker.png";
import MeMarker from "../../public/Image/me_marker.png";
import ChevronLeft from "../../public/Image/chevron-left.svg";
import ChevronRight from "../../public/Image/chevron-right.svg";

// 데이터 파일  
import HikingRiskAreas from "../../public/Data/hikingRiskAreas.json";
import MountainPeaks from "../../public/Data/mountainPeaks.json";

// 컴포넌트
import SearchBar from "./components/SearchBar";
import TourList from "./components/TourList";
import ChatBot from "./components/ChatBot";

// 키
const kakaoApiKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
const tourismApiKey = process.env.NEXT_PUBLIC_TOURISM_API_KEY;
const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

type Place = any; // 실제 타입 정의 필요

type Spot = any; // 실제 타입 정의 필요

// 1. kakao 글로벌 선언 추가
// kakao maps SDK는 window.kakao로 로드되므로, 타입스크립트에서 kakao를 인식하게 한다.
declare global {
  interface Window {
    kakao: any;
  }
}

export default function Home() {
  const [map, setMap] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const [tourismSpots, setTourismSpots] = useState<Spot[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarOpen2, setIsSidebarOpen2] = useState(false);
  const [currentMarker, setCurrentMarker] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDetail, setPendingDetail] = useState(false);
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement>({} as HTMLDivElement);

  const toggleSidebar = () => setIsSidebarOpen((v) => !v);
  const toggleSidebar2 = () => setIsSidebarOpen2((v) => !v);

  const getGeminiResponse = async (question: string) => {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
        { contents: [{ parts: [{ text: question }] }] },
        { headers: { "Content-Type": "application/json" } }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching data from Gemini API:", error);
      return "오류 발생. 다시 시도해주세요.";
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoApiKey}&autoload=false&libraries=services,clusterer`;
    document.head.appendChild(script);
    script.onload = () => {
      window.kakao.maps.load(() => {
        const container = mapContainer.current;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const options = {
              center: new window.kakao.maps.LatLng(position.coords.latitude, position.coords.longitude),
              level: 5,
            };
            const newMap = new window.kakao.maps.Map(container, options);
            setMap(newMap);
            new window.kakao.maps.Marker({
              position: new window.kakao.maps.LatLng(position.coords.latitude, position.coords.longitude),
              map: newMap,
            });
          },
          () => {
            const fallback = new window.kakao.maps.Map(container, {
              center: new window.kakao.maps.LatLng(36.88, 128.11),
              level: 5,
            });
            setMap(fallback);
          }
        );
      });
    };
  }, []);

  useEffect(() => {
    if (map) {
      const infoWindow = new window.kakao.maps.InfoWindow();
      MountainPeaks.forEach((peak: any) => {
        const marker = new window.kakao.maps.Marker({
          map: map,
          position: new window.kakao.maps.LatLng(peak.lat, peak.lot),
          title: peak.placeNm,
        });
        marker.setImage(new window.kakao.maps.MarkerImage(PeakMarker.src, new window.kakao.maps.Size(50, 50)));
        window.kakao.maps.event.addListener(marker, "click", () => {
          infoWindow.setContent(`<div style=\"text-align:center;\">${peak.placeNm}</div>`);
          infoWindow.open(map, marker);
        });
      });
      HikingRiskAreas.forEach((area: any) => {
        let imageSrc = area.plcTypeCd === "SHELTER" ? ShelterMarker.src : DangerousMarker.src;
        const marker = new window.kakao.maps.Marker({
          map: map,
          position: new window.kakao.maps.LatLng(area.lat, area.lot),
          title: area.plcNm,
        });
        marker.setImage(new window.kakao.maps.MarkerImage(imageSrc, new window.kakao.maps.Size(50, 50)));
        window.kakao.maps.event.addListener(marker, "click", () => {
          infoWindow.setContent(`<div style=\"text-align:center;\">${area.plcNm}</div>`);
          infoWindow.open(map, marker);
        });
      });
      window.kakao.maps.event.addListener(map, "click", () => infoWindow.close());
    }
  }, [map]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    if (!value.trim()) return setPlaces([]);
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      value,
      (data: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) setPlaces(data);
      },
      { size: 5 }
    );
  };

  const handlePlaceSelect = (place: any) => {
    setSelectedLocationName(place.place_name);
    setSelectedLocation({ latitude: Number(place.y), longitude: Number(place.x) });
    if (map) {
      const loc = new window.kakao.maps.LatLng(place.y, place.x);
      map.panTo(loc);
      if (currentMarker) currentMarker.setMap(null);
      const marker = new window.kakao.maps.Marker({ map, position: loc, title: place.place_name });
      marker.setImage(new window.kakao.maps.MarkerImage(MeMarker.src, new window.kakao.maps.Size(50, 50)));
      setCurrentMarker(marker);
    }
    setPlaces([]);
  };

  useEffect(() => {
    if (!selectedLocation) return;
    const fetchSpots = async () => {
      const url = "https://apis.data.go.kr/B551011/KorService1/locationBasedList1";
      const params = new URLSearchParams({
        serviceKey: tourismApiKey ?? "",
        numOfRows: "20",
        pageNo: "1",
        MobileOS: "ETC",
        MobileApp: "SafeHikingTour",
        arrange: "A",
        mapX: String(selectedLocation.longitude),
        mapY: String(selectedLocation.latitude),
        radius: "5000",
        listYN: "Y",
        _type: "json",
      });
      try {
        const response = await fetch(`${url}?${params.toString()}`);
        const data = await response.json();
        setTourismSpots(data.response.body.items.item);
      } catch (e) {
        console.error("Tourism fetch error:", e);
      }
    };
    fetchSpots();
  }, [selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setPlaces([]);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTouristSpotClick = (spot: any) => {
    setInputText(spot.addr1);
    handleInputChange({ target: { value: spot.addr1 } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleQuestionChange = (e: React.ChangeEvent<HTMLInputElement>) => setQuestion(e.target.value);

  const handleSendQuestion = async () => {
    if (!question.trim() || loading) return;
    if (isFirstQuestion) {
      const hikingKeywords = ["등산", "산", "트레킹", "하이킹", "등산로", "정상"];
      if (!hikingKeywords.some((k) => question.includes(k))) {
        setChatHistory([...chatHistory, { type: "answer", text: "등산 관련 질문만 가능합니다." }]);
        setQuestion("");
        return;
      }
    }
    const newHistory = [...chatHistory, { type: "question", text: question }];
    setChatHistory(newHistory);
    setLoading(true);
    setIsFirstQuestion(false);
    const historyText = pendingDetail
      ? newHistory.map((e) => e.text).join("\n") + ` 추가 정보: ${question}`
      : newHistory.map((e) => e.text).join("\n");
    const answer = await getGeminiResponse(historyText);
    let extracted = "적절한 응답을 받지 못했습니다.";
    if (answer?.candidates?.[0]?.content?.parts) {
      extracted = answer.candidates[0].content.parts.map((part: any) => part.text).join(" ");
      setPendingDetail(extracted.includes("더 자세히 알려주세요"));
    }
    setChatHistory([...newHistory, { type: "answer", text: marked.parse(extracted) }]);
    setQuestion("");
    setLoading(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSendQuestion();
    }
  };

  return (
    <>
      <div className="mapContainer" ref={mapContainer} />

      <div className={`info ${isSidebarOpen ? "open" : "closed"}`}>
        <div className="infoToggle" onClick={toggleSidebar}>
          <Image src={isSidebarOpen ? "/Image/chevron-left.svg" : "/Image/chevron-right.svg"} alt="Toggle Sidebar" width={25} height={50} />
        </div>
        <SearchBar
          inputText={inputText}
          onInputChange={handleInputChange}
          places={places}
          onPlaceSelect={handlePlaceSelect}
          searchContainerRef={searchContainerRef}
        />
        <TourList
          selectedLocationName={selectedLocationName}
          tourismSpots={tourismSpots}
          onTouristSpotClick={handleTouristSpotClick}
        />
      </div>

      <div className={`chatBot ${isSidebarOpen2 ? "open" : "closed"}`}>
        <div className="chatBotToggle" onClick={toggleSidebar2}>
          <Image src={isSidebarOpen2 ? "/Image/chevron-right.svg" : "/Image/chevron-left.svg"} alt="Toggle Chatbot" width={25} height={50} />
        </div>
        <ChatBot
          chatHistory={chatHistory}
          question={question}
          onQuestionChange={handleQuestionChange}
          onSendQuestion={handleSendQuestion}
          onKeyDown={handleKeyDown}
          loading={loading}
        />
      </div>
    </>
  );
}
