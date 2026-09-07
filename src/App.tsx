import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { BRAND_LOGO } from './lib/brand';
import { isStaleChunkError, recoverStaleChunkOnce } from './lib/staleChunk';

const OsApp = lazy(() => import('@/os/OsApp'));
const Login = lazy(() => import('@/pages/Login'));
const Portal = lazy(() => import('@/pages/Portal'));
const Admin = lazy(() => import('@/pages/Admin'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const ManagerPortal = lazy(() => import('@/pages/Manager'));
const EmployeePortal = lazy(() => import('@/pages/Employee'));
const D2DPortal = lazy(() => import('@/pages/D2D'));

function Loader() {
  return (
    <div className="route-loader nsos-cream">
      <span className="eyebrow">North Splash Auto Luxe</span>
      <img className="auth-brand-logo" src={BRAND_LOGO} alt="" />
      <strong>Opening workspace</strong>
      <span>Loading this screen…</span>
    </div>
  );
}

function WorkspaceCrashScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const hookCrash = /310|Rendered more hooks|fewer hooks/i.test(message || '');
  const chunkCrash = isStaleChunkError(message);
  useEffect(() => {
    if (chunkCrash) recoverStaleChunkOnce();
  }, [chunkCrash]);
  const retry = () => {
    if (hookCrash || chunkCrash) {
      recoverStaleChunkOnce() || window.location.reload();
      return;
    }
    onRetry();
  };
  return (
    <div className="route-error-v27 nsos-cream">
      <div className="route-error-card-v27">
        <span className="eyebrow">North Splash Auto Luxe</span>
        <img className="auth-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
        <h2>This screen could not load</h2>
        <p>{hookCrash || chunkCrash ? 'Reloading to pick up the latest workspace…' : 'Try again. The rest of the company is still here.'}</p>
        {message && !chunkCrash && !hookCrash && <p className="empty-text">{message}</p>}
        <div className="route-error-actions-v27">
          <button type="button" className="btn-primary" onClick={retry}>
            Try again
          </button>
          <Link className="btn-outline" to="/os">
            Open demo OS
          </Link>
          <Link className="btn-outline" to="/login">
            Sign in
          </Link>
          <button
            type="button"
            className="btn-outline"
            onClick={() => { if (hookCrash || chunkCrash) { window.location.href = '/login'; return; } onRetry(); window.history.back(); }}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error?.message || 'This screen could not finish loading.' };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('North Splash route error', error, info);
    if (isStaleChunkError(error?.message)) recoverStaleChunkOnce();
  }
  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false, message: '' });
    }
  }
  retry = () => this.setState({ failed: false, message: '' });
  render() {
    if (this.state.failed) {
      return <WorkspaceCrashScreen message={this.state.message} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>{children}</RouteErrorBoundary>;
}

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <RoutedErrorBoundary>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Admin />} />
            <Route path="/os" element={<OsApp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/owner" element={<Admin />} />
            <Route path="/manager" element={<ManagerPortal />} />
            <Route path="/employee" element={<EmployeePortal />} />
            <Route path="/d2d" element={<D2DPortal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RoutedErrorBoundary>
    </BrowserRouter>
  );
}
