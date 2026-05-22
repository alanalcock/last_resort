'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useStaffProfileData } from '@/hooks/useStaffProfileData';
import { formatDayFirstDate, formatPayslipCell, formatNameLastFirst, normalizeDateInputToIso } from '@/lib/payroll/utils';
import { StaffEditModal } from '@/components/staff/StaffEditModal';
import { handleDownloadPDF } from '@/lib/pdfGenerator';
import { type ParsedPayslipRecord } from '@/lib/fileParser';
import type { StaffRecord } from '@/types/payroll';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Download, FileText, Loader2, Pencil, Users } from 'lucide-react';

const ATTENDANCE_STATUSES = ['Present', 'Leave', 'Absent'] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
type AttendanceEntry = { status: AttendanceStatus; presentType?: string | null; leaveType?: string | null };
const PRESENT_TYPES = ['On Time', 'Late'] as const;
const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Maternity Leave', 'Unpaid Leave'] as const;

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildCalendarDays = (monthDate: Date) => {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
};

const attendanceStyles: Record<string, string> = {
  Present: 'border-green-200 bg-green-50 text-green-700',
  Absent: 'border-red-200 bg-red-50 text-red-700',
  Leave: 'border-amber-200 bg-amber-50 text-amber-700',
};

const attendanceShortLabel: Record<string, string> = {
  Present: 'P',
  Absent: 'A',
  Leave: 'L',
};

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
    return { label: 'Expired', className: 'border-red-200 bg-red-50 text-red-700' };
  } else if (diffDays <= 14) {
    return { label: `${diffDays}d left`, className: 'border-red-200 bg-red-50 text-red-700' };
  } else if (diffDays <= 30) {
    return { label: `${diffDays}d left`, className: 'border-amber-200 bg-amber-50 text-amber-700' };
  } else {
    return { label: 'Active', className: 'border-green-200 bg-green-50 text-green-700' };
  }
};

const getInsuranceCoverageValue = (value: string | null | undefined) => {
  if (!value) return 'None';
  const normalized = value.trim().toLowerCase();
  return normalized === 'no' ? 'No' : 'Yes';
};

const getEmployeeStatusBadge = (value: string | null | undefined) => {
  const normalized = (value || 'Full-Time').trim();

  if (normalized === 'Terminated') {
    return {
      label: 'Terminated',
      className: 'border-red-200/60 bg-red-50 text-red-700',
    };
  }

  if (normalized === 'Part-Time') {
    return {
      label: 'Part-Time',
      className: 'border-amber-200/60 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: normalized === 'Full-Time' ? 'Full-Time' : normalized,
    className: 'border-green-200/50 bg-green-50 text-green-700',
  };
};

export default function StaffProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const staffId = Number(params.id);

  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [isRemovingStaff, setIsRemovingStaff] = useState(false);
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [attendanceLogs, setAttendanceLogs] = useState<Record<string, AttendanceEntry>>({});
  const [savingAttendanceDate, setSavingAttendanceDate] = useState<string | null>(null);
  const [attendanceDialogDate, setAttendanceDialogDate] = useState<string | null>(null);
  const [selectingPresentType, setSelectingPresentType] = useState(false);
  const [selectingLeaveType, setSelectingLeaveType] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<{ staffData: any; payslip?: ParsedPayslipRecord } | null>(null);
  const handleUnauthorized = useCallback(() => {
    router.replace('/login');
  }, [router]);
  const {
    staff,
    setStaff,
    deliveryLogs,
    setDeliveryLogs,
    isLoading,
    error,
  } = useStaffProfileData(staffId, handleUnauthorized);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!staff) {
        return;
      }

      try {
        const monthKey = formatMonthKey(attendanceMonth);
        const response = await fetch(`/api/attendance?staffId=${staff.id}&month=${monthKey}`);
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data?.error || 'Unable to load attendance.');
        }

        const lookup = data.reduce<Record<string, AttendanceEntry>>((acc, entry) => {
          if (entry?.date && entry?.status) {
            acc[String(entry.date)] = {
              status: entry.status as AttendanceStatus,
              presentType: entry.present_type || null,
              leaveType: entry.leave_type || null,
            };
          }
          return acc;
        }, {});

        setAttendanceLogs(lookup);
      } catch (attendanceError) {
        console.error('Attendance load error:', attendanceError);
        setAttendanceLogs({});
      }
    };

    void fetchAttendance();
  }, [attendanceMonth, staff]);

  const staffLogs = useMemo(() => {
    if (!staff) {
      return [];
    }

    return deliveryLogs.filter((log) => log.staffId === staff.id);
  }, [deliveryLogs, staff]);

  const calendarDays = useMemo(() => buildCalendarDays(attendanceMonth), [attendanceMonth]);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingStaff) {
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const firstName = formData.get('firstName') as string || '';
    const lastName = formData.get('lastName') as string || '';
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const updatedStaffData = {
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
      email: editingStaff.email || null,
      phone: formData.get('phone') as string,
      status: (formData.get('status') as string) || editingStaff.status || 'Full-Time',
      send_whatsapp: editingStaff.send_whatsapp ?? !!(formData.get('phone') as string)?.trim(),
      send_email: editingStaff.send_email ?? false,
    };

    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedStaffData, id: editingStaff.id }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to update staff.');
      }

      const nextStaff = { ...staff, ...result };
      setStaff(nextStaff);
      setDeliveryLogs((prev) =>
        prev.map((log) =>
          log.staffId === editingStaff.id
            ? {
                ...log,
                staffName: nextStaff.name,
                phone: nextStaff.phone,
                email: nextStaff.email,
                staffData: {
                  ...(log.staffData || {}),
                  ...nextStaff,
                },
              }
            : log,
        ),
      );
      setEditingStaff(null);
    } catch (submitError) {
      console.error('Staff update error:', submitError);
    }
  };

  const handleRemoveStaff = async () => {
    if (!editingStaff || editingStaff.id === undefined || editingStaff.id === null) {
      return;
    }

    const staffIdToRemove = Number(editingStaff.id);
    const confirmed = window.confirm(
      `Remove ${editingStaff.name || 'this staff member'}? This will also remove their attendance, portal payslip logs, and saved payslip records.`,
    );

    if (!confirmed) {
      return;
    }

    setIsRemovingStaff(true);

    try {
      const response = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staffIdToRemove }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to remove staff.');
      }

      setEditingStaff(null);
      router.replace('/');
    } catch (removeError) {
      console.error('Remove staff error:', removeError);
    } finally {
      setIsRemovingStaff(false);
    }
  };

  const updateAttendance = async (
    dateKey: string,
    nextStatus: AttendanceStatus | '',
    options?: { presentType?: string; leaveType?: string },
  ) => {
    if (!staff || savingAttendanceDate) {
      return;
    }

    setSavingAttendanceDate(dateKey);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staff.id,
          date: dateKey,
          status: nextStatus,
          present_type: options?.presentType || '',
          leave_type: options?.leaveType || '',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to save attendance.');
      }

      setAttendanceLogs((prev) => {
        const next = { ...prev };
        if (!nextStatus) {
          delete next[dateKey];
        } else {
          next[dateKey] = {
            status: nextStatus as AttendanceStatus,
            presentType: nextStatus === 'Present' ? options?.presentType || null : null,
            leaveType: nextStatus === 'Leave' ? options?.leaveType || null : null,
          };
        }
        return next;
      });
    } catch (saveError) {
      console.error('Attendance save error:', saveError);
    } finally {
      setSavingAttendanceDate(null);
      setAttendanceDialogDate(null);
      setSelectingPresentType(false);
      setSelectingLeaveType(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          Loading staff profile...
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">Profile Unavailable</h1>
            <p className="text-sm text-slate-500">{error || 'This staff profile could not be loaded.'}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const displayPsraExpiry = staff.psra_expiry;
  const employeeStatus = getEmployeeStatusBadge(staff.status);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to staff list
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 break-words">{formatNameLastFirst(staff.name)}</h1>
          </div>
          <div className="shrink-0 sm:text-right">
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-400 shadow-md animate-in fade-in duration-300">
              Employee ID <span className="text-base font-extrabold text-white">{staff.employee_id}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Profile Details</h2>
              <button
                type="button"
                onClick={() => setEditingStaff(staff)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TRN Number</p>
                <p className="text-sm font-semibold text-slate-800">{staff.trn || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NIS Number</p>
                <p className="text-sm font-semibold text-slate-800">{staff.nis_number || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</p>
                <p className="text-sm font-semibold text-slate-800">{staff.phone || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Email</p>
                <p className="text-sm font-semibold text-slate-800 break-all">{staff.email || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date of Birth</p>
                <p className="text-sm font-semibold text-slate-800">{formatDayFirstDate(staff.dob)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date of Employment</p>
                <p className="text-sm font-semibold text-slate-800">{formatDayFirstDate(staff.employment_date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insurance</p>
                <p className="text-sm font-semibold text-slate-800">{staff.insurance || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insurance Coverage</p>
                <p className="text-sm font-semibold text-slate-800">{getInsuranceCoverageValue(staff.insurance_expiry)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PSRA ID</p>
                <p className="text-sm font-semibold text-slate-800">{staff.psra || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PSRA Expiry</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{formatDayFirstDate(displayPsraExpiry)}</p>
                  {(() => {
                    const status = getExpiryStatus(displayPsraExpiry);
                    return status ? (
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${status.className}`}>
                        {status.label}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Role</p>
                <p className="text-sm font-semibold text-slate-800">{staff.job_role || 'None'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                <div className="mt-1">
                  <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${employeeStatus.className}`}>
                    {employeeStatus.label}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Home Address</p>
                <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{staff.home_address || 'None'}</p>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Attendance</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAttendanceMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[150px] text-center text-sm font-semibold text-slate-800">
                    {monthLabelFormatter.format(attendanceMonth)}
                  </div>
                  <button
                    onClick={() => setAttendanceMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {day}
                  </div>
                ))}
                {calendarDays.map((date) => {
                  const dateKey = formatDateKey(date);
                  const entry = attendanceLogs[dateKey];
                  const status = entry?.status;
                  const isCurrentMonth = date.getMonth() === attendanceMonth.getMonth();
                  const isToday = dateKey === formatDateKey(new Date());
                  const isSaving = savingAttendanceDate === dateKey;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setAttendanceDialogDate(dateKey)}
                      disabled={!isCurrentMonth || isSaving}
                      className={`relative flex min-h-[72px] flex-col items-start rounded-xl border px-2 py-2 text-left transition-colors ${
                        !isCurrentMonth
                          ? 'border-transparent bg-slate-50 text-slate-300'
                          : status
                            ? attendanceStyles[status]
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      } ${isToday ? 'ring-2 ring-slate-900/10' : ''} ${isSaving ? 'opacity-60' : ''}`}
                    >
                      <span className="text-xs font-bold">{date.getDate()}</span>
                      <span className="mt-2 text-[11px] font-semibold">
                        {status
                          ? status === 'Present' && entry?.presentType
                            ? entry.presentType
                            : status === 'Leave' && entry?.leaveType
                              ? entry.leaveType
                              : status
                          : ''}
                      </span>
                      {isSaving && <Loader2 className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Payslip</h2>
            <div className="mt-4">
              {staffLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No Payslips Found</p>
                  <p className="mt-1 text-xs text-slate-400">
                    No payslip records have been published to the portal for this employee yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {staffLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-800">{formatDayFirstDate(log.dateSent)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          <span>
                            Channel:{' '}
                            <span className="font-semibold text-slate-700">{log.phone ? 'Portal / WhatsApp' : 'Portal'}</span>
                          </span>
                          <span className="text-slate-300">&bull;</span>
                          <span>
                            Status: <span className="font-semibold text-green-600">Published</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          onClick={() =>
                            setPreviewInvoice({
                              staffData: staff,
                              payslip: (log.payslip_data as ParsedPayslipRecord | undefined) || undefined,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(staff, (log.payslip_data as ParsedPayslipRecord | undefined) || undefined)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          </div>
        </div>
      </div>

      {previewInvoice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setPreviewInvoice(null)}
          />
          <div className="relative h-[92vh] w-full max-w-4xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:items-center">
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 sm:text-lg">Payslip Preview</h3>
                  <p className="break-words text-xs font-medium text-slate-500">
                    {previewInvoice.payslip?.employeeName || formatNameLastFirst(previewInvoice.staffData.name)}
                    {previewInvoice.payslip?.department ? ` - ${previewInvoice.payslip.department}` : ''}
                  </p>
                </div>
              </div>

            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <div className="min-h-full w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                <div className="mx-auto min-w-full max-w-5xl overflow-x-auto border border-slate-200 bg-white">
                  {previewInvoice.payslip?.rawRows && previewInvoice.payslip.rawRows.length > 0 ? (
                    <div className="min-w-[750px]">
                      {previewInvoice.payslip.rawRows.map((row: any[], rowIndex: number) => {
                        const rowText = row.map((cell) => formatPayslipCell(cell, rowIndex, 0, previewInvoice.payslip)).join(' ').trim();
                        const isCompany = rowText === 'LAST   RESORT  DETECTIVE   AGENCY  LIMITED';
                        const isHeader = row[0] === 'Earnings';
                        const isTotal = row[0] === 'Total:' || row[0] === 'Net Pay:';

                        if (isCompany) {
                          return (
                            <div key={rowIndex} className="border-b border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-900">
                              LAST   RESORT  DETECTIVE   AGENCY  LIMITED
                            </div>
                          );
                        }

                        return (
                          <div
                            key={rowIndex}
                            className={`grid min-h-8 grid-cols-[1.7fr_0.9fr_0.55fr_0.9fr_1.35fr_0.9fr_0.9fr] border-b border-slate-100 text-[11px] ${
                              isHeader
                                ? 'bg-slate-100 font-bold text-slate-900'
                                : isTotal
                                  ? 'bg-slate-50 font-bold text-slate-900'
                                  : 'text-slate-700'
                            }`}
                          >
                            {Array.from({ length: 7 }, (_, colIndex) => {
                              const value = formatPayslipCell(row[colIndex], rowIndex, colIndex, previewInvoice.payslip);
                              const isNumeric = value !== '' && !Number.isNaN(Number(String(value).replace(/,/g, '')));

                              return (
                                <div
                                  key={colIndex}
                                  className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${isNumeric ? 'text-right tabular-nums' : ''}`}
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
                    <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                      {Object.entries(previewInvoice.payslip || {})
                        .filter(([key, value]) => key !== 'kind' && typeof value !== 'object')
                        .map(([key, value], idx) => (
                          <div key={idx} className="border-b border-slate-100 px-4 py-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{key}</p>
                            <p className="text-sm font-semibold text-slate-900">{String(value)}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
              <p className="max-w-xl text-xs font-medium italic text-slate-400">
                Original payslip rows from the spreadsheet. TRN is only used for matching.
              </p>
              <button
                onClick={() => handleDownloadPDF(previewInvoice.staffData, previewInvoice.payslip)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-800 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {attendanceDialogDate && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
            onClick={() => setAttendanceDialogDate(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Set Attendance</h3>
              <p className="text-sm text-slate-500">{attendanceDialogDate}</p>
            </div>

            <div className="mt-4 grid gap-3">
              {ATTENDANCE_STATUSES.map((status) => (
                <div key={status} className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (status === 'Present') {
                        setSelectingPresentType(true);
                        setSelectingLeaveType(false);
                        return;
                      }
                      if (status === 'Leave') {
                        setSelectingLeaveType(true);
                        setSelectingPresentType(false);
                        return;
                      }
                      void updateAttendance(attendanceDialogDate, status);
                    }}
                    disabled={savingAttendanceDate === attendanceDialogDate}
                    className={`inline-flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      attendanceStyles[status]
                    }`}
                  >
                    <span className="flex flex-col items-start">
                      <span>{status}</span>
                      {status === 'Present' && (
                        <span className="mt-0.5 text-[11px] font-medium text-green-600/80">
                          On Time or Late
                        </span>
                      )}
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-bold">
                      {attendanceShortLabel[status]}
                    </span>
                  </button>

                  {status === 'Present' && selectingPresentType && (
                    <div className="ml-3 grid gap-2 border-l-2 border-green-200 pl-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Present Type</p>
                      {PRESENT_TYPES.map((presentType) => (
                        <button
                          key={presentType}
                          type="button"
                          onClick={() => void updateAttendance(attendanceDialogDate, 'Present', { presentType })}
                          disabled={savingAttendanceDate === attendanceDialogDate}
                          className="inline-flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
                        >
                          <span>{presentType}</span>
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-bold">
                            P
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {status === 'Leave' && selectingLeaveType && (
                    <div className="ml-3 grid gap-2 border-l-2 border-amber-200 pl-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Leave Type</p>
                      {LEAVE_TYPES.map((leaveType) => (
                        <button
                          key={leaveType}
                          type="button"
                          onClick={() => void updateAttendance(attendanceDialogDate, 'Leave', { leaveType })}
                          disabled={savingAttendanceDate === attendanceDialogDate}
                          className="inline-flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          <span>{leaveType}</span>
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-bold">
                            L
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {(selectingPresentType || selectingLeaveType) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectingPresentType(false);
                    setSelectingLeaveType(false);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={() => void updateAttendance(attendanceDialogDate, '')}
                disabled={savingAttendanceDate === attendanceDialogDate}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Clear Status
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAttendanceDialogDate(null);
                  setSelectingPresentType(false);
                  setSelectingLeaveType(false);
                }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <StaffEditModal
        editingStaff={editingStaff}
        setEditingStaff={setEditingStaff}
        handleStaffSubmit={handleStaffSubmit}
        handleRemoveStaff={handleRemoveStaff}
        isRemovingStaff={isRemovingStaff}
      />
    </div>
  );
}
