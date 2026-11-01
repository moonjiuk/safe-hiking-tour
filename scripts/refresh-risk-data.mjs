import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Run with Node's --env-file=.env.local. No key is embedded in the output.
const endpoint =
  "https://apis.data.go.kr/B553662/dangerInfoService/getDangerInfoList";
const root = new URL("../", import.meta.url);
const key = process.env.HIKING_API_KEY || process.env.TOURISM_API_KEY;
if (!key) throw new Error("HIKING_API_KEY를 설정해 주세요.");
const rows = [];
for (const category of ["DANGER", "SHELTER"]) {
  let total;
  const collected = [];
  for (let page = 1; page <= 1000; page++) {
    const query = new URLSearchParams({
      serviceKey: key,
      type: "json",
      pageNo: String(page),
      numOfRows: "5000",
      srchPlaceTpeCd: category,
    });
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(`${endpoint}?${query}`, {
          signal: AbortSignal.timeout(55000),
        });
        if (response.status >= 500 && attempt < 2) continue;
        break;
      } catch {
        if (attempt === 2)
          throw new Error(
            `원본 API 시간 초과: ${category} ${page}페이지. 기존 데이터는 보존합니다.`,
          );
      }
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `원본이 JSON 응답을 반환하지 않았습니다. HTTP ${response.status}`,
      );
    }
    const auth = data.OpenAPI_ServiceResponse?.cmmMsgHeader;
    const envelope = data.response || data;
    const code = String(
      auth?.returnReasonCode || envelope.header?.resultCode || "",
    );
    if (!response.ok || !["0", "00", "0000"].includes(code))
      throw new Error(
        `공식 API 조회 실패: HTTP ${response.status}, 코드 ${code}. 기존 데이터는 보존합니다.`,
      );
    const body = envelope.body;
    const count = Number(body?.totalCount);
    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      (total !== undefined && total !== count)
    )
      throw new Error(
        "총 건수가 비정상적이거나 수집 중 변경되었습니다. 다시 수집해 주세요.",
      );
    total = count;
    const item = body.items?.item;
    const batch = Array.isArray(item) ? item : item ? [item] : [];
    if (!batch.length)
      throw new Error(
        "전체 수집 전에 빈 페이지를 받았습니다. 기존 데이터는 보존합니다.",
      );
    if (batch.some((row) => row.plcTypeCd !== category))
      throw new Error("원본 API가 장소 유형 필터를 적용하지 않았습니다.");
    collected.push(...batch);
    console.log(`수집 ${category}: ${collected.length}/${total}`);
    if (collected.length >= total) break;
  }
  if (collected.length !== total)
    throw new Error("전체 페이지 검증에 실패했습니다.");
  rows.push(...collected);
}
const seen = new Set();
const normalized = rows.map((row) => {
  const poiId = String(row.poiId || "");
  const lat = Number(row.lat),
    lot = Number(row.lot);
  if (
    !poiId ||
    seen.has(poiId) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lot) ||
    lat < 33 ||
    lat > 39 ||
    lot < 124 ||
    lot > 132 ||
    !["DANGER", "SHELTER"].includes(row.plcTypeCd)
  )
    throw new Error(
      `원본 검증 실패: id=${poiId}, duplicate=${seen.has(poiId)}, lat=${lat}, lng=${lot}, type=${row.plcTypeCd}. 기존 데이터는 보존합니다.`,
    );
  seen.add(poiId);
  return {
    poiId,
    plcNm: String(row.plcNm || "이름 없는 지점"),
    explnCn: String(row.explnCn || ""),
    plcTypeCd: row.plcTypeCd,
    lat,
    lot,
    aslAltide: Number(row.aslAltide) || 0,
    crtrDt: String(row.crtrDt || ""),
    frtrlNm: String(row.frtrlNm || ""),
  };
});
const target = new URL("public/Data/hikingRiskAreas.json", root);
const old = JSON.parse(await readFile(target, "utf8"));
// An unexpectedly large reduction needs investigation, never a silent overwrite.
if (normalized.length < old.length * 0.8)
  throw new Error(
    "기존 대비 20% 이상 감소했습니다. 원본 변경 여부를 검토해 주세요.",
  );
const metadata = {
  source: "한국등산트레킹지원센터_전국주요봉우리 위험지역 POI 정보 서비스",
  sourceUrl: "https://www.data.go.kr/data/15108067/openapi.do",
  endpoint,
  retrievedAt: new Date().toISOString(),
  count: normalized.length,
  referenceDates: [
    ...new Set(normalized.map((p) => p.crtrDt).filter(Boolean)),
  ].sort(),
};
console.log(
  JSON.stringify({
    previousCount: old.length,
    fetchedCount: normalized.length,
    referenceDates: metadata.referenceDates,
    applied: process.argv.includes("--apply"),
  }),
);
if (process.argv.includes("--apply")) {
  // Complete validation above before updating either checked-in data file.
  await writeFile(target, JSON.stringify(normalized, null, 2) + "\n");
  await writeFile(
    new URL("public/Data/hikingRiskAreas.meta.json", root),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    "위험지역 데이터 및 출처 메타데이터 갱신 완료:",
    fileURLToPath(target),
  );
}
