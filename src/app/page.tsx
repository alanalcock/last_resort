'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { parsePayrollFile, type ParsedPayslipRecord } from '@/lib/fileParser';
import { buildPayrollPreview } from '@/lib/payroll/preview';
import { DEFAULT_ADMINS, formatDayFirstDate, formatPayslipCell, normalizeDateInputToIso, formatNameLastFirst } from '@/lib/payroll/utils';
import { handleDownloadPDF } from '@/lib/pdfGenerator';
import { AdminOptionsPanel } from '@/components/admin/AdminOptionsPanel';
import { StaffEditModal } from '@/components/staff/StaffEditModal';
import { AttendanceRegistrationModal } from '@/components/staff/AttendanceRegistrationModal';
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
  Undo2,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Info,
  BarChart3,
  UserCheck,
  UserMinus,
  UserX,
  ShieldAlert,
  Clock,
  Hash,
} from 'lucide-react';

const tabs = [
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'staff', label: 'All Staff', icon: Users },
  { id: 'payroll', label: 'Upload Payroll', icon: CreditCard },
  { id: 'options', label: 'Options', icon: Settings },
];

const getExpiryStatus = (expiryDateStr: string | null | undefined) => {
  if (!expiryDateStr) return null;

  const expiryDate = new Date(expiryDateStr);
  if (isNaN(expiryDate.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Expired (${Math.abs(diffDays)}d ago)`, isExpired: true, isExpiringSoon: false, diffDays };
  } else if (diffDays <= 30) {
    return { label: `${diffDays}d left`, isExpired: false, isExpiringSoon: true, diffDays };
  } else {
    return { label: 'Active', isExpired: false, isExpiringSoon: false, diffDays };
  }
};

export default function Home() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('reports');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState('All');
  const [complianceSearch, setComplianceSearch] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('all');

  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Admin Management State
  const [admins, setAdmins] = useState<AdminRecord[]>(DEFAULT_ADMINS);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Staff Editing State
  const [editingStaff, setEditingStaff] = useState<StaffRecord | any | null>(null);
  const [registeringStaff, setRegisteringStaff] = useState<StaffRecord | null>(null);
  const [isRemovingStaff, setIsRemovingStaff] = useState(false);

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
    todayAttendance,
    setTodayAttendance,
    fetchAttendance,
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
  const [showRetractModal, setShowRetractModal] = useState(false);
  const [selectedRetractDate, setSelectedRetractDate] = useState('');
  const [isRetracting, setIsRetracting] = useState(false);

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

    return staffList
      .filter(person => {
        const matchesSearch = !normalizedSearch ||
          String(person.name || '').toLowerCase().includes(normalizedSearch) ||
          String(person.employee_id || '').toLowerCase().includes(normalizedSearch);

        return matchesSearch && (statusFilter === 'All' || person.status === statusFilter);
      })
      .sort((a, b) => {
        const aLast = (a.name.trim().split(' ').pop() || '').toLowerCase();
        const bLast = (b.name.trim().split(' ').pop() || '').toLowerCase();
        return aLast.localeCompare(bLast);
      });
  }, [deferredSearchTerm, staffList, statusFilter]);

  const activeStaff = useMemo(() => {
    return staffList
      .filter(s => s.status !== 'Terminated')
      .sort((a, b) => {
        const aLast = (a.name.trim().split(' ').pop() || '').toLowerCase();
        const bLast = (b.name.trim().split(' ').pop() || '').toLowerCase();
        return aLast.localeCompare(bLast);
      });
  }, [staffList]);

  const todayAttendanceSummary = useMemo(() => {
    const present: { staff: StaffRecord; presentType: string }[] = [];
    const leave: { staff: StaffRecord; leaveType: string }[] = [];
    const absent: StaffRecord[] = [];
    const unreported: StaffRecord[] = [];

    const attendanceMap = new Map<number, any>();
    todayAttendance.forEach((log) => {
      if (log.staff_id) {
        attendanceMap.set(log.staff_id, log);
      }
    });

    activeStaff.forEach((staff) => {
      const log = attendanceMap.get(staff.id);
      if (!log) {
        unreported.push(staff);
      } else if (log.status === 'Present') {
        present.push({ staff, presentType: log.present_type || 'On Time' });
      } else if (log.status === 'Leave') {
        leave.push({ staff, leaveType: log.leave_type || 'Leave' });
      } else if (log.status === 'Absent') {
        absent.push(staff);
      }
    });

    return { present, leave, absent, unreported };
  }, [activeStaff, todayAttendance]);

  const complianceData = useMemo(() => {
    const list: {
      staff: StaffRecord;
      issues: {
        type: 'missing' | 'expired' | 'expiring';
        field: string;
        message: string;
        severity: 'critical' | 'warning';
      }[];
    }[] = [];

    const normalizeInsuranceCoverage = (value: string | null | undefined) => {
      if (!value) return '';
      const normalized = value.trim().toLowerCase();
      if (normalized === 'no') return 'No';
      return 'Yes';
    };

    activeStaff.forEach((staff) => {
      const issues: {
        type: 'missing' | 'expired' | 'expiring';
        field: string;
        message: string;
        severity: 'critical' | 'warning';
      }[] = [];

      // Check TRN
      if (!staff.trn || !staff.trn.trim()) {
        issues.push({
          type: 'missing',
          field: 'TRN',
          message: 'Missing TRN Number',
          severity: 'critical',
        });
      }

      // Check NIS
      if (!staff.nis_number || !staff.nis_number.trim()) {
        issues.push({
          type: 'missing',
          field: 'NIS',
          message: 'Missing NIS Number',
          severity: 'critical',
        });
      }

      // Check PSRA ID
      const hasPsraId = staff.psra && staff.psra.trim();
      if (!hasPsraId) {
        issues.push({
          type: 'missing',
          field: 'PSRA ID',
          message: 'Missing PSRA ID',
          severity: 'critical',
        });
      }

      // Check PSRA Expiry (only if PSRA ID is present)
      if (hasPsraId) {
        if (!staff.psra_expiry || !staff.psra_expiry.trim()) {
          issues.push({
            type: 'missing',
            field: 'PSRA Expiry',
            message: 'Missing PSRA Expiry Date',
            severity: 'critical',
          });
        } else {
          const expiryStatus = getExpiryStatus(staff.psra_expiry);
          if (expiryStatus) {
            if (expiryStatus.isExpired) {
              issues.push({
                type: 'expired',
                field: 'PSRA Expiry',
                message: `PSRA Card Expired (${Math.abs(expiryStatus.diffDays)} days ago)`,
                severity: 'critical',
              });
            } else if (expiryStatus.isExpiringSoon) {
              issues.push({
                type: 'expiring',
                field: 'PSRA Expiry',
                message: `PSRA Card Expiring (${expiryStatus.diffDays} days left)`,
                severity: 'warning',
              });
            }
          }
        }
      }

      // Check Insurance Coverage
      if (normalizeInsuranceCoverage(staff.insurance_expiry) !== 'Yes') {
        issues.push({
          type: 'missing',
          field: 'Insurance',
          message: 'No Insurance Coverage',
          severity: 'warning',
        });
      }

      if (issues.length > 0) {
        list.push({ staff, issues });
      }
    });

    return list;
  }, [activeStaff]);

  const filteredComplianceData = useMemo(() => {
    const searchNormalized = complianceSearch.trim().toLowerCase();
    
    return complianceData.filter((item) => {
      const matchesSearch = !searchNormalized ||
        item.staff.name.toLowerCase().includes(searchNormalized) ||
        (item.staff.employee_id && item.staff.employee_id.toLowerCase().includes(searchNormalized));

      if (!matchesSearch) return false;

      if (complianceFilter === 'all') return true;
      if (complianceFilter === 'missing') {
        return item.issues.some((issue) => issue.type === 'missing');
      }
      if (complianceFilter === 'expired') {
        return item.issues.some((issue) => issue.type === 'expired');
      }
      if (complianceFilter === 'expiring') {
        return item.issues.some((issue) => issue.type === 'expiring');
      }
      return true;
    });
  }, [complianceData, complianceSearch, complianceFilter]);

  const retractablePayrollDates = useMemo(() => {
    const counts = new Map<string, number>();

    deliveryLogs.forEach((log) => {
      if (!log.dateSent) {
        return;
      }

      counts.set(log.dateSent, (counts.get(log.dateSent) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ date, count }));
  }, [deliveryLogs]);

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

  const handleRetractUpload = async () => {
    if (!selectedRetractDate) {
      return;
    }

    setIsRetracting(true);

    try {
      const response = await fetch('/api/delivery-logs/retract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_sent: selectedRetractDate }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to retract upload.');
      }

      setDeliveryLogs((prev) => prev.filter((log) => log.dateSent !== selectedRetractDate));
      setProcessingStatus(`Retracted ${result.deleted_count} payslip record${result.deleted_count === 1 ? '' : 's'} for ${selectedRetractDate}.`);
      setShowRetractModal(false);
      setSelectedRetractDate('');
    } catch (error) {
      console.error('Retract upload error:', error);
      setProcessingStatus('Failed to retract selected upload.');
    } finally {
      setIsRetracting(false);
    }
  };

  const confirmPreviewBatch = async () => {
    setIsProcessing(true);
    setProcessingStatus('Publishing payslips to employee portal...');
    let localLogs = [];
    let sentCount = 0;
    let failedCount = 0;

    try {
      const response = await fetch('/api/delivery-logs/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: previewBatch.map((entry) => ({
            id: entry.id,
            staff_id: entry.staff.id,
            date_sent: entry.dateSent,
            whatsapp_status: 'Published',
            email_status: entry.staff.send_email && entry.staff.email ? 'PDF Ready' : 'Not Sent',
            payslip_data: entry.payslip,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to publish payslip batch.');
      }

      localLogs = [
        ...(Array.isArray(result?.saved)
          ? result.saved.map((log: any) => ({
              id: log.id,
              staffId: log.staff_id,
              staffName: log.staff?.name,
              phone: log.staff?.phone,
              email: log.staff?.email,
              dateSent: log.date_sent,
              whatsappStatus: log.whatsapp_status,
              emailStatus: log.email_status,
              staffData: log.staff,
              payslipData: log.payslip_data,
            }))
          : []),
        ...(Array.isArray(result?.failed)
          ? result.failed.map((failure: any) => {
              const entry = previewBatch.find((item) => item.id === failure.id);
              const emailStatus = entry?.staff.send_email && entry?.staff.email ? 'PDF Ready' : 'Not Sent';

              return {
                id: failure.id,
                staffId: entry?.staff.id ?? failure.staff_id ?? null,
                staffName: entry?.staff.name ?? null,
                phone: entry?.staff.phone ?? null,
                email: entry?.staff.email ?? null,
                dateSent: entry?.dateSent ?? failure.date_sent ?? null,
                whatsappStatus: 'Failed',
                emailStatus,
                staffData: entry?.staff ?? null,
              };
            })
          : []),
      ];

      sentCount = Array.isArray(result?.saved) ? result.saved.length : 0;
      failedCount = Array.isArray(result?.failed) ? result.failed.length : 0;
    } catch (error) {
      console.error('Batch publishing error:', error);
      localLogs = previewBatch.map((entry) => ({
        id: entry.id,
        staffId: entry.staff.id,
        staffName: entry.staff.name,
        phone: entry.staff.phone,
        email: entry.staff.email,
        dateSent: entry.dateSent,
        whatsappStatus: 'Failed',
        emailStatus: entry.staff.send_email && entry.staff.email ? 'PDF Ready' : 'Not Sent',
        staffData: entry.staff,
      }));
      failedCount = localLogs.length;
    }

    if (currentBroadcastInfo) {
      const newRun = {
        filename: currentBroadcastInfo.filename,
        total_records: currentBroadcastInfo.total,
        matched_records: previewBatch.length,
        sent_records: sentCount,
      };
      
      await fetch('/api/broadcast-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRun),
      });
      setCurrentBroadcastInfo(null);
    }

    setDeliveryLogs((prev) => {
      const untouched = prev.filter(
        (existing) =>
          !localLogs.some(
            (nextLog) => nextLog.staffId === existing.staffId && nextLog.dateSent === existing.dateSent,
          ),
      );

      return [...localLogs, ...untouched];
    });
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
    const firstName = formData.get('firstName') as string || '';
    const lastName = formData.get('lastName') as string || '';
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const newStaffData = {
      name: fullName,
      trn: formData.get('trn') as string,
      nis_number: formData.get('nis_number') as string,
      employee_id: formData.get('employee_id') as string,
      dob: normalizeDateInputToIso(formData.get('dob')),
      home_address: formData.get('home_address') as string,
      employment_date: normalizeDateInputToIso(formData.get('employment_date')),
      insurance: formData.get('insurance') as string,
      insurance_expiry: formData.get('insurance_expiry') as string,
      psra: formData.get('psra') as string,
      psra_expiry: normalizeDateInputToIso(formData.get('psra_expiry')),
      job_role: formData.get('job_role') as string,
      email: editingStaff?.email || null,
      phone: formData.get('phone') as string,
      status: (formData.get('status') as string) || editingStaff?.status || 'Full-Time',
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

  const handleRemoveStaff = async () => {
    if (!editingStaff || editingStaff.id === 'new') {
      return;
    }

    const staffId = Number(editingStaff.id);
    const staffName = editingStaff.name || 'this staff member';
    const confirmed = window.confirm(
      `Remove ${staffName}? This will also remove their attendance, portal payslip logs, and saved payslip records.`,
    );

    if (!confirmed) {
      return;
    }

    setIsRemovingStaff(true);

    try {
      const response = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staffId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to remove staff.');
      }

      setStaffList((prev) => prev.filter((staff) => staff.id !== staffId));
      setDeliveryLogs((prev) => prev.filter((log) => log.staffId !== staffId));
      setEditingStaff(null);
    } catch (error) {
      console.error('Remove staff error:', error);
      alert('Unable to remove staff right now.');
    } finally {
      setIsRemovingStaff(false);
    }
  };

  const handlePromoteStaffToAdmin = async (name: string, username: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (admins.some(a => String(a.username || '').toLowerCase() === cleanUsername)) {
      alert('This administrator username is already in use. Please select a unique username.');
      return;
    }

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: cleanUsername,
          role: 'Administrator',
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || 'Failed to create database record for new administrator.');
      }

      const createdAdmin = await res.json();
      const newAdmin = {
        id: createdAdmin.id,
        name: createdAdmin.name,
        username: createdAdmin.username,
        role: createdAdmin.role,
        isDefault: Boolean(createdAdmin.is_default ?? createdAdmin.isDefault),
      };

      const updatedAdmins = [...admins, newAdmin];
      setAdmins(updatedAdmins);
      setLoadedAdmins(updatedAdmins);
      alert(`${name.trim()} has been added as an Administrator successfully!\n\nThey can log in using their username "${cleanUsername}" and default password "admin", and will be prompted to choose a new secure password on their first login.`);
      setIsAddingAdmin(false);
    } catch (error) {
      console.error('Error adding new admin:', error);
      alert('An error occurred while adding the administrator. Please try again.');
    }
  };

  const handleRemoveAdmin = async (adminId: string | number) => {
    if (adminId === 'default') {
      alert('Cannot delete default admin.');
      return;
    }
    if (!confirm('⚠️ WARNING: This will immediately revoke all administrative privileges for this user. They will instantly lose access to the administrator dashboard, settings, and standard payroll management. This action cannot be undone.\n\nAre you absolutely sure you want to proceed?')) {
      return;
    }

    try {
      const response = await fetch('/api/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: adminId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error || 'Failed to remove administrator.');
      }

      const updatedAdmins = admins.filter(a => String(a.id) !== String(adminId));
      setAdmins(updatedAdmins);
      setLoadedAdmins(updatedAdmins);
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
        const response = await fetch('/api/admins', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: admin.id, password: null }),
        });
        
        if (response.ok) {
          alert(`Administrator ${admin.name}'s password has been reset to "admin". They will be prompted to choose a new password on their next login.`);
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

  const trnAlertsCount = complianceData.reduce((acc, { issues }) => acc + issues.filter(i => i.field === 'TRN').length, 0);
  const nisAlertsCount = complianceData.reduce((acc, { issues }) => acc + issues.filter(i => i.field === 'NIS').length, 0);
  const psraAlertsCount = complianceData.reduce((acc, { issues }) => acc + issues.filter(i => i.field.startsWith('PSRA')).length, 0);
  const insuranceAlertsCount = complianceData.reduce((acc, { issues }) => acc + issues.filter(i => i.field === 'Insurance').length, 0);

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
          
          {activeTab === 'reports' && (
            <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
              
              {/* Reports Header / Date Picker */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Daily Operations Report
                </h2>
              </div>

              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                
                {/* Metric 1: TRN Alerts */}
                <div className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-100/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform duration-500" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${trnAlertsCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Hash className={`w-6 h-6 ${trnAlertsCount > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-600/80 uppercase tracking-widest">Missing TRN</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1 tabular-nums">
                      {trnAlertsCount}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">Staff without TRN on file</p>
                  </div>
                </div>

                {/* Metric 2: NIS Alerts */}
                <div className="bg-gradient-to-br from-blue-50/50 to-white border border-blue-100/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform duration-500" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${nisAlertsCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                    <FileText className={`w-6 h-6 ${nisAlertsCount > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-600/80 uppercase tracking-widest">Missing NIS</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1 tabular-nums">
                      {nisAlertsCount}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">Staff without NIS on file</p>
                  </div>
                </div>

                {/* Metric 3: PSRA Alerts */}
                <div className="bg-gradient-to-br from-rose-50/50 to-white border border-rose-100/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform duration-500" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${psraAlertsCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                    {psraAlertsCount > 0 ? <ShieldAlert className="w-6 h-6 animate-bounce" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-rose-650/80 uppercase tracking-widest">PSRA Alerts</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1 tabular-nums">
                      {psraAlertsCount}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">Missing or expired PSRA</p>
                  </div>
                </div>

                {/* Metric 4: Insurance Alerts */}
                <div className="bg-gradient-to-br from-purple-50/50 to-white border border-purple-100/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full translate-x-6 -translate-y-6 group-hover:scale-110 transition-transform duration-500" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${insuranceAlertsCount > 0 ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-400'}`}>
                    <AlertCircle className={`w-6 h-6 ${insuranceAlertsCount > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-purple-600/80 uppercase tracking-widest">Insurance</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1 tabular-nums">
                      {insuranceAlertsCount}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">Staff without coverage</p>
                  </div>
                </div>

              </div>

              {/* Daily Operations Row - Unified Master List */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-[600px] mb-6">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 border-b border-slate-100 shrink-0 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-500" />
                      <h4 className="text-base font-bold text-slate-900">Daily Attendance</h4>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <button 
                        type="button"
                        onClick={(e) => {
                          try {
                            const picker = document.getElementById('report-date-picker') as HTMLInputElement | null;
                            if (picker && typeof picker.showPicker === 'function') {
                              picker.showPicker();
                            }
                          } catch (err) {
                            console.error('showPicker error:', err);
                          }
                        }}
                        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                      >
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-semibold text-slate-700">
                          {(() => {
                            if (!reportDate) return 'Select Date';
                            const parts = reportDate.split('-');
                            if (parts.length !== 3) return reportDate;
                            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                            return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
                          })()}
                        </span>
                      </button>
                      <input
                        id="report-date-picker"
                        type="date"
                        value={reportDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setReportDate(e.target.value);
                            fetchAttendance(e.target.value);
                          }
                        }}
                        className="absolute opacity-0 w-0 h-0 pointer-events-none -z-10"
                        style={{ position: 'absolute', bottom: 0, left: 0 }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-bold tabular-nums border border-green-100">
                      {todayAttendanceSummary.present.length} Present
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold tabular-nums border border-red-100">
                      {todayAttendanceSummary.absent.length} Absent
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold tabular-nums border border-amber-100">
                      {todayAttendanceSummary.leave.length} On Leave
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold tabular-nums border border-slate-200">
                      {todayAttendanceSummary.unreported.length} Unreported
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-3 pr-2 space-y-2 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeStaff.map((staff) => {
                      const log = todayAttendance.find((a) => a.staff_id === staff.id);
                      const status = log?.status || '';
                      
                      let cardColor = 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300';
                      let statusLabel = 'Unreported';
                      let badgeColor = 'bg-slate-100 text-slate-600 border border-slate-200/60';
                      let avatarColor = 'bg-slate-100 text-slate-500';

                      if (status === 'Present') {
                        cardColor = 'bg-green-50/50 border-green-200 hover:bg-green-100/50 hover:border-green-300';
                        statusLabel = 'Present';
                        badgeColor = 'bg-green-100 text-green-700 border border-green-200/60';
                        avatarColor = 'bg-green-100 text-green-700';
                      } else if (status === 'Leave') {
                        cardColor = 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/50 hover:border-amber-300';
                        statusLabel = 'On Leave';
                        badgeColor = 'bg-amber-100 text-amber-800 border border-amber-200/60';
                        avatarColor = 'bg-amber-100 text-amber-700';
                      } else if (status === 'Absent') {
                        cardColor = 'bg-red-50/50 border-red-200 hover:bg-red-100/50 hover:border-red-300';
                        statusLabel = 'Absent';
                        badgeColor = 'bg-red-100 text-red-700 border border-red-200/60';
                        avatarColor = 'bg-red-100 text-red-700';
                      }

                      return (
                        <button 
                          key={staff.id} 
                          onClick={() => setRegisteringStaff(staff)}
                          className={`w-full text-left flex items-center justify-between p-3 border rounded-xl transition-all group shadow-sm ${cardColor}`}
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg font-bold text-[11px] flex items-center justify-center shrink-0 uppercase transition-colors ${avatarColor}`}>
                              {formatNameLastFirst(staff.name).replace(',', '').split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{formatNameLastFirst(staff.name)}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{staff.job_role || 'No role assigned'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${badgeColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {activeStaff.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <Users className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-sm font-semibold text-slate-500">No active staff members found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Compliance Center */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Header with Search and Filter */}
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/40">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:max-w-xl">
                    <div className="flex items-center gap-2 shrink-0">
                      <ShieldAlert className="w-5 h-5 text-rose-500" />
                      <h4 className="text-base font-bold text-slate-900">Document Compliance Center</h4>
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search compliant lists..."
                        value={complianceSearch}
                        onChange={(e) => setComplianceSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex bg-slate-100/85 p-1 rounded-lg border border-slate-200/40 self-start lg:self-auto overflow-x-auto max-w-full">
                    {[
                      { id: 'all', label: 'All Issues' },
                      { id: 'missing', label: 'Missing Docs' },
                      { id: 'expired', label: 'Expired' },
                      { id: 'expiring', label: 'Expiring Soon' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setComplianceFilter(btn.id)}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all shrink-0 ${
                          complianceFilter === btn.id
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-850'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compliance Content */}
                <div className="overflow-x-auto">
                  {filteredComplianceData.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center bg-white">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-3 animate-pulse" />
                      <h5 className="text-sm font-bold text-slate-800">No Document Alerts Found</h5>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">All active employees have complete, up-to-date documentation matching this filter.</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[700px] text-left border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Designation</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Identified Issues</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredComplianceData.map(({ staff, issues }) => (
                          <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-[11px] shadow-sm shrink-0">
                                  {staff.employee_id || 'ID'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 group-hover:text-slate-700 transition-colors">{formatNameLastFirst(staff.name)}</p>
                                  <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">TRN: {staff.trn || 'None'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-semibold text-slate-600">{staff.job_role || <span className="text-slate-400 italic">Unassigned</span>}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5 max-w-md">
                                {issues.map((issue, idx) => (
                                  <span
                                    key={idx}
                                    title={issue.message}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                      issue.severity === 'critical'
                                        ? 'bg-rose-50/70 text-rose-700 border-rose-100 hover:bg-rose-50'
                                        : 'bg-amber-50/70 text-amber-700 border-amber-100 hover:bg-amber-50'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                    {issue.field}: {issue.type === 'missing' ? 'Missing' : issue.type === 'expired' ? 'Expired' : 'Expiring'}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setEditingStaff(staff)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 bg-white border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                Fix Credentials
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

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
                
                <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-8">
                  <button className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-slate-900 text-white rounded-lg font-semibold shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95">
                    <Plus className="w-5 h-5" />
                    New Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRetractDate(retractablePayrollDates[0]?.date || '');
                      setShowRetractModal(true);
                    }}
                    disabled={retractablePayrollDates.length === 0}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-slate-900 rounded-lg font-semibold border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300 disabled:bg-slate-50"
                  >
                    <Undo2 className="w-5 h-5" />
                    Retract Upload
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
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                  <button 
                    onClick={() => setEditingStaff({ id: 'new', name: '', trn: '', email: '', phone: '', dob: '', home_address: '', employment_date: '', insurance: '', insurance_expiry: '', psra: '', psra_expiry: '', job_role: '', status: 'Full-Time' })}
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
                          {person.employee_id}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{formatNameLastFirst(person.name)}</p>
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
                                  <span className="text-sm font-semibold text-slate-700">{formatDayFirstDate(lastLog.dateSent)}</span>
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

              <div className="hidden md:block flex-1 overflow-x-auto">
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
                              {person.employee_id}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                                {formatNameLastFirst(person.name)}
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
                                  <span className="text-sm font-semibold text-slate-700">{formatDayFirstDate(lastLog.dateSent)}</span>
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
                              onClick={(e) => { e.stopPropagation(); setEditingStaff(person); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm cursor-pointer"
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
        handleRemoveStaff={handleRemoveStaff}
        isRemovingStaff={isRemovingStaff}
      />

      <AttendanceRegistrationModal
        staff={registeringStaff}
        defaultDate={reportDate}
        onClose={() => setRegisteringStaff(null)}
        onSuccess={() => {
          setRegisteringStaff(null);
          // Refresh attendance for the current reportDate to immediately reflect changes
          if (reportDate) {
            fetchAttendance(reportDate);
          }
        }}
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
                                  <p className="text-sm font-semibold text-slate-900 truncate">{formatNameLastFirst(entry.staff.name)}</p>
                                  {entry.isUpdate && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                      Update
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{entry.staff.employee_id}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 truncate">{entry.staff.trn}</p>
                                <p className="text-xs text-slate-400">{formatDayFirstDate(entry.dateSent)}</p>
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
                            <p className="text-sm text-slate-700">{entry.payslip.payDate ? formatDayFirstDate(entry.payslip.payDate) : 'Not listed'}</p>
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

      {showRetractModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              if (!isRetracting) {
                setShowRetractModal(false);
              }
            }}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:items-center">
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Retract Uploaded Payroll</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Select a saved pay date to retract from the portal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isRetracting) {
                    setShowRetractModal(false);
                  }
                }}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {retractablePayrollDates.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No uploaded payroll dates are available to retract.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                    Uploaded Pay Dates
                  </label>
                  <select
                    value={selectedRetractDate}
                    onChange={(e) => setSelectedRetractDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  >
                    <option value="">Select a pay date</option>
                    {retractablePayrollDates.map((entry) => (
                      <option key={entry.date} value={entry.date}>
                        {entry.date} ({entry.count} record{entry.count === 1 ? '' : 's'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRetractModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                disabled={isRetracting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetractUpload}
                disabled={!selectedRetractDate || isRetracting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-md shadow-slate-900/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isRetracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retracting...
                  </>
                ) : (
                  <>
                    <Undo2 className="w-4 h-4" />
                    Retract Selected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

