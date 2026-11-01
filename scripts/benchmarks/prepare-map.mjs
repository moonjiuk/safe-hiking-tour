// Temporary, local-only SDK benchmark. No application source is changed.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root = new URL('../../', import.meta.url);
const target = new URL('public/__map-performance__/', root);
if (process.argv.includes('--clean')) { await rm(target, {recursive: true, force: true}); process.exit(0); }
const key = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
if (!key) throw new Error('Run with --env-file=.env.local');
const source = await readFile(new URL('src/app/components/HikingMap.tsx', root), 'utf8');
const clusterAt = source.indexOf('const cluster = new k.MarkerClusterer');
const effectStart = source.lastIndexOf('  useEffect(() => {', clusterAt);
const start = effectStart + '  useEffect(() => {'.length;
const end = source.indexOf('  }, [ready, places, onSelect, onBounds]);', clusterAt);
if (clusterAt < 0 || effectStart < 0 || end < 0) throw new Error('Map effect changed; review benchmark extraction');
let body = source.slice(start, end);
body = body.replace('const updateVisible = () => {', 'const updateVisible = () => {\n const stepStarted = performance.now(); stats.scans += places.length;');
body = body.replace('const marker = new k.Marker({', 'stats.created++; const marker = new k.Marker({');
body = body.replace('visible = next;', 'visible = next; stats.visible = visible.size; stats.cached = cache.size; stats.updateMs.push(performance.now() - stepStarted);');
const wrapped = `export function createAfter(places, sdkMap) {
const ready = true, map = {current: sdkMap}, flight = {current: null};
const onSelect = () => {}, onBounds = () => {};
const stats = {created:0, scans:0, visible:0, cached:0, updateMs:[]};
const cleanup = (() => {${body}})(); return {stats,cleanup}; }`;
await mkdir(target, {recursive: true});
await writeFile(new URL('after.js', target), ts.transpileModule(wrapped, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText);
const peaksText = await readFile(new URL('public/Data/mountainPeaks.json', root),'utf8');
const risksText = await readFile(new URL('public/Data/hikingRiskAreas.json', root),'utf8');
const peaks = JSON.parse(peaksText), risks = JSON.parse(risksText);
const places = [...peaks.map(p=>({id:`peak-${p.poiId}`,name:p.placeNm,lat:p.lat,lng:p.lot,category:'peak'})), ...risks.map(p=>({id:`risk-${p.poiId}`,name:p.plcNm,lat:p.lat,lng:p.lot,category:p.plcTypeCd==='SHELTER'?'shelter':'danger'}))].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
const baselineCommit = 'e9f0eefcc5a27e6a10c33cb947cce421d7412683';
const oldSource = execFileSync('git',['show',`${baselineCommit}:src/app/page.tsx`],{cwd:root,encoding:'utf8'});
if (!oldSource.includes('MountainPeaks.forEach') || !oldSource.includes('Size(50, 50)')) throw new Error('Review legacy benchmark against baseline source');
const metadata = {date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),baselineCommit,currentSourceSha256:createHash('sha256').update(source).digest('hex'),datasetSha256:createHash('sha256').update(peaksText+risksText).digest('hex'),count:places.length,method:'Baseline recreates the marker effect in the baseline commit; after is the extracted current effect with counters only. Same current dataset and one SDK/map instance; excludes SDK download and initial tiles.'};
await writeFile(new URL('data.json',target),JSON.stringify({places,metadata}));
const template = await readFile(new URL('scripts/benchmarks/map.html',root),'utf8');
await writeFile(new URL('index.html',target),template.replace('__PUBLIC_KAKAO_KEY__',encodeURIComponent(key)));
console.log('Local fixture ready: http://localhost:3000/__map-performance__/index.html');
