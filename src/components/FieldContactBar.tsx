import { useState } from 'react';
import { Copy, MessageCircle, Phone } from 'lucide-react';
import { copyText, smsHref, telHref } from '@/lib/fieldOps';
import { firstWord } from '@/lib/data';

type Props = {
  phone?: string | null;
  address?: string | null;
  name?: string | null;
};

export default function FieldContactBar({ phone, address, name }: Props) {
  const [copied, setCopied] = useState('');
  const tel = telHref(phone);
  const sms = smsHref(phone, name ? `Hi ${firstWord(name, 'there')}, this is North Splash Auto Luxe.` : undefined);
  const copy = async (label: string, value?: string | null) => {
    const ok = await copyText(String(value || ''));
    setCopied(ok ? label : '');
    if (ok) window.setTimeout(() => setCopied(''), 1600);
  };
  if (!tel && !sms && !address && !phone) return null;
  return (
    <div className="field-contact-bar">
      {tel && <a className="btn-outline" href={tel}><Phone size={14} /> Call</a>}
      {sms && <a className="btn-outline" href={sms}><MessageCircle size={14} /> Text</a>}
      {address && (
        <button type="button" className="btn-outline" onClick={() => void copy('address', address)}>
          <Copy size={14} /> {copied === 'address' ? 'Copied' : 'Copy address'}
        </button>
      )}
      {phone && !address && (
        <button type="button" className="btn-outline" onClick={() => void copy('phone', phone)}>
          <Copy size={14} /> {copied === 'phone' ? 'Copied' : 'Copy phone'}
        </button>
      )}
    </div>
  );
}
