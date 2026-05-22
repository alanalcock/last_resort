import React, { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';

const ATTENDANCE_STATUSES = ['Present', 'Leave', 'Absent'] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
const PRESENT_TYPES = ['On Time', 'Late'] as const;
const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Maternity Leave', 'Unpaid Leave'] as const;

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

interface AttendanceRegistrationModalProps {
  staff: any;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
}

export const AttendanceRegistrationModal: React.FC<AttendanceRegistrationModalProps> = ({
  staff,
  onClose,
  onSuccess,
  defaultDate,
}) => {
  const [date, setDate] = useState(() => {
    if (defaultDate) return defaultDate;
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectingPresentType, setSelectingPresentType] = useState(false);
  const [selectingLeaveType, setSelectingLeaveType] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateAttendance = async (nextStatus: AttendanceStatus | '', options?: { presentType?: string; leaveType?: string }) => {
    if (!staff || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staff.id,
          date,
          status: nextStatus,
          present_type: options?.presentType || '',
          leave_type: options?.leaveType || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register attendance');
      }

      onSuccess();
    } catch (error) {
      console.error(error);
      alert('Unable to save attendance');
      setIsSubmitting(false);
    }
  };

  if (!staff) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">Set Attendance</h3>
          <p className="text-sm text-slate-500 font-medium">{staff.name}</p>
        </div>

        <div className="mt-4 mb-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-semibold text-slate-700"
            />
          </div>
        </div>

        <div className="grid gap-3">
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
                  void updateAttendance(status);
                }}
                disabled={isSubmitting}
                className={`inline-flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  attendanceStyles[status]
                } ${isSubmitting ? 'opacity-60' : ''}`}
              >
                <span className="flex flex-col items-start">
                  <span>{status}</span>
                  {status === 'Present' && (
                    <span className="mt-0.5 text-[11px] font-medium text-green-600/80">
                      On Time or Late
                    </span>
                  )}
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-bold relative">
                  {isSubmitting && !selectingPresentType && !selectingLeaveType ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : attendanceShortLabel[status]}
                </span>
              </button>

              {status === 'Present' && selectingPresentType && (
                <div className="ml-3 grid gap-2 border-l-2 border-green-200 pl-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Present Type</p>
                  {PRESENT_TYPES.map((presentType) => (
                    <button
                      key={presentType}
                      type="button"
                      onClick={() => void updateAttendance('Present', { presentType })}
                      disabled={isSubmitting}
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
                      onClick={() => void updateAttendance('Leave', { leaveType })}
                      disabled={isSubmitting}
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
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={() => void updateAttendance('')}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Clear Status / Unreported
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
