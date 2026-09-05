import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({success:false,error:'Method not allowed.'},405);
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL');
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const squareToken=Deno.env.get('SQUARE_ACCESS_TOKEN');
    const squareLocation=Deno.env.get('SQUARE_LOCATION_ID');
    const ownerPortalUrl=(Deno.env.get('OWNER_PORTAL_URL')||'https://ns-auto-luxe-os.vercel.app').replace(/\/$/,'');
    if(!supabaseUrl||!anonKey||!serviceKey) return json({success:false,error:'Supabase function secrets are incomplete.'},500);
    if(!squareToken||!squareLocation) return json({success:false,error:'Square credentials are missing. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to Supabase Edge Function secrets.'},500);
    const authHeader=req.headers.get('Authorization')||'';
    const token=authHeader.replace(/^Bearer\s+/i,'').trim();
    if(!token) return json({success:false,error:'Sign in as an Owner to run a payment test.'},401);

    const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data:userData,error:userError}=await authClient.auth.getUser(token);
    if(userError||!userData.user) return json({success:false,error:'Owner session could not be verified.'},401);

    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
    const {data:profile,error:profileError}=await admin.from('profiles').select('portal_role,is_active,full_name,email').eq('id',userData.user.id).maybeSingle();
    if(profileError) return json({success:false,error:'Unable to verify Owner access.'},500);
    if(profile?.portal_role!=='owner'||profile?.is_active===false) return json({success:false,error:'This payment test is available only to active Owners.'},403);

    const idempotencyKey=crypto.randomUUID();
    const squareResponse=await fetch('https://connect.squareup.com/v2/online-checkout/payment-links',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${squareToken}`,
        'Content-Type':'application/json',
        'Square-Version':'2026-08-19',
      },
      body:JSON.stringify({
        idempotency_key:idempotencyKey,
        description:'North Splash Auto Luxe owner production payment test',
        payment_note:`Owner 1-cent payment test · ${userData.user.id}`,
        quick_pay:{name:'North Splash Owner Payment Test',price_money:{amount:1,currency:'USD'},location_id:squareLocation},
        checkout_options:{allow_tipping:false,ask_for_shipping_address:false,redirect_url:`${ownerPortalUrl}/owner?view=payment_test&payment_test=returned`},
        pre_populated_data:{buyer_email:profile?.email||userData.user.email||undefined},
      }),
    });
    const squareData=await squareResponse.json().catch(()=>({}));
    if(!squareResponse.ok||!squareData?.payment_link?.url){
      const message=squareData?.errors?.map((x:any)=>x.detail||x.code).filter(Boolean).join(' · ')||'Square could not create the payment link.';
      return json({success:false,error:message},squareResponse.status||502);
    }
    return json({success:true,url:squareData.payment_link.url,paymentLinkId:squareData.payment_link.id,orderId:squareData.payment_link.order_id,amount:0.01});
  }catch(e){
    console.error('owner-test-payment-link',e);
    return json({success:false,error:e instanceof Error?e.message:'Unexpected payment-test error.'},500);
  }
});
