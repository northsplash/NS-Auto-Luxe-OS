import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { signIn, signUp } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { portalPath } from '@/lib/permissions';

const SITE_URL=(import.meta.env.VITE_SITE_URL||'https://www.northsplash.com').replace(/\/$/,'');

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
  const data = await signIn(email, password);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, portal_role, is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;
  if (profile?.is_active === false) throw new Error('This account has been disabled.');

  const destination = profile?.role === 'admin'
    ? '/admin'
    : portalPath(profile?.portal_role);

  navigate(destination);
} else {
        await signUp(email, password, name, phone);
        navigate('/portal');
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <img src="https://images.pexels.com/photos/27968215/pexels-photo-27968215.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" alt="Luxury vehicle" />
        <div className="auth-bg-overlay" />
      </div>

      <div className="auth-card">
        <a href={SITE_URL} className="auth-back"><ArrowLeft size={16} /> Back to site</a>

        <div className="auth-brand">
          <div className="brand-mark brand-mark-dark">NS</div>
          <div>
            <strong>NORTH SPLASH</strong>
            <small>AUTO LUXE</small>
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
          {mode === 'signin' ? 'Welcome back.' : 'Join the Luxe family.'}
        </h2>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Access your portal, track your details, and manage your membership.'
            : 'Create your account to track appointments, subscriptions, and your vehicle\'s Luxe history.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="auth-field">
                <label>Full Name</label>
                <input required placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>Phone Number</label>
                <input type="tel" placeholder="330-000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </>
          )}
          <div className="auth-field">
            <label>Email Address</label>
            <input required type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                required
                type={showPw ? 'text' : 'password'}
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

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
