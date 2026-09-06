import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthShell from '@/components/AuthShell';
import { BRAND_LOGO } from '@/lib/brand';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.northsplash.com').replace(/\/$/, '');

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://northsplash.com/reset-password',
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the password reset link.');
    }

    setLoading(false);
  };

  return (
    <AuthShell skipLabel="Skip to reset form" headline="Reset the password for any portal — Owner, D2D, Detail, Manager, or customer.">
      <a href={SITE_URL} className="auth-back"><ArrowLeft size={16} /> Back to site</a>
      <div className="auth-brand">
        <img className="auth-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
        <div>
          <strong>NORTH SPLASH</strong>
          <small>AUTO LUXE OS</small>
        </div>
      </div>
      <h2 className="auth-title">Forgot your password?</h2>
      <p className="auth-sub">Enter the email on your North Splash login. We will send a reset link.</p>

      <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>Email Address</label>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <button type="submit" className="btn-primary btn-full btn-lg" disabled={loading} aria-busy={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
