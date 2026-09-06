import { supabase, type Appointment, type ClientPhoto, type ClientPhotoKind, type JobMedia, type Profile } from '@/lib/supabase';

export const CLIENT_PHOTO_KINDS: Array<{ id: ClientPhotoKind; label: string; hint: string }> = [
  { id: 'before', label: 'Before', hint: 'Vehicle as it arrived' },
  { id: 'after', label: 'After', hint: 'Finished work' },
  { id: 'damage', label: 'Condition', hint: 'Existing damage or notes' },
  { id: 'portfolio', label: 'Portfolio', hint: 'OK to show in marketing' },
];

const LOCAL_KEY = 'ns-client-photos-v1';
const MAX_BYTES = 12 * 1024 * 1024;

export type PhotoCustomer = {
  key: string;
  profileId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
};

export function photoCustomers(customers: Profile[], appointments: Appointment[]): PhotoCustomer[] {
  const list: PhotoCustomer[] = customers.map(c => ({
    key: c.id,
    profileId: c.id,
    name: c.full_name || c.email || 'Customer',
    email: c.email,
    phone: c.phone,
    vehicle: c.vehicle_info,
  }));
  const seen = new Set(list.map(c => (c.email || '').toLowerCase()).filter(Boolean));
  appointments.forEach(a => {
    if (a.user_id) return;
    const email = (a.customer_email || '').toLowerCase();
    const key = email ? `guest:${email}` : `guest-apt:${a.id}`;
    if (email && seen.has(email)) return;
    if (email) seen.add(email);
    if (list.some(c => c.key === key)) return;
    list.push({
      key,
      profileId: null,
      name: a.customer_name || a.customer_email || 'Guest customer',
      email: a.customer_email || null,
      phone: a.customer_phone || null,
      vehicle: a.vehicle_info,
    });
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function jobsForCustomer(customer: PhotoCustomer | null, appointments: Appointment[]) {
  if (!customer) return [];
  return appointments.filter(a => {
    if (customer.profileId && a.user_id === customer.profileId) return true;
    if (customer.email && a.customer_email && a.customer_email.toLowerCase() === customer.email.toLowerCase()) return true;
    return false;
  }).sort((a, b) => +new Date(b.scheduled_at || b.created_at) - +new Date(a.scheduled_at || a.created_at));
}

function readLocal(): ClientPhoto[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: ClientPhoto[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 400)));
}

function extOf(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName.replace(/[^a-z0-9]/g, '') || 'jpg';
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('heic')) return 'heic';
  return 'jpg';
}

function fromJobMedia(m: JobMedia, appointment: Appointment): ClientPhoto {
  const kind = (['before', 'after', 'damage'].includes(m.media_type) ? m.media_type : 'portfolio') as ClientPhotoKind;
  return {
    id: `job:${m.id}`,
    customer_id: appointment.user_id,
    customer_name: appointment.customer_name || null,
    customer_email: appointment.customer_email || null,
    appointment_id: appointment.id,
    employee_id: m.employee_id,
    kind,
    file_url: m.file_url,
    storage_path: m.storage_path || null,
    file_name: m.file_name || null,
    mime_type: m.mime_type || null,
    caption: m.caption,
    vehicle_info: appointment.vehicle_info,
    featured: false,
    source: 'job',
    created_at: m.created_at,
  };
}

function matchesCustomer(row: ClientPhoto, customer: PhotoCustomer | null) {
  if (!customer) return true;
  if (customer.profileId && row.customer_id === customer.profileId) return true;
  if (customer.email && row.customer_email && row.customer_email.toLowerCase() === customer.email.toLowerCase()) return true;
  return false;
}

export async function listClientPhotos(customer: PhotoCustomer | null, appointments: Appointment[]): Promise<ClientPhoto[]> {
  const jobs = jobsForCustomer(customer, appointments);
  const jobIds = jobs.map(j => j.id);
  const queries = [];
  if (customer?.profileId) {
    queries.push(supabase.from('client_photos').select('*').eq('customer_id', customer.profileId).order('created_at', { ascending: false }));
  }
  if (customer?.email) {
    queries.push(supabase.from('client_photos').select('*').ilike('customer_email', customer.email).order('created_at', { ascending: false }));
  }
  if (!customer) {
    queries.push(supabase.from('client_photos').select('*').order('created_at', { ascending: false }).limit(400));
  }
  const [tableRows, media] = await Promise.all([
    queries.length ? Promise.all(queries).then(results => results.flatMap(r => (r.data || []) as ClientPhoto[])) : Promise.resolve([] as ClientPhoto[]),
    jobIds.length
      ? supabase.from('job_media').select('*').in('appointment_id', jobIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as JobMedia[] }),
  ]);
  const fromTable = tableRows.map(r => ({ ...r, source: r.source || 'library' }));
  const fromJobs = ((media.data || []) as JobMedia[]).flatMap(m => {
    const apt = jobs.find(j => j.id === m.appointment_id);
    return apt ? [fromJobMedia(m, apt)] : [];
  });
  const local = readLocal().filter(r => matchesCustomer(r, customer));
  const merged: ClientPhoto[] = [];
  const seen = new Set<string>();
  [...fromTable, ...fromJobs, ...local].forEach(row => {
    const key = row.file_url || row.id;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });
  return merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export type ImportPhotoInput = {
  customer: PhotoCustomer;
  appointmentId?: string | null;
  kind: ClientPhotoKind;
  caption?: string;
  vehicleInfo?: string | null;
  employeeId?: string | null;
  featured?: boolean;
};

async function uploadFile(file: File, customer: PhotoCustomer, kind: ClientPhotoKind) {
  const folder = customer.profileId || customer.email?.replace(/[^a-z0-9]/gi, '_') || 'guest';
  const path = `clients/${folder}/${kind}/${Date.now()}-${crypto.randomUUID()}.${extOf(file)}`;
  const up = await supabase.storage.from('job-media').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const pub = supabase.storage.from('job-media').getPublicUrl(path);
  return { path, url: pub.data.publicUrl };
}

export async function importClientPhotoFiles(files: File[], input: ImportPhotoInput) {
  const errors: string[] = [];
  const saved: ClientPhoto[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|gif)$/i.test(file.name)) {
      errors.push(`${file.name}: not an image`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name}: over 12 MB`);
      continue;
    }
    try {
      const uploaded = await uploadFile(file, input.customer, input.kind);
      const row: Omit<ClientPhoto, 'id' | 'created_at'> & { created_at?: string } = {
        customer_id: input.customer.profileId,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        appointment_id: input.appointmentId || null,
        employee_id: input.employeeId || null,
        kind: input.kind,
        file_url: uploaded.url,
        storage_path: uploaded.path,
        file_name: file.name,
        mime_type: file.type || 'image/jpeg',
        caption: input.caption || null,
        vehicle_info: input.vehicleInfo || input.customer.vehicle,
        featured: Boolean(input.featured),
        source: 'import',
      };
      const inserted = await supabase.from('client_photos').insert(row).select().single();
      let photo: ClientPhoto;
      if (inserted.data) {
        photo = inserted.data as ClientPhoto;
      } else {
        photo = {
          ...row,
          id: `local-${crypto.randomUUID()}`,
          created_at: new Date().toISOString(),
        } as ClientPhoto;
        writeLocal([photo, ...readLocal()]);
        if (inserted.error) errors.push(`${file.name}: saved locally (${inserted.error.message})`);
      }
      if (input.appointmentId) {
        await supabase.from('job_media').insert({
          appointment_id: input.appointmentId,
          employee_id: input.employeeId || null,
          media_type: input.kind === 'portfolio' ? 'after' : input.kind,
          file_url: uploaded.url,
          storage_path: uploaded.path,
          file_name: file.name,
          mime_type: file.type || 'image/jpeg',
          caption: input.caption || null,
        });
      }
      saved.push(photo);
    } catch (err: any) {
      errors.push(`${file.name}: ${err?.message || 'upload failed'}`);
    }
  }
  return { saved, errors };
}

export async function importClientPhotoUrl(url: string, input: ImportPhotoInput) {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('Paste a full http(s) image URL.');
  const row = {
    customer_id: input.customer.profileId,
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    appointment_id: input.appointmentId || null,
    employee_id: input.employeeId || null,
    kind: input.kind,
    file_url: trimmed,
    storage_path: null,
    file_name: trimmed.split('/').pop()?.split('?')[0] || 'imported-photo',
    mime_type: 'image/*',
    caption: input.caption || null,
    vehicle_info: input.vehicleInfo || input.customer.vehicle,
    featured: Boolean(input.featured),
    source: 'url',
  };
  const inserted = await supabase.from('client_photos').insert(row).select().single();
  if (inserted.data) return inserted.data as ClientPhoto;
  const local: ClientPhoto = { ...row, id: `local-${crypto.randomUUID()}`, created_at: new Date().toISOString() };
  writeLocal([local, ...readLocal()]);
  return local;
}

export async function setClientPhotoFeatured(photo: ClientPhoto, featured: boolean) {
  if (!photo.id.startsWith('local-') && !photo.id.startsWith('job:')) {
    const { error } = await supabase.from('client_photos').update({ featured }).eq('id', photo.id);
    if (!error) return;
  }
  writeLocal(readLocal().map(p => p.id === photo.id ? { ...p, featured } : p));
}

export async function removeClientPhoto(photo: ClientPhoto) {
  if (photo.storage_path && !photo.id.startsWith('job:')) {
    await supabase.storage.from('job-media').remove([photo.storage_path]).catch(() => undefined);
  }
  if (photo.id.startsWith('job:')) {
    await supabase.from('job_media').delete().eq('id', photo.id.slice(4));
  } else if (!photo.id.startsWith('local-')) {
    await supabase.from('client_photos').delete().eq('id', photo.id);
  }
  writeLocal(readLocal().filter(p => p.id !== photo.id && p.file_url !== photo.file_url));
}
