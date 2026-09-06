import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { money } from '@/lib/data'
import type { Profile } from '@/lib/supabase'
import {
  listCustomerReferrals,
  referralDisplayName,
  referralParty,
  REFERRAL_CREDIT,
  type ReferralRow,
} from '@/lib/referrals'

export default function ReferralBoard({
  customers = [],
  compact = false,
}: {
  customers?: Profile[]
  compact?: boolean
}) {
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listCustomerReferrals().then((result) => {
      if (!live) return
      setRows(result.rows)
      setError(result.error)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const credited = rows.reduce((sum, row) => sum + Number(row.credit_each || REFERRAL_CREDIT) * 2, 0)

  return (
    <section className={`referral-board ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="v2-page-head">
          <div>
            <span className="eyebrow">Customers</span>
            <h2>Referrals</h2>
            <p>Who signed up from whom. Matching phone or email credits both portals {money(REFERRAL_CREDIT)} toward the next visit.</p>
          </div>
        </div>
      )}
      {compact && (
        <div className="referral-board-compact-head">
          <Gift size={18} />
          <div>
            <span className="eyebrow">Referrals</span>
            <h3>Who referred whom</h3>
          </div>
        </div>
      )}
      <div className="referral-board-kpis">
        <div><span>Matched referrals</span><strong>{loading ? '—' : String(rows.length)}</strong></div>
        <div><span>Credits issued</span><strong>{loading ? '—' : money(credited)}</strong></div>
        <div><span>Each side</span><strong>{money(REFERRAL_CREDIT)}</strong></div>
      </div>
      {loading && <div className="ns-empty compact">Loading referral matches…</div>}
      {!loading && error && (
        <div className="ns-empty">
          <strong>Referrals could not load</strong>
          <p>{error}</p>
        </div>
      )}
      {!loading && !error && !rows.length && (
        <div className="ns-empty">
          <Gift size={28} />
          <strong>No referrals yet</strong>
          <p>When a customer creates a portal account and names someone already on file, both people get {money(REFERRAL_CREDIT)} on their next visit. The match shows here.</p>
        </div>
      )}
      {!loading && !error && rows.length > 0 && (
            <div className="admin-card referral-board-table">
          <div className="data-table">
            <div className="data-table-head referral-head">
              <span>New customer</span>
              <span>Referred by</span>
              <span>Contact given</span>
              <span>Credit</span>
              <span>Matched</span>
            </div>
            {rows.map((row) => {
              const referred = referralParty(row, 'referred', customers)
              const referrer = referralParty(row, 'referrer', customers)
              return (
                <div key={row.id} className="data-table-row referral-row">
                  <div className="dt-cell dt-name">
                    <div>
                      <strong>{referralDisplayName(referred, 'New customer')}</strong>
                      {(referred?.email || referred?.phone) && <span>{referred?.email || referred?.phone}</span>}
                    </div>
                  </div>
                  <div className="dt-cell">
                    <strong>{referralDisplayName(referrer, 'Referrer')}</strong>
                    {(referrer?.email || referrer?.phone) && <span className="referral-sub">{referrer?.email || referrer?.phone}</span>}
                  </div>
                  <span className="dt-cell">{row.referrer_contact || '—'}</span>
                  <span className="dt-cell"><strong>{money(Number(row.credit_each || REFERRAL_CREDIT))}</strong> each</span>
                  <span className="dt-cell">{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
