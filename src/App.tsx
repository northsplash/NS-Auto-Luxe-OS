import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const Login=lazy(()=>import('@/pages/Login')); const Portal=lazy(()=>import('@/pages/Portal')); const Admin=lazy(()=>import('@/pages/Admin'));
const ForgotPassword=lazy(()=>import('@/pages/ForgotPassword')); const ResetPassword=lazy(()=>import('@/pages/ResetPassword'));
const ManagerPortal=lazy(()=>import('@/pages/Manager')); const EmployeePortal=lazy(()=>import('@/pages/Employee')); const D2DPortal=lazy(()=>import('@/pages/D2D'));
function Loader(){return <div className="route-loader"><div className="route-loader-mark">NS</div><div><strong>North Splash OS</strong><span>Opening workspace…</span></div></div>}
class RouteErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('North Splash route error',error,info)}
  render(){
    if(this.state.failed)return <div style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#f7f3ee',color:'#1d1712'}}><div style={{maxWidth:520,width:'100%',background:'#fff',border:'1px solid #decdbd',borderRadius:18,padding:28,boxShadow:'0 18px 50px rgba(39,27,18,.10)'}}><div style={{fontSize:12,fontWeight:800,letterSpacing:'.14em',color:'#9d7651'}}>NORTH SPLASH OS</div><h2 style={{margin:'8px 0 8px'}}>This workspace hit an error</h2><p style={{margin:'0 0 18px',color:'#6f6258'}}>Instead of a blank screen, reload the workspace. If it repeats, open the browser console and send the first red error.</p><button onClick={()=>window.location.reload()} style={{border:0,borderRadius:10,padding:'11px 16px',background:'#17120e',color:'#fff',fontWeight:800,cursor:'pointer'}}>Reload Workspace</button></div></div>;
    return this.props.children;
  }
}
export default function App(){return <RouteErrorBoundary><BrowserRouter><Suspense fallback={<Loader/>}><Routes>
<Route path="/" element={<Navigate to="/login" replace/>}/><Route path="/login" element={<Login/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/portal" element={<Portal/>}/><Route path="/admin" element={<Admin/>}/><Route path="/manager" element={<ManagerPortal/>}/><Route path="/employee" element={<EmployeePortal/>}/><Route path="/d2d" element={<D2DPortal/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></Suspense></BrowserRouter></RouteErrorBoundary>}
