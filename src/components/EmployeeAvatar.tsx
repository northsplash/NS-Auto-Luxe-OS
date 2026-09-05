import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/supabase';

type Props = {
  employee?: Pick<Employee,'id'|'name'|'avatar_url'|'user_id'> | null;
  profileId?: string | null;
  name?: string;
  avatarUrl?: string | null;
  size?: 'sm'|'md'|'lg'|'xl';
  editable?: boolean;
  className?: string;
  onUploaded?: (url:string)=>void;
};

export default function EmployeeAvatar({employee,profileId,name,avatarUrl,size='md',editable=false,className='',onUploaded}:Props){
  const input=useRef<HTMLInputElement|null>(null);
  const [busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(false);
  const [localUrl,setLocalUrl]=useState<string|null>(null);
  const displayName=employee?.name||name||'North Splash';
  const url=localUrl??avatarUrl??employee?.avatar_url??null;
  useEffect(()=>{setFailed(false);setLocalUrl(null)},[avatarUrl,employee?.avatar_url]);
  const initials=displayName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'NS';
  const upload=async(file?:File)=>{
    if(!file||(!employee?.id&&!profileId))return;
    if(!file.type.startsWith('image/'))return alert('Choose an image file.');
    if(file.size>8*1024*1024)return alert('Profile photos must be under 8 MB.');
    setBusy(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('You must be signed in.');
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const subjectId=employee?.id||profileId||user.id;
      const path=`${user.id}/${subjectId}/${Date.now()}.${ext}`;
      const up=await supabase.storage.from('profile-avatars').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
      if(up.error)throw up.error;
      const publicUrl=supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
      if(employee?.id){
        const empUpdate=await supabase.from('employees').update({avatar_url:publicUrl}).eq('id',employee.id);
        if(empUpdate.error)throw empUpdate.error;
      }
      const linkedProfileId=profileId||employee?.user_id||null;
      if(linkedProfileId){const profileUpdate=await supabase.from('profiles').update({avatar_url:publicUrl}).eq('id',linkedProfileId);if(profileUpdate.error)throw profileUpdate.error;}
      setFailed(false);setLocalUrl(publicUrl);onUploaded?.(publicUrl);
    }catch(err:any){alert(err?.message||'Unable to upload profile photo.')}finally{setBusy(false);if(input.current)input.current.value='';}
  };
  return <span className={`employee-photo employee-photo-${size} ${editable?'is-editable':''} ${className}`} title={editable?'Change profile photo':displayName} role={editable?'button':undefined} tabIndex={editable?0:undefined} aria-label={editable?`Change ${displayName} profile photo`:undefined} onClick={editable?()=>input.current?.click():undefined} onKeyDown={editable?(e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.current?.click()}}):undefined}>
    {url&&!failed?<img src={url} alt={`${displayName} profile`} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<span aria-label={`${displayName} initials`}>{initials}</span>}
    {editable&&<><input ref={input} type="file" accept="image/*" hidden onChange={e=>upload(e.target.files?.[0])}/><i className="employee-photo-edit">{busy?<span className="photo-spinner"/>:<Camera size={12}/>}</i></>}
  </span>;
}
