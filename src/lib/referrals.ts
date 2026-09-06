import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'

export const REFERRAL_CREDIT = 20
const PENDING_KEY = 'ns_pending_referral'

export type ReferralPerson = {
  full_name?: string | null
  email?: string | null
  phone?: string | null
} | null

export type ReferralRow = {
  id: string
  referred_id: string
  referrer_id: string
  referrer_contact: string
  credit_each: number
  created_at: string
  referred?: ReferralPerson
  referrer?: ReferralPerson
}

export type ReferralApplyResult = {
  ok: boolean
  already?: boolean
  credit?: number
  referrer_name?: string
  error?: string
  message?: string
}

export function stashPendingReferral(contact: string) {
  const trimmed = contact.trim()
  try {
    if (trimmed) sessionStorage.setItem(PENDING_KEY, trimmed)
    else sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* private mode */
  }
}

export function takePendingReferral() {
  try {
    const value = sessionStorage.getItem(PENDING_KEY) || ''
    if (value) sessionStorage.removeItem(PENDING_KEY)
    return value.trim()
  } catch {
    return ''
  }
}

export function referralContactFromUser(user?: { user_metadata?: Record<string, unknown> } | null) {
  const meta = user?.user_metadata || {}
  const contact = String(meta.referrer_contact || meta.referrerContact || '').trim()
  const flagged = meta.referred === true || meta.referred === 'true' || Boolean(contact)
  return flagged ? contact : ''
}

export async function applyCustomerReferral(contact: string): Promise<ReferralApplyResult> {
  const trimmed = contact.trim()
  if (!trimmed) return { ok: false, error: 'Enter the referrer’s phone or email.' }
  const { data, error } = await supabase.rpc('apply_customer_referral', { p_contact: trimmed })
  if (error) {
    const msg = error.message || ''
    if (/schema cache|does not exist|404/i.test(msg)) {
      return { ok: false, error: 'Referral credits are not live on this workspace yet.' }
    }
    return { ok: false, error: msg }
  }
  const row = (data ?? {}) as ReferralApplyResult
  return {
    ok: Boolean(row.ok),
    already: Boolean(row.already),
    credit: Number(row.credit || REFERRAL_CREDIT),
    referrer_name: row.referrer_name,
    error: row.error,
    message: row.message,
  }
}

export async function spendAccountCredit(amount: number): Promise<{ spent: number; remaining: number }> {
  if (!(amount > 0)) return { spent: 0, remaining: 0 }
  const { data, error } = await supabase.rpc('spend_account_credit', { p_amount: amount })
  if (error) return { spent: 0, remaining: 0 }
  const row = (data ?? {}) as { spent?: number; remaining?: number }
  return { spent: Number(row.spent || 0), remaining: Number(row.remaining || 0) }
}

export function referralParty(
  row: ReferralRow,
  side: 'referred' | 'referrer',
  customers: Profile[] = [],
): ReferralPerson {
  const embedded = row[side]
  if (embedded && (embedded.full_name || embedded.email || embedded.phone)) return embedded
  const id = side === 'referred' ? row.referred_id : row.referrer_id
  const match = customers.find((c) => c.id === id)
  return match ? { full_name: match.full_name, email: match.email, phone: match.phone } : null
}

export function referralDisplayName(person: ReferralPerson, fallback = 'Customer') {
  return (person?.full_name || person?.email || person?.phone || fallback).trim() || fallback
}

export async function listCustomerReferrals(): Promise<{ rows: ReferralRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('customer_referrals')
    .select(
      'id, referred_id, referrer_id, referrer_contact, credit_each, created_at, referred:profiles!customer_referrals_referred_id_fkey(full_name, email, phone), referrer:profiles!customer_referrals_referrer_id_fkey(full_name, email, phone)',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    const fallback = await supabase
      .from('customer_referrals')
      .select('id, referred_id, referrer_id, referrer_contact, credit_each, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (fallback.error) {
      const msg = fallback.error.message || ''
      if (/schema cache|does not exist|404/i.test(msg)) {
        return { rows: [], error: 'Referral records are not live on this workspace yet. Apply the latest Supabase migration.' }
      }
      return { rows: [], error: msg }
    }
    return { rows: (fallback.data || []) as ReferralRow[], error: null }
  }
  return { rows: (data || []) as ReferralRow[], error: null }
}
