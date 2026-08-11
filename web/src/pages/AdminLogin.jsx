import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single();
        if (profile && profile.role === 'admin') {
          navigate('/admin', { replace: true });
        }
      }
    }
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!email || !password) {
      setStatus({ type: 'error', message: 'Please enter both email and password.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        setStatus({ type: 'error', message: 'Access denied. Admin accounts can only log in through the web portal. Customers and vendors should use the PalengkeHub app.' });
        setLoading(false);
        return;
      }

      sessionStorage.setItem('palengkehub_admin_name', profile.full_name || 'Admin');
      setStatus({ type: 'success', message: `Welcome, ${profile.full_name || 'Admin'}!` });
      setTimeout(() => navigate('/admin', { replace: true }), 600);
    } catch (err) {
      const msg = err.message.toLowerCase();
      let userMsg = 'Login failed. Please try again.';
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) userMsg = 'Wrong email or password.';
      else if (msg.includes('email not confirmed')) userMsg = 'Please verify your email first.';
      else if (msg.includes('rate limit')) userMsg = 'Too many attempts. Please wait.';
      setStatus({ type: 'error', message: userMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="page-header admin-login-header">
        <div className="wrap">
          <span className="page-kicker">Admin Portal</span>
          <h1>PalengkeHub Admin Login</h1>
          <p>Sign in to manage the Lipa City Public Market Management Information System</p>
        </div>
      </section>
      <section className="admin-login-content">
        <div className="admin-login-card">
          <div className="admin-login-brand">
            <img src="/palengkehublogo.jpg" alt="PalengkeHub Admin" className="admin-login-logo" />
            <div className="admin-role-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
              Admin Access
            </div>
          </div>
          <div className="admin-login-title">
            <h2>Welcome, Admin</h2>
            <p>Sign in to manage vendors, stalls, orders, and reports.</p>
          </div>
          <form onSubmit={handleSubmit} method="post" action="#">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@palengkehub.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="admin-password-row">
                <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
                <button type="button" className="admin-toggle-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="admin-options-row">
              <div className="admin-forgot"><a href="#">Forgot password?</a></div>
            </div>
            {status.message && (
              <div className={`form-status form-status-${status.type}`}>{status.message}</div>
            )}
            <button type="submit" className="btn-primary admin-login-btn" disabled={loading}>
              {loading && <span className="admin-spinner" style={{ marginRight: '8px' }} />}
              {loading ? 'Signing in...' : 'Sign In as Admin'}
            </button>
          </form>
          <div className="admin-login-info">
            <div className="admin-login-info-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <p><strong>Restricted Access:</strong> This portal is for <strong>administrators only</strong>. Customers and vendors should use the PalengkeHub mobile app to log in.</p>
          </div>
          <div className="admin-login-back">
            <a href="/">← Back to Home</a>
          </div>
        </div>
      </section>
    </>
  );
}