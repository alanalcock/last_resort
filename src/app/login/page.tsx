'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, User, Lock, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  // Tab selector state: 'employee' or 'admin'
  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>('employee');
  
  // Employee Form State
  const [employeeName, setEmployeeName] = useState('');
  const [employeeTrn, setEmployeeTrn] = useState('');
  
  // Admin Form State
  const [adminStep, setAdminStep] = useState<'credentials' | 'set_password'>('credentials');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminStaffId, setAdminStaffId] = useState<number | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  
  // Loading and Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'employee') {
        const response = await fetch('/api/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'employee_verify',
            name: employeeName.trim(),
            trn: employeeTrn.trim()
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Verification failed. Please check your name and TRN.');
          setIsLoading(false);
          return;
        }

        router.push('/portal');
      } else {
        // ADMIN FLOW
        if (adminStep === 'credentials') {
          const response = await fetch('/api/portal/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'admin_verify_step1',
              username: adminUsername.trim(),
              password: adminPassword 
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || 'Invalid credentials. Please verify and try again.');
            setIsLoading(false);
            return;
          }

          if (result.needsNewPassword) {
            setAdminStaffId(result.staffId || null);
            setAdminStep('set_password');
            setIsLoading(false);
          } else {
            router.push('/');
          }
        } else {
          // ADMIN SET PASSWORD STEP
          if (adminNewPassword !== adminConfirmPassword) {
            setError('Passwords do not match. Please verify.');
            setIsLoading(false);
            return;
          }

          if (adminNewPassword.length < 4) {
            setError('Password must be at least 4 characters long.');
            setIsLoading(false);
            return;
          }

          const response = await fetch('/api/portal/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'admin_set_password',
              username: adminUsername.trim(),
              newPassword: adminNewPassword,
              staffId: adminStaffId
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || 'Failed to save password.');
            setIsLoading(false);
            return;
          }

          router.push('/');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('A connection error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen md:h-screen w-full bg-black text-slate-100 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row items-stretch">
      {/* Left Column / Full Background Image Area */}
      <div className="relative hidden md:flex w-full md:w-3/5 lg:w-2/3 md:h-full bg-black overflow-hidden flex-col justify-between p-6 md:p-16 shrink-0 z-0">
        <div 
          className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-90 mix-blend-luminosity filter saturate-50 transition-all duration-1000"
          style={{ backgroundImage: `url('/login-bg.jpg')` }}
        />
        {/* Mysterious Dark Overlay & Side-gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/75 md:bg-gradient-to-r md:from-transparent md:via-black/20 md:to-black/90" />
        
        {/* Left Side branding (Hidden on Mobile) */}
        <div className="relative z-10 hidden md:flex flex-col h-full justify-end">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
            Last Resort Detective Agency &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Right Column / Login Form Pane */}
      <div className="relative z-10 w-full md:w-2/5 lg:w-1/3 min-h-screen md:h-full bg-white backdrop-blur-2xl border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-center px-6 sm:px-12 py-12 shrink-0 shadow-2xl overflow-y-auto text-slate-900">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile Branding (Only visible on mobile) */}
          <div className="text-center mb-6 md:hidden">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg mb-3 text-slate-900">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">
              Last Resort
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Detective Agency Limited
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
              Portal Access
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {activeTab === 'employee' 
                ? 'Access your invoice and payslip logs using your verification credentials.'
                : adminStep === 'credentials'
                  ? 'Secure system administration dashboard portal entry.'
                  : 'Establish your custom administrator credentials password.'}
            </p>
          </div>

          {/* Premium Tab Selector (Hidden during Admin password reset) */}
          {adminStep === 'credentials' && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('employee');
                  setError(null);
                }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  activeTab === 'employee'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Employee Access
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setError(null);
                }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Admin Secure
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 flex items-start gap-2.5 animate-in shake duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'employee' ? (
              // EMPLOYEE FORM (NO AUTH - JUST NAME & TRN)
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Name Field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                    Username
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Larry Page"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* TRN Field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                    TRN Number
                  </label>
                  <div className="relative group">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456789"
                      value={employeeTrn}
                      onChange={(e) => setEmployeeTrn(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-mono font-medium tracking-wider"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // ADMIN FORM
              adminStep === 'credentials' ? (
                // ADMIN CREDENTIALS STEP
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Username
                    </label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input
                        type="text"
                        required
                        placeholder="Username"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Secure Password
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input
                        type="password"
                        required
                        placeholder="Enter secure password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // ADMIN RESET/CHOOSE PASSWORD STEP
                <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
                  <div className="p-3.5 bg-amber-50 border border-amber-250/60 rounded-xl text-xs text-amber-900 leading-relaxed font-semibold">
                    🔑 You are logging in with the default password. For security, please choose a new custom administrator password below.
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      New Admin Password
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input
                        type="password"
                        required
                        placeholder="Choose a custom password"
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Confirm Admin Password
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input
                        type="password"
                        required
                        placeholder="Confirm your password"
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAdminStep('credentials');
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-950 cursor-pointer block mt-1 hover:underline bg-transparent border-0 p-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Go back</span>
                  </button>
                </div>
              )
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-950 hover:bg-black text-white hover:text-white font-bold rounded-lg text-sm transition-all duration-300 shadow-lg shadow-slate-950/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-white" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>
                    {activeTab === 'employee' 
                      ? 'Verify & Access Invoices' 
                      : adminStep === 'credentials'
                        ? 'Sign In As Administrator'
                        : 'Set Password & Log In'}
                  </span>
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>

          </form>

          {/* Secure Node Indicator */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
              Secure Auth Node
            </p>
          </div>

          {/* Mobile Footer */}
          <div className="mt-4 text-center md:hidden">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
              Last Resort Detective Agency &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
