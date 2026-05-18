import React from 'react';
import { Plus, Pencil, X, User, Hash, Phone, Save } from 'lucide-react';

interface StaffEditModalProps {
  editingStaff: any;
  setEditingStaff: (val: any) => void;
  handleStaffSubmit: (e: React.FormEvent) => void;
}

export const StaffEditModal: React.FC<StaffEditModalProps> = ({
  editingStaff,
  setEditingStaff,
  handleStaffSubmit
}) => {
  if (!editingStaff) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setEditingStaff(null)}
      />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 max-h-[92vh] flex flex-col">
        <form onSubmit={handleStaffSubmit} className="flex flex-col">
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
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Member ID: #{editingStaff.id}</p>
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
          <div className="p-4 sm:p-8 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    name="name"
                    required
                    defaultValue={editingStaff.name}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
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

          {/* Modal Footer */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
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
        </form>
      </div>
    </div>
  );
};
