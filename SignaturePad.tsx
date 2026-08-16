import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({ onChange, height=150 }:{onChange:(dataUrl:string)=>void;height?:number}){
  const ref=useRef<HTMLCanvasElement|null>(null);const drawing=useRef(false);const [hasInk,setHasInk]=useState(false);
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;const resize=()=>{const ratio=window.devicePixelRatio||1;const rect=canvas.getBoundingClientRect();const previous=hasInk?canvas.toDataURL():null;canvas.width=Math.max(1,Math.floor(rect.width*ratio));canvas.height=Math.floor(height*ratio);const ctx=canvas.getContext('2d');if(ctx){ctx.scale(ratio,ratio);ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#211811';if(previous){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,height);img.src=previous}}};resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[height]);
  const point=(e:any)=>{const c=ref.current!;const r=c.getBoundingClientRect();const p=e.touches?.[0]||e;return{x:p.clientX-r.left,y:p.clientY-r.top}};
  const down=(e:any)=>{e.preventDefault();drawing.current=true;const p=point(e),ctx=ref.current?.getContext('2d');ctx?.beginPath();ctx?.moveTo(p.x,p.y)};
  const move=(e:any)=>{if(!drawing.current)return;e.preventDefault();const p=point(e),ctx=ref.current?.getContext('2d');ctx?.lineTo(p.x,p.y);ctx?.stroke();setHasInk(true)};
  const up=()=>{if(!drawing.current)return;drawing.current=false;const c=ref.current;if(c&&hasInk)onChange(c.toDataURL('image/png'))};
  const clear=()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d');ctx?.clearRect(0,0,c.width,c.height);setHasInk(false);onChange('')};
  return <div className="signature-pad"><canvas ref={ref} style={{height}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up}/><div><span>{hasInk?'Signature captured':'Sign inside the box'}</span><button type="button" onClick={clear}>Clear</button></div></div>
}
