import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const Login=lazy(()=>import('@/pages/Login')); const Portal=lazy(()=>import('@/pages/Portal')); const Admin=lazy(()=>import('@/pages/Admin'));
const ForgotPassword=lazy(()=>import('@/pages/ForgotPassword')); const ResetPassword=lazy(()=>import('@/pages/ResetPassword'));
const ManagerPortal=lazy(()=>import('@/pages/Manager')); const EmployeePortal=lazy(()=>import('@/pages/Employee')); const D2DPortal=lazy(()=>import('@/pages/D2D'));
function Loader(){return <div className="route-loader"><div className="route-loader-mark">NS</div><div><strong>North Splash OS</strong><span>Opening workspace…</span></div></div>}
export default function App(){return <BrowserRouter><Suspense fallback={<Loader/>}><Routes>
<Route path="/" element={<Navigate to="/login" replace/>}/><Route path="/login" element={<Login/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/portal" element={<Portal/>}/><Route path="/admin" element={<Admin/>}/><Route path="/manager" element={<ManagerPortal/>}/><Route path="/employee" element={<EmployeePortal/>}/><Route path="/d2d" element={<D2DPortal/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></Suspense></BrowserRouter>}
