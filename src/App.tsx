import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isDemoMode } from '@/lib/supabase';
const Login=lazy(()=>import('@/pages/Login')); const Portal=lazy(()=>import('@/pages/Portal')); const Admin=lazy(()=>import('@/pages/Admin'));
const ForgotPassword=lazy(()=>import('@/pages/ForgotPassword')); const ResetPassword=lazy(()=>import('@/pages/ResetPassword'));
const ManagerPortal=lazy(()=>import('@/pages/Manager')); const EmployeePortal=lazy(()=>import('@/pages/Employee')); const D2DPortal=lazy(()=>import('@/pages/D2D'));
const OsApp=lazy(()=>import('@/os/OsApp'));
function Loader(){return <div className="route-loader"><div className="route-loader-mark">NS</div><div><strong>North Splash OS</strong><span>Opening workspace…</span></div></div>}
class RouteErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('North Splash route error',error,info)}
  render(){
    if(this.state.failed)return <div className="route-error-v27"><div className="route-error-card-v27"><div className="route-error-mark-v27">NS</div><span className="eyebrow">NORTH SPLASH OS</span><h2>This workspace hit an error</h2><p>The OS caught the error instead of showing a blank screen. Reload the workspace. If it repeats, send the first red browser-console error.</p><div className="route-error-actions-v27"><button onClick={()=>window.location.reload()} className="btn-primary">Reload Workspace</button><button onClick={()=>{this.setState({failed:false});window.history.back()}} className="btn-outline">Go Back</button></div></div></div>;
    return this.props.children;
  }
}
export default function App(){return <RouteErrorBoundary><BrowserRouter><Suspense fallback={<Loader/>}><Routes>
<Route path="/" element={<Navigate to={isDemoMode ? '/os' : '/login'} replace/>}/>
<Route path="/os" element={<OsApp/>}/>
<Route path="/login" element={<Login/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/portal" element={<Portal/>}/><Route path="/admin" element={<Admin/>}/><Route path="/owner" element={<Admin/>}/><Route path="/manager" element={<ManagerPortal/>}/><Route path="/employee" element={<EmployeePortal/>}/><Route path="/d2d" element={<D2DPortal/>}/><Route path="*" element={<Navigate to={isDemoMode ? '/os' : '/login'} replace/>}/></Routes></Suspense></BrowserRouter></RouteErrorBoundary>}
