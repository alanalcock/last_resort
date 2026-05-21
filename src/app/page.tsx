'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { parsePayrollFile, type ParsedPayslipRecord } from '@/lib/fileParser';
import { buildPayrollPreview } from '@/lib/payroll/preview';
import { DEFAULT_ADMINS, formatPayslipCell } from '@/lib/payroll/utils';
import { handleDownloadPDF } from '@/lib/pdfGenerator';
import { AdminOptionsPanel } from '@/components/admin/AdminOptionsPanel';
import { StaffEditModal } from '@/components/staff/StaffEditModal';
import type { AdminRecord, PreviewBatchEntry, StaffRecord, UnmatchedPayslipEntry } from '@/types/payroll';
import { 
  CloudUpload, 
  FileText, 
  Users, 
  Settings, 
  CreditCard, 
  Plus,
  Search,
  Pencil,
  AlertCircle,
  Calendar,
  X,
  Loader2,
  Download,
} from 'lucide-react';

const tabs = [
  { id: 'payroll', label: 'Upload Payroll', icon: CreditCard },
  { id: 'staff', label: 'All Staff', icon: Users },
  { id: 'options', label: 'Options', icon: Settings },
];

export default function Home() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('payroll');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('All');

  // Admin Management State
  const [admins, setAdmins] = useState<AdminRecord[]>(DEFAULT_ADMINS);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Staff Editing State
  const [editingStaff, setEditingStaff] = useState<StaffRecord | any | null>(null);

  // Application State
  const [currentBroadcastInfo, setCurrentBroadcastInfo] = useState<{filename: string; total: number} | null>(null);
  const handleUnauthorized = useCallback(() => {
    window.location.href = '/login';
  }, []);
  const {
    admins: loadedAdmins,
    setAdmins: setLoadedAdmins,
    staffList,
    setStaffList,
    deliveryLogs,
    setDeliveryLogs,
    isLoading,
  } = useDashboardData(handleUnauthorized);

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processStats, setProcessStats] = useState({ total: 0, matched: 0, sent: 0 });

  // Preview State
  const [previewInvoice, setPreviewInvoice] = useState<{ staffData: any; payslip?: ParsedPayslipRecord } | null>(null);
  const [previewBatch, setPreviewBatch] = useState<PreviewBatchEntry[]>([]);
  const [unmatchedPayslips, setUnmatchedPayslips] = useState<UnmatchedPayslipEntry[]>([]);

  useEffect(() => {
    setAdmins(loadedAdmins);
  }, [loadedAdmins]);

  const lastDeliveryByStaffId = useMemo(() => {
    const lookup = new Map<number, any>();

    deliveryLogs.forEach((log) => {
      if (typeof log.staffId !== 'number' || lookup.has(log.staffId)) {
        return;
      }

      lookup.set(log.staffId, log);
    });

    return lookup;
  }, [deliveryLogs]);

  const deliveryByStaffDate = useMemo(() => {
    const lookup = new Map<string, any>();

    deliveryLogs.forEach((log) => {
      if (typeof log.staffId !== 'number' || !log.dateSent) {
        return;
      }

      lookup.set(`${log.staffId}-${log.dateSent}`, log);
    });

    return lookup;
  }, [deliveryLogs]);

  const filteredStaff = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return staffList.filter(person => {
      const matchesSearch = !normalizedSearch ||
        String(person.name || '').toLowerCase().includes(normalizedSearch) ||
        String(person.employee_id || '').toLowerCase().includes(normalizedSearch);

      return matchesSearch && (statusFilter === 'All' || person.status === statusFilter);
    });
  }, [deferredSearchTerm, staffList, statusFilter]);

  const handlePreviewBatchView = async (staff: StaffRecord, payslip: ParsedPayslipRecord) => {
    setPreviewInvoice({ staffData: staff, payslip });
  };

  const openStaffProfile = (staffId: number) => {
    router.push(`/staff/${staffId}`);
  };

  const clearPreviewBatch = () => {
    setPreviewBatch([]);
    setUnmatchedPayslips([]);
  };

  const confirmPreviewBatch = async () => {
    setIsProcessing(true);
    setProcessingStatus('Publishing payslips to employee portal...');

    const localLogs = [];
    const chunkSize = 5;
    
    for (let i = 0; i < previewBatch.length; i += chunkSize) {
      const chunk = previewBatch.slice(i, i + chunkSize);
      setProcessingStatus(`Publishing payslips (${i + 1} to ${Math.min(i + chunkSize, previewBatch.length)} of ${previewBatch.length})...`);
      
      const chunkResults = await Promise.all(chunk.map(async (entry) => {
        const emailStatus = entry.staff.send_email && entry.staff.email ? 'PDF Ready' : 'Not Sent';

        try {
          const response = await fetch('/api/delivery-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              staff_id: entry.staff.id,
              date_sent: entry.dateSent,
              whatsapp_status: 'Published',
              email_status: emailStatus,
              payslip_data: entry.payslip,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const result = await response.json();

          return {
            id: result.id || entry.id,
            staffId: entry.staff.id,
            staffName: entry.staff.name,
            phone: entry.staff.phone,
            email: entry.staff.email,
            dateSent: entry.dateSent,
            whatsappStatus: 'Published',
            emailStatus,
            staffData: entry.staff,
          };
        } catch (error) {
          console.error('Error publishing payslip:', error);
          return {
            id: entry.id,
            staffId: entry.staff.id,
            staffName: entry.staff.name,
            phone: entry.staff.phone,
            email: entry.staff.email,
            dateSent: entry.dateSent,
            whatsappStatus: 'Failed',
            emailStatus,
            staffData: entry.staff,
          };
        }
      }));

      localLogs.push(...chunkResults);
    }

    const sentCount = localLogs.filter((entry) => entry.whatsappStatus === 'Published').length;
    const failedCount = localLogs.filter((entry) => entry.whatsappStatus === 'Failed').length;

    if (currentBroadcastInfo) {
      const newRun = {
        filename: currentBroadcastInfo.filename,
        total_records: currentBroadcastInfo.total,
        matched_records: localLogs.length,
        sent_records: sentCount,
      };
      
      await fetch('/api/broadcast-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRun),
      });
      setCurrentBroadcastInfo(null);
    }

    setDeliveryLogs(localLogs);
    setActiveTab('staff');
    setProcessStats(prev => ({ ...prev, sent: sentCount }));
    setProcessingStatus(unmatchedPayslips.length > 0
      ? `Publishing finished. ${sentCount} published to portal, ${failedCount} failed. ${unmatchedPayslips.length} TRN${unmatchedPayslips.length === 1 ? '' : 's'} still need to be added to the database.`
      : `Publishing finished. ${sentCount} published to portal, ${failedCount} failed.`
    );
    clearPreviewBatch();
    setIsProcessing(false);
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newStaffData = {
      name: formData.get('name') as string,
      trn: formData.get('trn') as string,
      nis_number: formData.get('nis_number') as string,
      employee_id: formData.get('employee_id') as string,
      dob: formData.get('dob') as string,
      home_address: formData.get('home_address') as string,
      employment_date: formData.get('employment_date') as string,
      insurance: formData.get('insurance') as string,
      insurance_expiry: formData.get('insurance_expiry') as string,
      psra: formData.get('psra') as string,
      psra_expiry: formData.get('psra_expiry') as string,
      job_role: formData.get('job_role') as string,
      email: editingStaff?.email || null,
      phone: formData.get('phone') as string,
      status: (formData.get('status') as string) || editingStaff?.status || 'Employeed',
      send_whatsapp: editingStaff?.send_whatsapp ?? (!!(formData.get('phone') as string)?.trim()),
      send_email: false
    };

    if (editingStaff?.id === 'new') {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaffData),
      });
      const data = await res.json();
      
      if (res.ok && data) {
        setStaffList((prev) => [{ ...data, dob: data.dob }, ...prev]);
      } else {
        console.error('Error adding staff');
      }
    } else if (editingStaff) {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStaffData, id: editingStaff.id }),
      });
      
      if (res.ok) {
        setStaffList((prev) => prev.map((staff) => (staff.id === editingStaff.id ? { ...staff, ...newStaffData } : staff)));
      } else {
        console.error('Error updating staff');
      }
    }
    setEditingStaff(null);
  };

  const saveSetting = async (key: string, value: string) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    
    if (!res.ok) console.error(`Error saving ${key}`);
  };

  const handlePromoteStaffToAdmin = async (name: string, username: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (admins.some(a => String(a.username || '').toLowerCase() === cleanUsername)) {
      alert('This administrator username is already in use. Please select a unique username.');
      return;
    }

    try {
      // 1. Create a brand new active Staff record in the database for the new admin, with password set to null (triggers initial default password flow)
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          status: 'Employeed',
          job_role: 'Administrator',
          password: null
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create database record for new administrator.');
      }

      const newStaff = await res.json();
      
      // Update local staff list state so it lists the new staff member
      setStaffList(prev => [newStaff, ...prev]);

      // 2. Create the admin configuration entry
      const newAdmin = {
        id: Date.now().toString(),
        staffId: newStaff.id.toString(),
        name: name.trim(),
        username: cleanUsername,
        role: 'Administrator',
        isDefault: false
      };

      const updatedAdmins = [...admins, newAdmin];
      setAdmins(updatedAdmins);
      setLoadedAdmins(updatedAdmins);
      await saveSetting('admins_list', JSON.stringify(updatedAdmins));
      alert(`${name.trim()} has been added as an Administrator successfully!\n\nThey can log in using their username "${cleanUsername}" and default password "admin", and will be prompted to choose a new secure password on their first login.`);
      setIsAddingAdmin(false);
    } catch (error) {
      console.error('Error adding new admin:', error);
      alert('An error occurred while adding the administrator. Please try again.');
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (adminId === 'default') {
      alert('Cannot delete default admin.');
      return;
    }
    if (!confirm('⚠️ WARNING: This will immediately revoke all administrative privileges for this user. They will instantly lose access to the administrator dashboard, settings, and standard payroll management. This action cannot be undone.\n\nAre you absolutely sure you want to proceed?')) {
      return;
    }

    try {
      const updatedAdmins = admins.filter(a => a.id !== adminId && String(a.staffId) !== String(adminId));
      setAdmins(updatedAdmins);
      setLoadedAdmins(updatedAdmins);
      await saveSetting('admins_list', JSON.stringify(updatedAdmins));
      alert('Admin access has been successfully revoked.');
    } catch (e) {
      console.error(e);
      alert('An error occurred while attempting to revoke admin access.');
    }
  };

  const handleResetAdminPassword = async (admin: any) => {
    if (admin.isDefault) {
      alert('Resetting the password for the Default Developer Admin account is disabled.');
      return;
    } else {
      if (!confirm(`⚠️ WARNING: This will immediately revoke administrator ${admin.name}'s current secure password and reset it back to the default "admin". They will be forced to choose a new custom secure password on their next login.\n\nAre you absolutely sure you want to proceed?`)) {
        return;
      }
      
      try {
        const response = await fetch('/api/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(admin.staffId), password: null }),
        });
        
        if (response.ok) {
          alert(`Administrator ${admin.name}'s password has been reset to "admin". They will be prompted to choose a new password on their next login.`);
          setStaffList(prev => prev.map(s => s.id === Number(admin.staffId) ? { ...s, password: null } : s));
        } else {
          alert('Failed to reset administrator password.');
        }
      } catch (e) {
        console.error(e);
        alert('An error occurred while resetting the administrator password.');
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Parsing file...');
    setProcessStats({ total: 0, matched: 0, sent: 0 });

    try {
      const parsedData = await parsePayrollFile(file);

      setProcessStats(prev => ({ ...prev, total: parsedData.length }));
      setCurrentBroadcastInfo({ filename: file.name, total: parsedData.length });
      await processRecords(parsedData as ParsedPayslipRecord[]);

    } catch (error) {
      console.error('Error processing file:', error);
      setProcessingStatus('Error processing file. Please check the format.');
      setTimeout(() => setIsProcessing(false), 3000);
    }
  };

  const processRecords = async (records: ParsedPayslipRecord[]) => {
    setProcessingStatus('Mapping records by TRN...');
    const today = new Date().toISOString().split('T')[0];
    const payslipRecords = records.filter((record): record is ParsedPayslipRecord => record?.kind === 'payslip');
    const { previewEntries, unmatchedEntries, matchedCount, skippedCount } = buildPayrollPreview({
      records: payslipRecords,
      staffList,
      deliveryByStaffDate,
      today,
    });

    setProcessStats(prev => ({ ...prev, matched: matchedCount }));

    setProcessingStatus('Generating payslip previews...');
    clearPreviewBatch();
    setProcessStats(prev => ({ ...prev, sent: previewEntries.length + skippedCount }));

    setPreviewBatch(previewEntries);
    setUnmatchedPayslips(unmatchedEntries);
    setProcessingStatus(unmatchedEntries.length > 0
      ? `Review matched payslips. ${unmatchedEntries.length} TRN${unmatchedEntries.length === 1 ? '' : 's'} were not found in the database.`
      : 'Review every payslip preview, then confirm the batch.'
    );

    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verifying secure node...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 sm:py-12 px-4 relative overflow-hidden">
      {/* Background ambient light effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-slate-400/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-slate-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl space-y-8">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-stretch justify-between gap-6">
          <div className="flex flex-col justify-center space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
              Last Resort Detective Agency Limited
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-500">
              <p>Manage your payroll automation and staff communications.</p>
              <span className="hidden sm:inline text-slate-350">&bull;</span>
              <button 
                onClick={async () => {
                  await fetch('/api/portal/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                className="text-red-650 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm items-stretch shrink-0 overflow-x-auto max-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchTerm('');
                    setStatusFilter('All');
                  }}
                  className={`
                    flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 shrink-0
                    ${activeTab === tab.id 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-xl shadow-xl overflow-hidden min-h-[520px] sm:min-h-[600px] flex flex-col p-0">
          
          {activeTab === 'payroll' && (
            <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
              <div className="w-full max-w-md text-center flex flex-col items-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Upload Payroll</h2>
                <p className="text-sm sm:text-base text-slate-500 mb-8 sm:mb-10 max-w-xs">
                  Upload your payroll data to begin the automation and notification process.
                </p>

                {isProcessing ? (
                  <div className="w-full h-56 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in duration-500">
                    <Loader2 className="w-12 h-12 text-slate-900 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{processingStatus}</h3>
                    <p className="text-sm text-slate-500">
                      Matched: {processStats.matched} / {processStats.total}
                    </p>
                    {processStats.sent > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        Prepared: {processStats.sent} / {processStats.matched}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-slate-900 to-slate-700 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <label 
                      htmlFor="file-upload" 
                      className="relative flex flex-col items-center justify-center w-full h-56 px-4 py-8 bg-white border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-400/50 hover:bg-slate-50 transition-all duration-500"
                    >
                      <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-white group-hover:scale-110 transition-all duration-500">
                        <CloudUpload className="w-8 h-8 text-slate-400 group-hover:text-slate-900" />
                      </div>
                      <p className="mb-2 text-base text-slate-600">
                        <span className="font-semibold text-slate-900">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-slate-400">CSV, XLS, or XLSX up to 10MB</p>
                    </label>
                    <input 
                      id="file-upload" 
                      type="file" 
                      className="hidden" 
                      accept=".csv, .xlsx, .xls" 
                      onChange={handleFileUpload}
                    />
                  </div>
                )}
                
                <div className="flex w-full items-center gap-4 mt-8">
                  <button className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-slate-900 text-white rounded-lg font-semibold shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    New Entry
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="flex flex-col h-full">
              {/* Staff Header with Actions */}
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/50">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
                    />
                  </div>
                  <div className="shrink-0 flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-100 rounded-lg border border-slate-200/60">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{filteredStaff.length}</span>
                    <span className="text-[10px] font-medium text-slate-400">/ {staffList.length}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors outline-none cursor-pointer"
                  >
                    <option value="All">All Status</option>
                    <option value="Employeed">Employeed</option>
                    <option value="Unemployees">Unemployees</option>
                    <option value="Leave of Absence">Leave of Absence</option>
                  </select>
                  <button 
                    onClick={() => setEditingStaff({ id: 'new', name: '', trn: '', email: '', phone: '', dob: '', home_address: '', employment_date: '', insurance: '', insurance_expiry: '', psra: '', psra_expiry: '', job_role: '' })}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Staff
                  </button>
                </div>
              </div>

              {/* Staff Table */}
              <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3">
                {filteredStaff.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
                  >
                    <button
                      type="button"
                      onClick={() => openStaffProfile(person.id)}
                      className="w-full text-left space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-20 shrink-0 h-10 px-2 rounded-lg bg-slate-900 flex items-center justify-center text-center text-white font-bold text-[10px] shadow-sm leading-none tabular-nums whitespace-nowrap">
                          #{person.employee_id}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">{person.trn}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">NIS Number</p>
                          <p className="text-slate-700">{person.nis_number}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phone Number</p>
                          <p className="text-slate-700">{person.phone || 'None'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Last Update</p>
                          {(() => {
                            const lastLog = lastDeliveryByStaffId.get(person.id);
                            if (!lastLog) {
                              return <span className="text-slate-400 italic text-sm">Never</span>;
                            }
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-700">{lastLog.dateSent}</span>
                                </div>
                                {lastLog.whatsappStatus === 'Published' || lastLog.whatsappStatus === 'Sent' ? (
                                  <span className="text-[10px] text-green-600 font-semibold uppercase tracking-tight">Published to Portal</span>
                                ) : lastLog.whatsappStatus === 'Failed' ? (
                                  <span className="text-[10px] text-red-500 font-semibold uppercase tracking-tight">Failed</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">{lastLog.whatsappStatus}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </button>
                    <button 
                      onClick={() => setEditingStaff(person)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              <div className="hidden md:block flex-1 overflow-auto h-[500px]">
                <table className="w-full min-w-[800px] text-left border-collapse">
                  <thead className="bg-slate-50/50 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Member</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">TRN Number</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">NIS Number</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone Number</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Update</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((person) => (
                      <tr key={person.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer">
                        <td 
                          onClick={() => openStaffProfile(person.id)}
                          className="px-6 py-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-20 shrink-0 h-10 px-2 rounded-lg bg-slate-900 flex items-center justify-center text-center text-white font-bold text-[10px] shadow-sm leading-none tabular-nums whitespace-nowrap">
                              #{person.employee_id}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                                {person.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td 
                          onClick={() => openStaffProfile(person.id)}
                          className="px-6 py-4"
                        >
                          <p className="text-sm font-medium text-slate-600 tracking-wider uppercase">{person.trn}</p>
                        </td>
                        <td 
                          onClick={() => openStaffProfile(person.id)}
                          className="px-6 py-4"
                        >
                          <p className="text-sm font-medium text-slate-600 tracking-wider uppercase">{person.nis_number}</p>
                        </td>
                        <td 
                          onClick={() => openStaffProfile(person.id)}
                          className="px-6 py-4"
                        >
                          <p className="text-sm font-medium text-slate-600">{person.phone || <span className="text-slate-400 italic">None</span>}</p>
                        </td>
                        <td 
                          onClick={() => openStaffProfile(person.id)}
                          className="px-6 py-4"
                        >
                          {(() => {
                            const lastLog = lastDeliveryByStaffId.get(person.id);
                            if (!lastLog) {
                              return <span className="text-slate-400 italic text-sm">Never</span>;
                            }
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-700">{lastLog.dateSent}</span>
                                </div>
                                {lastLog.whatsappStatus === 'Published' || lastLog.whatsappStatus === 'Sent' ? (
                                  <span className="text-[10px] text-green-600 font-semibold uppercase tracking-tight">Published to Portal</span>
                                ) : lastLog.whatsappStatus === 'Failed' ? (
                                  <span className="text-[10px] text-red-500 font-semibold uppercase tracking-tight">Failed</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">{lastLog.whatsappStatus}</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setEditingStaff(person)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}



          {activeTab === 'options' && (
            <AdminOptionsPanel
              admins={admins}
              isAddingAdmin={isAddingAdmin}
              setIsAddingAdmin={setIsAddingAdmin}
              handlePromoteStaffToAdmin={handlePromoteStaffToAdmin}
              handleRemoveAdmin={handleRemoveAdmin}
              handleResetAdminPassword={handleResetAdminPassword}
            />
          )}

        </div>

      </div>

      <StaffEditModal
        editingStaff={editingStaff}
        setEditingStaff={setEditingStaff}
        handleStaffSubmit={handleStaffSubmit}
      />

      {/* Payslip Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setPreviewInvoice(null)}
          />
          <div className="relative w-full max-w-4xl h-[92vh] sm:h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3 bg-slate-50">
              <div className="flex min-w-0 items-start sm:items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Payslip Preview</h3>
                  <p className="text-xs text-slate-500 font-medium break-words">
                    {previewInvoice.payslip?.employeeName || previewInvoice.staffData.name}
                    {previewInvoice.payslip?.department ? ` - ${previewInvoice.payslip.department}` : ''}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewInvoice(null)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Spreadsheet-style payslip preview */}
            <div className="flex-1 bg-slate-100 p-4 overflow-auto">
              <div className="w-full min-h-full rounded-lg border border-slate-200 shadow-sm bg-white p-3 sm:p-5">
                <div className="mx-auto max-w-5xl overflow-x-auto min-w-full border border-slate-200 bg-white">
                  {previewInvoice.payslip?.rawRows && previewInvoice.payslip.rawRows.length > 0 ? (
                    <div className="min-w-[750px]">
                      {previewInvoice.payslip.rawRows.map((row: any[], rowIndex: number) => {
                        const rowText = row.map((cell) => formatPayslipCell(cell, rowIndex, 0, previewInvoice.payslip)).join(' ').trim();
                        const isCompany = rowText === 'LAST   RESORT  DETECTIVE   AGENCY  LIMITED';
                        const isHeader = row[0] === 'Earnings';
                        const isTotal = row[0] === 'Total:' || row[0] === 'Net Pay:';

                        if (isCompany) {
                          return (
                            <div key={rowIndex} className="px-3 py-2 text-center text-sm font-bold text-slate-900 border-b border-slate-200">
                              LAST   RESORT  DETECTIVE   AGENCY  LIMITED
                            </div>
                          );
                        }

                        return (
                          <div
                            key={rowIndex}
                            className={`grid grid-cols-[1.7fr_0.9fr_0.55fr_0.9fr_1.35fr_0.9fr_0.9fr] min-h-8 border-b border-slate-100 text-[11px] ${
                              isHeader ? 'bg-slate-100 font-bold text-slate-900' : isTotal ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {Array.from({ length: 7 }, (_, colIndex) => {
                              const value = formatPayslipCell(row[colIndex], rowIndex, colIndex, previewInvoice.payslip);
                              const isNumeric = value !== '' && !Number.isNaN(Number(String(value).replace(/,/g, '')));

                              return (
                                <div
                                  key={colIndex}
                                  className={`px-2 py-1.5 border-r border-slate-100 last:border-r-0 ${isNumeric ? 'text-right tabular-nums' : ''}`}
                                >
                                  {value}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {Object.entries(previewInvoice.payslip || {})
                        .filter(([key, val]) => key !== 'kind' && typeof val !== 'object')
                        .map(([key, value], idx) => (
                        <div key={idx} className="px-4 py-3 border-b border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{key}</p>
                          <p className="text-sm font-semibold text-slate-900">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <p className="text-xs text-slate-400 font-medium italic max-w-xl">
                Original payslip rows from the spreadsheet. TRN is only used for matching.
              </p>
              <button
                onClick={() => handleDownloadPDF(previewInvoice.staffData, previewInvoice.payslip)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {(previewBatch.length > 0 || unmatchedPayslips.length > 0) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm"
            onClick={clearPreviewBatch}
          />
          <div className="relative w-full max-w-7xl h-[92vh] sm:h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-start sm:items-center justify-between gap-4">
              <div className="flex min-w-0 items-start sm:items-center gap-3">
                <div className="w-11 h-11 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">Preview Payslip Batch</h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Review {previewBatch.length} matched payslips before final confirmation.
                    {unmatchedPayslips.length > 0 && ` ${unmatchedPayslips.length} TRN${unmatchedPayslips.length === 1 ? '' : 's'} need to be added to the database.`}
                  </p>
                </div>
              </div>
              <button
                onClick={clearPreviewBatch}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              <div className="space-y-4">
                {previewBatch.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="hidden md:grid grid-cols-[minmax(220px,1.5fr)_minmax(150px,1.2fr)_210px] gap-5 px-5 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <div>Employee</div>
                      <div>TRN / Date</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {previewBatch.map((entry) => {
                        return (
                          <div key={entry.id} className="flex flex-col border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col md:grid md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1.2fr)_210px] gap-3 md:gap-5 px-5 py-4 items-start md:items-center border-b-0">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{entry.staff.name}</p>
                                  {entry.isUpdate && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                      Update
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">#{entry.staff.employee_id}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 truncate">{entry.staff.trn}</p>
                                <p className="text-xs text-slate-400">{entry.dateSent}</p>
                              </div>
                              <div className="flex items-center justify-start md:justify-end gap-2 w-full md:w-auto mt-2 md:mt-0">
                                <button
                                  onClick={() => void handlePreviewBatchView(entry.staff, entry.payslip)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Preview
                                </button>
                                <button
                                  onClick={() => handleDownloadPDF(entry.staff, entry.payslip)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </button>
                              </div>
                            </div>
                            {entry.isUpdate && entry.diffs && entry.diffs.length > 0 && (
                              <div className="px-5 pb-4 pt-0">
                                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                  <p className="text-xs font-bold text-amber-800 mb-1">Changes Detected:</p>
                                  <ul className="list-disc list-inside text-[11px] text-amber-700 space-y-0.5">
                                    {entry.diffs.map((diff, idx) => (
                                      <li key={idx}>{diff}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {unmatchedPayslips.length > 0 && (
                  <div className="bg-white rounded-lg border border-amber-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">TRNs not found in staff database</h4>
                          <p className="text-sm text-amber-800">
                            Add these employees to the database before sending their payslips.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {unmatchedPayslips.map((entry) => (
                        <div key={entry.id} className="flex flex-col md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-3 md:gap-4 px-5 py-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{entry.payslip.employeeName || 'Unknown employee'}</p>
                            <p className="text-xs text-slate-500 truncate">{entry.payslip.department || 'No department listed'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">TRN from file</p>
                            <p className="text-sm text-slate-700">{entry.payslip.trn || 'Missing'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pay date</p>
                            <p className="text-sm text-slate-700">{entry.payslip.payDate || 'Not listed'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"> 
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                Confirm matched payslips only after the TRN mapping and PDFs look correct.
              </p>
              <div className="flex w-full sm:w-auto flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={clearPreviewBatch}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPreviewBatch}
                  disabled={previewBatch.length === 0 || isProcessing}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-md shadow-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {isProcessing ? 'Publishing...' : 'Confirm and Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

