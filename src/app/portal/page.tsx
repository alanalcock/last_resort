'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, FileText, Download, Calendar, Loader2, Eye, X } from 'lucide-react';
import { handleDownloadPDF, generatePDFBlobUrl } from '@/lib/pdfGenerator';
import { formatDayFirstDate } from '@/lib/payroll/utils';

type UserProfile = {
  id: number;
  name: string;
  employee_id: string;
};

type PayslipLog = {
  id: number;
  date_sent: string;
  payslip_data: any;
};

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [payslips, setPayslips] = useState<PayslipLog[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPayslips, setIsLoadingPayslips] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [previewPeriod, setPreviewPeriod] = useState<string>('');

  const formatPayslipDate = (value: string | undefined) => (value ? formatDayFirstDate(value) : 'Unknown Date');

  // Load profile & payslips on load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/portal/me');
        if (!response.ok) {
          // If unauthorized, send to login
          router.push('/login');
          return;
        }

        const data = await response.json();
        setUser(data.user);
        setIsLoadingProfile(false);
        
        // Fetch payslips after profile loaded successfully
        fetchPayslips();
      } catch (err) {
        console.error('Error fetching profile:', err);
        router.push('/login');
      }
    };

    const fetchPayslips = async () => {
      try {
        const response = await fetch('/api/portal/payslips');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setPayslips(data);
          }
        }
      } catch (err) {
        console.error('Error fetching payslips:', err);
      } finally {
        setIsLoadingPayslips(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/portal/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  const onDownload = async (payslip: PayslipLog) => {
    if (!user) return;
    
    // Construct staff object from active session details
    const staffObj = {
      id: user.id,
      name: user.name,
      employee_id: user.employee_id,
      trn: payslip.payslip_data?.trn || '',
    };

    await handleDownloadPDF(staffObj, payslip.payslip_data);
  };

  const onViewDetails = async (payslip: PayslipLog) => {
    if (!user) return;
    
    const staffObj = {
      id: user.id,
      name: user.name,
      employee_id: user.employee_id,
      trn: payslip.payslip_data?.trn || '',
    };

    try {
      const url = await generatePDFBlobUrl(staffObj, payslip.payslip_data);
      setActivePreviewUrl(url);
      setPreviewPeriod(formatPayslipDate(payslip.date_sent || payslip.payslip_data?.payDate));
    } catch (err) {
      console.error('Error viewing PDF:', err);
      alert('Failed to generate preview. Please download the PDF instead.');
    }
  };

  const closePreview = () => {
    if (activePreviewUrl) {
      URL.revokeObjectURL(activePreviewUrl);
    }
    setActivePreviewUrl(null);
    setPreviewPeriod('');
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-slate-900">
        <Loader2 className="w-10 h-10 text-slate-900 animate-spin mb-4" />
        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
          Verifying Portal Session...
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-900 flex flex-col overflow-x-hidden">
      {/* Background Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-4 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-black uppercase tracking-widest text-slate-900 leading-none">
                Last Resort
              </h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                Detective Agency Limited
              </p>
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-4">
            <div className="sm:hidden min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">#{user?.employee_id}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-full py-1.5 pl-3.5 pr-4">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">{user?.name}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-250 rounded-full px-2 py-0.5 ml-1">
                #{user?.employee_id}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
            >
              {isLoggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col">
        {/* Welcome Section */}
        <div className="mb-8 p-6 sm:p-8 bg-slate-50 border border-slate-200/60 rounded-xl">
          <div>
            <div className="mb-2 text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Welcome back</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{user?.name}</h2>
          </div>
        </div>

        {/* Payslips List Section */}
        <div className="flex-1 bg-white border border-slate-200/60 rounded-xl p-6 sm:p-8 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">All Payslips</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
              {payslips.length} Available
            </span>
          </div>

          {isLoadingPayslips ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-3" />
              <p className="text-xs font-semibold tracking-wider uppercase">Loading payslips history...</p>
            </div>
          ) : payslips.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
              <FileText className="w-10 h-10 text-slate-350 mb-3" />
              <p className="text-sm font-bold text-slate-700">No payslips published yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                When the administration publishes a new payroll period, it will instantly appear here for secure download.
              </p>
            </div>
          ) : (
            <>
            <div className="md:hidden space-y-3">
              {payslips.map((payslip) => (
                <div key={payslip.id} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-sm text-slate-950 break-words">
                        {formatPayslipDate(payslip.date_sent || payslip.payslip_data?.payDate)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Published</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      Ready
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => onViewDetails(payslip)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => onDownload(payslip)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 text-white font-bold rounded-lg text-xs transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-100 bg-white">
              <table className="w-full border-collapse text-left text-xs text-slate-500">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th scope="col" className="px-6 py-4">Payroll Period</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {payslips.map((payslip) => (
                    <tr key={payslip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-slate-950">
                              {formatPayslipDate(payslip.date_sent || payslip.payslip_data?.payDate)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Published</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onViewDetails(payslip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => onDownload(payslip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-900 text-white font-bold rounded-lg text-xs transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-100 bg-slate-50 py-6 text-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
          Last Resort Detective Agency &copy; {new Date().getFullYear()} &bull; Secure Encrypted Connection
        </p>
      </footer>

      {/* PDF Preview Modal Popup */}
      {activePreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-5xl h-[92vh] sm:h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3 bg-slate-50">
              <div className="min-w-0">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Payslip Details
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Period: {previewPeriod}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-250/60 flex items-center justify-center text-slate-650 hover:text-slate-900 transition-all cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Iframe) */}
            <div className="flex-1 bg-slate-100 relative">
              <iframe
                src={activePreviewUrl}
                className="w-full h-full border-none"
                title={`Payslip Preview ${previewPeriod}`}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 bg-white">
              <button
                onClick={closePreview}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-250/80 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                Close Preview
              </button>
              <a
                href={activePreviewUrl}
                download={`${user?.name ? user.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'payslip'}_${previewPeriod.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.pdf`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 text-white font-bold rounded-lg text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
