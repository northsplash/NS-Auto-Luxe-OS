import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Car, Check, ChevronLeft, ChevronRight,
  Clock3, Crown, DollarSign, Droplets, Gauge, Home, Maximize2, ShieldCheck,
  Sparkles, Star, Target, X,
} from 'lucide-react';
import { MEMBERSHIPS, PACKAGES, VEHICLE_SIZES, money } from '@/lib/data';

type OfferSelection={
  type:'service'|'membership';
  name:string;
  amount:number;
  detail:string;
};

type Props={
  customerName?:string;
  onClose?:()=>void;
  onSelectOffer?:(offer:OfferSelection)=>void;
  onEvent?:(event:string,detail?:Record<string,unknown>)=>void;
  embedded?:boolean;
};

const slides=[
  {id:'welcome',label:'Welcome'},
  {id:'why',label:'Why Detail'},
  {id:'carwash',label:'Vs. Car Wash'},
  {id:'difference',label:'Why North Splash'},
  {id:'services',label:'Services'},
  {id:'membership',label:'Membership'},
  {id:'plans',label:'Plans'},
  {id:'close',label:'Get Started'},
] as const;

export default function SalesPresentation({customerName,onClose,onSelectOffer,onEvent,embedded=false}:Props){
  const [slide,setSlide]=useState(0);
  const [mode,setMode]=useState<'presentation'|'quote'>('presentation');
  const [offerType,setOfferType]=useState<'service'|'membership'>('membership');
  const [serviceIndex,setServiceIndex]=useState(1);
  const [membershipIndex,setMembershipIndex]=useState(1);
  const [vehicleIndex,setVehicleIndex]=useState(0);

  const servicePrice=PACKAGES[serviceIndex].price+VEHICLE_SIZES[vehicleIndex].extra;
  const currentOffer:OfferSelection=offerType==='service'
    ?{type:'service',name:PACKAGES[serviceIndex].name,amount:servicePrice,detail:`${VEHICLE_SIZES[vehicleIndex].name} · starting estimate`}
    :{type:'membership',name:MEMBERSHIPS[membershipIndex].name,amount:MEMBERSHIPS[membershipIndex].price,detail:'monthly membership'};

  const progress=((slide+1)/slides.length)*100;
  const greeting=customerName?.trim()?`For ${customerName.trim()}`:'Premium vehicle care, brought to you';

  const go=(next:number)=>{
    const clamped=Math.max(0,Math.min(slides.length-1,next));
    if(clamped!==slide){setSlide(clamped);onEvent?.('slide_view',{slide:slides[clamped].id,index:clamped});}
  };
  const presentFullscreen=async()=>{
    onEvent?.('presentation_started',{source:'fullscreen'});
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.()}catch{/* fullscreen is optional */}
  };
  const chooseOffer=()=>{onEvent?.('offer_selected',currentOffer);onSelectOffer?.(currentOffer)};

  const content=useMemo(()=>{
    switch(slides[slide].id){
      case 'welcome': return <section className="sales-slide sales-slide-hero">
        <div className="sales-hero-copy"><span className="sales-kicker">NORTH SPLASH AUTO LUXE</span><p>{greeting}</p><h2>Your vehicle deserves more than a quick wash.</h2><p className="sales-lead">We bring premium detailing directly to your driveway, with a repeatable process built around convenience, careful vehicle care and a finish you can actually inspect.</p><div className="sales-hero-pills"><span><Home/>Mobile convenience</span><span><Sparkles/>Detail-focused care</span><span><ShieldCheck/>Professional process</span></div></div>
        <div className="sales-hero-mark"><div className="sales-monogram">NS</div><strong>AUTO LUXE</strong><span>PREMIUM DETAILING</span></div>
      </section>;
      case 'why': return <section className="sales-slide"><div className="sales-slide-heading"><span className="sales-kicker">WHY DETAILING?</span><h2>Clean is only part of the job.</h2><p>Professional detailing is about the areas, surfaces and finishing steps a quick wash usually does not address.</p></div><div className="sales-benefit-grid">
        <article><Car/><h3>Whole-vehicle attention</h3><p>Interior, exterior, glass, wheels, trim and the details that change how the entire vehicle feels.</p></article>
        <article><ShieldCheck/><h3>Care for the finish</h3><p>Hand-focused processes and protection options designed around the vehicle rather than a one-size-fits-all wash cycle.</p></article>
        <article><Clock3/><h3>Your time stays yours</h3><p>We come to the customer, reducing the time spent driving to a shop and waiting around for service.</p></article>
        <article><Sparkles/><h3>Consistent appearance</h3><p>Scheduled maintenance keeps dirt and buildup from becoming the new normal between major cleanups.</p></article>
      </div></section>;
      case 'carwash': return <section className="sales-slide"><div className="sales-slide-heading"><span className="sales-kicker">THE DIFFERENCE</span><h2>Car wash convenience vs. detailing attention.</h2><p>Both have a place. The difference is how much individual attention the vehicle receives.</p></div><div className="sales-compare">
        <div className="sales-compare-col muted"><span>AUTOMATED / EXPRESS WASH</span><h3>Built for speed</h3>{['Fast exterior cleaning','Standardized wash process','Limited interior attention','Customer travels to location','Little or no service history'].map(x=><p key={x}><X/>{x}</p>)}</div>
        <div className="sales-compare-vs">VS</div>
        <div className="sales-compare-col featured"><span>NORTH SPLASH AUTO LUXE</span><h3>Built around your vehicle</h3>{['Detail-focused exterior care','Interior + exterior options','Mobile service at your location','Package choices by need','Customer history + memberships'].map(x=><p key={x}><Check/>{x}</p>)}</div>
      </div><small className="sales-footnote">An express wash can be useful for a quick rinse. North Splash is designed for customers who want a more complete, individualized service.</small></section>;
      case 'difference': return <section className="sales-slide"><div className="sales-slide-heading"><span className="sales-kicker">WHY NORTH SPLASH?</span><h2>More than “someone with detailing supplies.”</h2><p>We are building the service around consistency, accountability and an easier customer experience.</p></div><div className="sales-proof-grid">
        <article><BadgeCheck/><span>01</span><h3>Defined service packages</h3><p>You know what level of service you are choosing before the job starts.</p></article>
        <article><Gauge/><span>02</span><h3>Tracked customer history</h3><p>Bookings, service activity and membership care can stay connected through the North Splash system.</p></article>
        <article><Home/><span>03</span><h3>Mobile-first convenience</h3><p>Your driveway becomes the service bay when mobile service is available.</p></article>
        <article><Crown/><span>04</span><h3>Built for ongoing care</h3><p>One-time details are available, but memberships make consistent maintenance simple.</p></article>
      </div></section>;
      case 'services': return <section className="sales-slide"><div className="sales-slide-heading"><span className="sales-kicker">ONE-TIME SERVICES</span><h2>Choose the level your vehicle needs today.</h2><p>Final pricing can vary by vehicle size, condition and selected add-ons.</p></div><div className="sales-product-grid">{PACKAGES.map((p,i)=><article key={p.name} className={p.featured?'featured':''}><span>{p.tag}</span><h3>{p.name}</h3><strong>{money(p.price)}<small>+</small></strong><p>{p.desc}</p><ul>{p.features.slice(0,5).map(f=><li key={f}><Check/>{f}</li>)}</ul><button type="button" onClick={()=>{setServiceIndex(i);setOfferType('service');setMode('quote');onEvent?.('offer_view',{type:'service',name:p.name})}}>Price This Service</button></article>)}</div></section>;
      case 'membership': return <section className="sales-slide sales-membership-story"><div className="sales-slide-heading"><span className="sales-kicker">WHY MEMBERSHIP?</span><h2>Stop waiting until the vehicle is “bad enough” to detail.</h2><p>A membership turns vehicle care into a routine instead of another task to remember.</p></div><div className="sales-membership-flow"><article><span>1</span><h3>Set the rhythm</h3><p>Choose the maintenance plan that matches how you want the vehicle to look.</p></article><i/><article><span>2</span><h3>We keep up with it</h3><p>Regular service helps prevent the long gaps that lead to heavier buildup.</p></article><i/><article><span>3</span><h3>Stay consistently ready</h3><p>Your vehicle stays closer to “just detailed” instead of cycling between clean and neglected.</p></article></div><div className="sales-membership-banner"><Star/><div><strong>The value is consistency.</strong><span>Priority-oriented scheduling and recurring care make the membership easier to use than repeatedly starting from zero.</span></div><button type="button" onClick={()=>go(6)}>Compare Plans <ArrowRight/></button></div></section>;
      case 'plans': return <section className="sales-slide"><div className="sales-slide-heading"><span className="sales-kicker">MEMBERSHIP OPTIONS</span><h2>Pick how hands-off you want vehicle care to be.</h2><p>Monthly pricing shown below. Exact service availability and terms are confirmed during enrollment.</p></div><div className="sales-product-grid memberships">{MEMBERSHIPS.map((m,i)=><article key={m.name} className={i===1?'featured':''}><span>{i===1?'MOST POPULAR':'MEMBERSHIP'}</span><h3>{m.name}</h3><strong>{money(m.price)}<small>/mo</small></strong><p>{m.desc}</p><ul>{m.features.map(f=><li key={f}><Check/>{f}</li>)}</ul><button type="button" onClick={()=>{setMembershipIndex(i);setOfferType('membership');setMode('quote');onEvent?.('offer_view',{type:'membership',name:m.name})}}>Show Customer Price</button></article>)}</div></section>;
      case 'close': return <section className="sales-slide sales-close-slide"><div className="sales-close-main"><span className="sales-kicker">READY WHEN YOU ARE</span><h2>What makes the most sense for your vehicle?</h2><p>We can start with a one-time detail or set up ongoing maintenance so you do not have to keep thinking about it.</p><div className="sales-close-options"><button type="button" onClick={()=>{setOfferType('service');setMode('quote')}}><Sparkles/><span><strong>One-Time Detail</strong><small>Reset the vehicle now</small></span><ChevronRight/></button><button type="button" className="primary" onClick={()=>{setOfferType('membership');setMode('quote')}}><Crown/><span><strong>Membership</strong><small>Keep it consistently maintained</small></span><ChevronRight/></button></div></div><div className="sales-close-card"><span>NORTH SPLASH AUTO LUXE</span><strong>Premium care.<br/>At your door.</strong><p>Choose your service with your North Splash representative.</p></div></section>;
      default:return null;
    }
  },[slide,greeting,onEvent]);

  return <div className={`${embedded?'sales-presentation-embedded':'sales-presentation-overlay'}`}>
    <div className="sales-presentation-shell">
      <header className="sales-presentation-header"><div className="sales-presentation-brand"><b>NS</b><span><strong>NORTH SPLASH</strong><small>SALES PRESENTATION</small></span></div><div className="sales-presentation-mode"><button type="button" className={mode==='presentation'?'active':''} onClick={()=>setMode('presentation')}>Presentation</button><button type="button" className={mode==='quote'?'active':''} onClick={()=>setMode('quote')}>Quote Mode</button></div><div className="sales-presentation-tools">{!embedded&&<button type="button" onClick={presentFullscreen} title="Full screen"><Maximize2/></button>}{onClose&&<button type="button" onClick={onClose} title="Close"><X/></button>}</div></header>
      {mode==='presentation'?<>
        <div className="sales-slide-progress"><i style={{width:`${progress}%`}}/></div>
        <div className="sales-presentation-body">{content}</div>
        <footer className="sales-presentation-footer"><button type="button" onClick={()=>go(slide-1)} disabled={slide===0}><ChevronLeft/>Previous</button><div className="sales-slide-dots">{slides.map((s,i)=><button type="button" aria-label={`Go to ${s.label}`} className={i===slide?'active':''} key={s.id} onClick={()=>go(i)}><span>{i+1}</span><small>{s.label}</small></button>)}</div><button type="button" className="next" onClick={()=>slide===slides.length-1?setMode('quote'):go(slide+1)}>{slide===slides.length-1?'Build Quote':'Next'}<ChevronRight/></button></footer>
      </>:<div className="sales-quote-mode">
        <section className="sales-quote-builder"><div className="sales-slide-heading"><span className="sales-kicker">CUSTOMER QUOTE</span><h2>Build the offer in front of the customer.</h2><p>Select a one-time service or membership. This creates a sales estimate for the D2D lead; final pricing can still be adjusted based on condition and add-ons.</p></div><div className="sales-quote-toggle"><button type="button" className={offerType==='service'?'active':''} onClick={()=>setOfferType('service')}><Sparkles/>One-Time Service</button><button type="button" className={offerType==='membership'?'active':''} onClick={()=>setOfferType('membership')}><Crown/>Membership</button></div>
          {offerType==='service'?<div className="sales-quote-options"><label><span>Service</span><select value={serviceIndex} onChange={e=>setServiceIndex(Number(e.target.value))}>{PACKAGES.map((p,i)=><option value={i} key={p.name}>{p.name} — {money(p.price)}+</option>)}</select></label><label><span>Vehicle</span><select value={vehicleIndex} onChange={e=>setVehicleIndex(Number(e.target.value))}>{VEHICLE_SIZES.map((v,i)=><option value={i} key={v.name}>{v.name}{v.extra?` +${money(v.extra)}`:''}</option>)}</select></label></div>:<div className="sales-quote-plan-picker">{MEMBERSHIPS.map((m,i)=><button type="button" className={i===membershipIndex?'active':''} key={m.name} onClick={()=>setMembershipIndex(i)}><span>{m.name}</span><strong>{money(m.price)}<small>/mo</small></strong><em>{m.desc}</em></button>)}</div>}
        </section>
        <aside className="sales-quote-summary"><span className="sales-kicker">TODAY'S RECOMMENDATION</span><h3>{currentOffer.name}</h3><strong>{money(currentOffer.amount)}<small>{currentOffer.type==='membership'?'/month':' estimated'}</small></strong><p>{currentOffer.detail}</p><div className="sales-quote-includes">{(currentOffer.type==='service'?PACKAGES[serviceIndex].features:MEMBERSHIPS[membershipIndex].features).slice(0,6).map(f=><span key={f}><Check/>{f}</span>)}</div><button type="button" className="sales-use-offer" onClick={chooseOffer}><Target/>Use This Offer for Lead</button><button type="button" className="sales-back-presentation" onClick={()=>setMode('presentation')}><ArrowLeft/>Back to Presentation</button><small>Final service price may change for vehicle size, condition or add-ons. Membership enrollment terms are confirmed before purchase.</small></aside>
      </div>}
    </div>
  </div>;
}
