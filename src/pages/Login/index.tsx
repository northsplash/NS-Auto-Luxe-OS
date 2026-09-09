import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { signIn, signUp, trackPageView } from '@/lib/auth';
import { MARKET } from '@/lib/market';
import { supabase } from '@/lib/supabase';
import { portalPath } from '@/lib/permissions';
import { BRAND_LOGO } from '@/lib/brand';
import AuthShell from '@/components/AuthShell';
import { applyCustomerReferral, stashPendingReferral } from '@/lib/referrals';

const SITE_URL=(import.meta.env.VITE_SITE_URL||'https://www.northsplash.com').replace(/\/$/,'');

export default function Login() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const notice = typeof (location.state as { notice?: string } | null)?.notice === 'string'
    ? (location.state as { notice: string }).notice
    : '';
  const [mode, setMode] = useState<'signin' | 'signup'>(() => searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wasReferred, setWasReferred] = useState(false);
  const [referrerContact, setReferrerContact] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView('/login').catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('@/pages/Admin');
      void import('@/pages/Manager');
      void import('@/pages/Employee');
      void import('@/pages/D2D');
      void import('@/pages/Portal');
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
  const data = await signIn(email, password);
  await supabase.functions.invoke('claim-customer-history').catch(() => null);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, portal_role, is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;
  if (profile?.is_active === false) throw new Error('This account has been disabled.');

  const destination = profile?.portal_role === 'owner'
    ? '/owner'
    : profile?.role === 'admin' ? '/admin' : portalPath(profile?.portal_role);

  navigate(destination);
} else {
        const contact = wasReferred ? referrerContact.trim() : '';
        if (wasReferred && !contact) {
          throw new Error('Enter the phone or email of the person who referred you.');
        }
        const created = await signUp(email, password, name, phone, contact);
        if (contact) stashPendingReferral(contact);
        if (created.session) {
          await supabase.functions.invoke('claim-customer-history').catch(() => null);
          if (contact) await applyCustomerReferral(contact).catch(() => null);
        }
        navigate('/portal');
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell skipLabel="Skip to sign in">
      <a href={SITE_URL} className="auth-back"><ArrowLeft size={16} /> Back to site</a>
      <div className="auth-brand">
        <img className="auth-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
        <div>
          <strong>NORTH SPLASH</strong>
          <small>AUTO LUXE OS</small>
        </div>
      </div>

      <div className="auth-tabs">
        <button className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('signin'); setError(''); }}>
          Sign In
        </button>
        <button className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('signup'); setError(''); }}>
          Create Account
        </button>
      </div>

      <h2 className="auth-title">
        {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
      </h2>
      <p className="auth-sub">
        {mode === 'signin'
          ? 'Sign in to Owner, D2D, Detail, Manager, or the customer portal.'
          : 'Customer accounts keep appointments, membership, and visit history in one place.'}
      </p>

      <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            <div className="auth-field">
              <label>Full Name</label>
              <input required autoComplete="name" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Phone Number</label>
              <input type="tel" autoComplete="tel" placeholder={MARKET.phonePlaceholder} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="auth-referral">
              <label className="auth-referral-toggle">
                <input
                  type="checkbox"
                  checked={wasReferred}
                  onChange={e => setWasReferred(e.target.checked)}
                />
                Were you referred by someone at North Splash?
              </label>
              {wasReferred && (
                <div className="auth-field">
                  <label>Their phone or email</label>
                  <input
                    required
                    autoComplete="off"
                    placeholder={`friend@email.com or ${MARKET.phonePlaceholder}`}
                    value={referrerContact}
                    onChange={e => setReferrerContact(e.target.value)}
                  />
                  <small>If they already have a customer account, you both get $20 toward the next visit.</small>
                </div>
              )}
            </div>
          </>
        )}
        <div className="auth-field">
          <label>Email Address</label>
          <input required type="email" autoComplete="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>Password</label>
          <div className="pw-wrap">
            <input
              required
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Create a password' : 'Your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {mode === 'signin' && (
          <Link to="/forgot-password">Forgot password?</Link>
        )}

        {notice && <div className="auth-notice">{notice}</div>}
        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn-primary btn-full btn-lg" disabled={loading} aria-busy={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
          {mode === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
      <p className="auth-switch"><Link to="/os">Open North Splash OS</Link></p>
    </AuthShell>
  );
}
