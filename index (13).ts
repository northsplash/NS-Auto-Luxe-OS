import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ success:false, error:'POST required.' }, 405);

  try {
    const body = await req.json();
    const south = Number(body?.south);
    const west = Number(body?.west);
    const north = Number(body?.north);
    const east = Number(body?.east);

    if (![south,west,north,east].every(Number.isFinite)) {
      return json({ success:false, error:'Valid territory bounds are required.' }, 400);
    }
    if (south >= north || west >= east) {
      return json({ success:false, error:'Territory bounds are invalid.' }, 400);
    }

    const latSpan = north - south;
    const lngSpan = east - west;
    if (latSpan > 0.08 || lngSpan > 0.08) {
      return json({ success:false, error:'This territory is too large to scan at once. Draw a smaller territory.' }, 400);
    }

    const polygon = Array.isArray(body?.points)
      ? body.points.map((p:any)=>[Number(p?.[0]),Number(p?.[1])] as [number,number]).filter((p:[number,number])=>Number.isFinite(p[0])&&Number.isFinite(p[1]))
      : [];
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:18];(way["building"](${bbox});node["addr:housenumber"](${bbox}););out center tags;`;

    const failures: string[] = [];
    for (const endpoint of ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type':'text/plain', 'Accept':'application/json' },
          body: query,
          signal: controller.signal,
        });
        const text = await response.text();
        if (!response.ok) {
          failures.push(`${new URL(endpoint).host}: HTTP ${response.status}`);
          continue;
        }
        let payload: any;
        try { payload = JSON.parse(text); }
        catch { failures.push(`${new URL(endpoint).host}: invalid response`); continue; }

        const elements = (payload?.elements || []).filter((item:any)=>{
          if (polygon.length < 3) return true;
          const lat=Number(item?.lat ?? item?.center?.lat);
          const lng=Number(item?.lon ?? item?.center?.lon);
          return Number.isFinite(lat)&&Number.isFinite(lng)&&pointInPolygon(lat,lng,polygon);
        });
        return new Response(JSON.stringify({
          success: true,
          provider: new URL(endpoint).host,
          elements,
          fetched_at: new Date().toISOString(),
        }), {
          status: 200,
          headers: { ...cors, 'Cache-Control':'public, max-age=300' },
        });
      } catch (error) {
        failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
    }

    return json({
      success:false,
      error:'Free map providers are busy right now. Try again in a moment.',
      attempts:failures,
    });
  } catch (error) {
    return json({ success:false, error:error instanceof Error ? error.message : String(error) }, 400);
  }
});

function pointInPolygon(lat:number,lng:number,points:[number,number][]){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const yi=points[i][0],xi=points[i][1],yj=points[j][0],xj=points[j][1];
    const hit=((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers:cors });
}
