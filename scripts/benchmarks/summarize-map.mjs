import {readFile,writeFile} from 'node:fs/promises';
const median=values=>{const a=[...values].sort((x,y)=>x-y),m=(a.length-1)/2;return(a[Math.floor(m)]+a[Math.ceil(m)])/2;};
const p95=values=>[...values].sort((x,y)=>x-y)[Math.ceil(values.length*.95)-1];
for(const file of process.argv.slice(2)){
 const data=JSON.parse(await readFile(file,'utf8'));
 if(data.runs.length!==10||data.metadata.count!==4870)throw new Error('Incomplete benchmark');
 data.summary=Object.fromEntries(['before','after'].map(variant=>{
  const rs=data.runs.filter(r=>r.variant===variant),ops=kind=>rs.flatMap(r=>r.operations.filter(o=>o.kind===kind));
  if(rs.length!==5||rs.some(r=>r.operations.length!==6))throw new Error('Missing repetitions');
  return[variant,{setupMsMedian:median(rs.map(r=>r.setupMs)),setupToPaintMsMedian:median(rs.map(r=>r.setupToPaintMs)),initialMarkersMedian:median(rs.map(r=>r.initial.created)),initialDomMarkerImagesMedian:median(rs.map(r=>r.initial.markerImages)),panToPaintMsMedian:median(ops('pan').map(o=>o.toPaintMs)),zoomToPaintMsMedian:median(ops('zoom').map(o=>o.toPaintMs)),zoomToPaintMsP95:p95(ops('zoom').map(o=>o.toPaintMs)),panCallMsMedian:median(ops('pan').map(o=>o.callMs)),zoomCallMsMedian:median(ops('zoom').map(o=>o.callMs)),longTaskCountTotal:rs.reduce((n,r)=>n+r.longTaskCount,0),blockingMsTotal:rs.reduce((n,r)=>n+r.longTaskBlockingMs,0),maxCachedMarkers:Math.max(...rs.flatMap(r=>r.operations.map(o=>o.cached))),peakDomMarkerImages:Math.max(...rs.flatMap(r=>r.operations.map(o=>o.markerImages)))}];
 }));
 await writeFile(file,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({file,summary:data.summary},null,2));
}
