import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate('/login');
  };

  return (
    <div className="auth-page nsos-cream">
      <a className="skip-to-workspace" href="#auth-form">Skip to password form</a>
      <div className="auth-card">
        <Link to="/login" className="auth-back"><ArrowLeft size={16} /> Back to sign in</Link>
        <div className="auth-brand">
          <img className="auth-brand-logo" src={`${import.meta.env.BASE_URL}ns-auto-luxe-logo.svg`} alt="North Splash Auto Luxe" />
          <div>
            <strong>NORTH SPLASH</strong>
            <small>AUTO LUXE OS</small>
          </div>
        </div>
        <h2 className="auth-title">Create a new password</h2>
        <p className="auth-sub">Use at least 8 characters. You will sign in with this password next.</p>

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>New Password</label>

            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Confirm Password</label>

            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary btn-full btn-lg"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
