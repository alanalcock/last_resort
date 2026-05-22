import React from 'react';
import { Plus, Pencil, X, User, Hash, Phone, Save, Trash2 } from 'lucide-react';
import { formatEditableDayFirstDate } from '@/lib/payroll/utils';

const JOB_ROLE_OPTIONS = [
  'Administrative Staff',
  'Office Administrator',
  'HR Administrator',
  'Payroll Administrator',
  'Operations Administrator',
  'Accounts Administrator',
  'Executive Assistant',
  'Dispatcher',
  'Receptionist',
  'Armed Guard',
  'Unarmed Guard',
  'Caretaker',
];

const INSURANCE_OPTIONS = [
  'Sagicor Life',
  'Guardian Life',
  'Canopy Insurance',
  'Medecus',
];

const normalizeInsuranceCoverage = (value: string | null | undefined) => {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'no') return 'No';
  return 'Yes';
};

interface StaffEditModalProps {
  editingStaff: any;
  setEditingStaff: (val: any) => void;
  handleStaffSubmit: (e: React.FormEvent) => void;
  handleRemoveStaff?: () => void;
  isRemovingStaff?: boolean;
}

const ThreeFieldDateInput = ({ name, defaultValue }: { name: string; defaultValue?: string }) => {
  const [day, setDay] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [year, setYear] = React.useState('');

  React.useEffect(() => {
    if (defaultValue) {
      const parts = defaultValue.split('/');
      if (parts.length === 3) {
        setDay(parts[0]);
        setMonth(parts[1]);
        setYear(parts[2]);
      }
    }
  }, [defaultValue]);

  const combinedDate = (day && month && year) ? `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}` : '';

  return (
    <div className="flex items-center gap-2 w-full">
      <input type="hidden" name={name} value={combinedDate} />
      <input 
        type="text" 
        inputMode="numeric"
        placeholder="DD" 
        value={day} 
        onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
        className="flex-1 min-w-0 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
      />
      <span className="text-slate-300 font-bold">/</span>
      <input 
        type="text" 
        inputMode="numeric"
        placeholder="MM" 
        value={month} 
        onChange={e => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
        className="flex-1 min-w-0 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
      />
      <span className="text-slate-300 font-bold">/</span>
      <input 
        type="text" 
        inputMode="numeric"
        placeholder="YYYY" 
        value={year} 
        onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="flex-[1.5] min-w-0 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
      />
    </div>
  );
};

export const StaffEditModal: React.FC<StaffEditModalProps> = ({
  editingStaff,
  setEditingStaff,
  handleStaffSubmit,
  handleRemoveStaff,
  isRemovingStaff = false,
}) => {
  if (!editingStaff) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setEditingStaff(null)}
      />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 max-h-[92vh] flex flex-col">
        <form onSubmit={handleStaffSubmit} className="flex flex-col min-h-0 overflow-hidden">
          {/* Modal Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex min-w-0 items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                {editingStaff.id === 'new' ? <Plus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {editingStaff.id === 'new' ? 'Add Staff Member' : 'Edit Staff Member'}
                </h3>
                {editingStaff.id !== 'new' && (
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Member ID: {editingStaff.id}</p>
                )}
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setEditingStaff(null)}
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="firstName"
                    required
                    defaultValue={editingStaff.name ? editingStaff.name.split(' ')[0] : ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="lastName"
                    required
                    defaultValue={editingStaff.name && editingStaff.name.includes(' ') ? editingStaff.name.split(' ').slice(1).join(' ') : ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Employee ID</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="employee_id"
                    required
                    defaultValue={editingStaff.employee_id}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="phone"
                    required
                    defaultValue={editingStaff.phone}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">TRN Number</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="trn"
                    required
                    defaultValue={editingStaff.trn}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">NIS Number</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="nis_number"
                    required
                    defaultValue={editingStaff.nis_number}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
            </div>



            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label>
              <ThreeFieldDateInput 
                name="dob" 
                defaultValue={formatEditableDayFirstDate(editingStaff.dob)} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Home Address</label>
              <textarea 
                name="home_address"
                rows={3}
                defaultValue={editingStaff.home_address || ''}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Employment</label>
                <ThreeFieldDateInput 
                  name="employment_date" 
                  defaultValue={formatEditableDayFirstDate(editingStaff.employment_date)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Employee Status</label>
                <select
                  name="status"
                  defaultValue={editingStaff.status || 'Full-Time'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Job Role</label>
                <select
                  name="job_role"
                  defaultValue={editingStaff.job_role || ''}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                >
                  <option value="">Select job role</option>
                  {JOB_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  {editingStaff.job_role && !JOB_ROLE_OPTIONS.includes(editingStaff.job_role) && (
                    <option value={editingStaff.job_role}>{editingStaff.job_role}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Insurance</label>
                <select
                  name="insurance"
                  defaultValue={editingStaff.insurance || ''}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                >
                  <option value="">Select insurance provider</option>
                  {INSURANCE_OPTIONS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                  {editingStaff.insurance && !INSURANCE_OPTIONS.includes(editingStaff.insurance) && (
                    <option value={editingStaff.insurance}>{editingStaff.insurance}</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Insurance Coverage</label>
                <select
                  name="insurance_expiry"
                  defaultValue={normalizeInsuranceCoverage(editingStaff.insurance_expiry)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                >
                  <option value="">Select coverage</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">PSRA ID</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="psra"
                    defaultValue={editingStaff.psra || ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">PSRA Expiry</label>
                <ThreeFieldDateInput 
                  name="psra_expiry" 
                  defaultValue={formatEditableDayFirstDate(editingStaff.psra_expiry)} 
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">
              {editingStaff.id !== 'new' && handleRemoveStaff ? (
                <button
                  type="button"
                  onClick={handleRemoveStaff}
                  disabled={isRemovingStaff}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  {isRemovingStaff ? 'Removing...' : 'Remove Staff'}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <button 
                type="button"
                onClick={() => setEditingStaff(null)}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 bg-slate-900 text-white rounded-lg font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                {editingStaff.id === 'new' ? 'Add Profile' : 'Update Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
