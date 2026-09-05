import { useState } from 'react';
import { CreditCard, ExternalLink, ShieldCheck, TestTube2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function OwnerPaymentTest(){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [lastLink,setLastLink]=useState('');
  const returned=new URLSearchParams(window.location.search).get('payment_test')==='returned';

  const startTest=async()=>{
    setLoading(true);setError('');setLastLink('');
    try{
      const {data,error:invokeError}=await supabase.functions.invoke('owner-test-payment-link',{body:{}});
      if(invokeError) throw invokeError;
      if(!data?.success||!data?.url) throw new Error(data?.error||'Square did not return a checkout link.');
      setLastLink(data.url);
      window.location.assign(data.url);
    }catch(e){setError(e instanceof Error?e.message:'Unable to create the test purchase.');setLoading(false)}
  };

  return <div className="tab-content owner-payment-test-page">
    <header className="owner-payment-test-head"><div><span className="eyebrow">OWNER ONLY · PAYMENT LAB</span><h1>1¢ Test Purchase</h1><p>Create a real Square-hosted checkout for exactly $0.01 whenever you want to verify that production payments are reachable.</p></div><div className="owner-test-price"><small>TEST TOTAL</small><strong>$0.01</strong></div></header>
    {returned&&<div className="owner-payment-return"><CheckCircle2 size={19}/><div><strong>Returned from Square Checkout</strong><span>Check your Square Dashboard to confirm the final payment status. A redirect only means Square returned you to the portal; it is not used as proof of payment.</span></div></div>}
    {error&&<div className="owner-payment-error"><AlertTriangle size={19}/><span>{error}</span></div>}
    <div className="owner-payment-test-grid">
      <section className="owner-payment-test-card primary"><TestTube2 size={28}/><span className="eyebrow">LIVE PAYMENT TEST</span><h2>Charge one cent through Square</h2><p>The portal asks a protected Supabase Edge Function to create a Square-hosted Quick Pay checkout. Card data never touches North Splash OS.</p><button className="btn-primary owner-test-pay-button" disabled={loading} onClick={()=>void startTest()}><CreditCard size={18}/>{loading?'Creating Square checkout…':'Create $0.01 Test Purchase'}<ExternalLink size={16}/></button>{lastLink&&<a href={lastLink}>Open last checkout link</a>}</section>
      <section className="owner-payment-test-card"><ShieldCheck size={28}/><span className="eyebrow">OWNER PROTECTED</span><h2>Not available to Admin or employees</h2><p>The server verifies the signed-in user is an active Owner before creating the link. The amount is hard-coded server-side to one cent and cannot be changed from the browser.</p><ul><li>Requires <code>SQUARE_ACCESS_TOKEN</code></li><li>Requires <code>SQUARE_LOCATION_ID</code></li><li>Uses Square-hosted checkout</li><li>Creates a unique idempotency key every test</li></ul></section>
    </div>
    <section className="owner-payment-test-note"><AlertTriangle size={18}/><div><strong>This is a real production payment.</strong><p>Square supports a $0.01 minimum card payment in the U.S. Processing fees can still apply. Use a card you are authorized to test and review the payment in Square after checkout.</p></div></section>
  </div>;
}
