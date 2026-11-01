import peaks from "../../public/Data/mountainPeaks.json";
import risks from "../../public/Data/hikingRiskAreas.json";
import riskMetadata from "../../public/Data/hikingRiskAreas.meta.json";
export const riskSyncedAt = new Date(
  riskMetadata.retrievedAt,
).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
export type Category = "peak" | "danger" | "shelter";
export type HikingPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  description: string;
  trail?: string;
};
export const labels: Record<Category, string> = {
  peak: "봉우리",
  danger: "위험지역",
  shelter: "대피소",
};
export const places: HikingPlace[] = [
  ...peaks.map((p) => ({
    id: `peak-${p.poiId}`,
    name: p.placeNm,
    lat: p.lat,
    lng: p.lot,
    category: "peak" as const,
    description: `해발 ${Math.round(p.aslAltide)}m`,
  })),
  ...risks.map((p) => ({
    id: `risk-${p.poiId}`,
    trail: p.frtrlNm,
    name: p.plcNm,
    lat: p.lat,
    lng: p.lot,
    category: (p.plcTypeCd === "SHELTER" ? "shelter" : "danger") as Category,
    description: String(
      p.explnCn || "방문 전 현장 상황과 통제 여부를 확인해 주세요.",
    ),
  })),
].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
