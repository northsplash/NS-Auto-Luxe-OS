const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const endpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

function inside(point: [number, number], polygon: [number, number][]) {
  const [y, x] = point; let hit = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [yi,xi]=polygon[i], [yj,xj]=polygon[j];
    const cross=((xi>x)!=(xj>x)) && (y < (yj-yi)*(x-xi)/((xj-xi)||1e-12)+yi);
    if(cross) hit=!hit;
  }
  return hit;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { south, west, north, east, points=[] } = await req.json();
    if (![south,west,north,east].every(Number.isFinite)) throw new Error('Invalid territory bounds.');
    const area=(north-south)*(east-west);
    if(area<=0 || area>0.08) throw new Error('Territory is too large. Draw a smaller neighborhood area.');
    const q=`[out:json][timeout:18];(way["building"](${south},${west},${north},${east});node["addr:housenumber"](${south},${west},${north},${east}););out center tags;`;
    let last='House discovery providers are busy.';
    for(const url of endpoints){
      try{
        const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),22000);
        const r=await fetch(url,{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:q,signal:ctl.signal}); clearTimeout(timer);
        if(!r.ok){last=`Provider returned ${r.status}`;continue;}
        const json=await r.json();
        const poly=(points as [number,number][]).filter(p=>Array.isArray(p)&&p.length===2);
        const elements=(json.elements||[]).filter((e:any)=>{
          const lat=Number(e.lat??e.center?.lat), lon=Number(e.lon??e.center?.lon);
          if(!Number.isFinite(lat)||!Number.isFinite(lon)) return false;
          return poly.length<3 || inside([lat,lon],poly);
        });
        return new Response(JSON.stringify({success:true,elements,provider:url}),{headers:{...corsHeaders,'content-type':'application/json'}});
      }catch(e){last=e instanceof Error?e.message:String(e)}
    }
    return new Response(JSON.stringify({success:false,error:`House discovery is temporarily unavailable. ${last}`}),{status:503,headers:{...corsHeaders,'content-type':'application/json'}});
  } catch (e) {
    return new Response(JSON.stringify({success:false,error:e instanceof Error?e.message:'Invalid request'}),{status:400,headers:{...corsHeaders,'content-type':'application/json'}});
  }
});
