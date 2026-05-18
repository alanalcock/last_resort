import React from 'react';
import { Shield, Key, User, Plus, X } from 'lucide-react';

interface Admin {
  id: string;
  staffId?: string;
  name: string;
  username: string;
  password?: string;
  role: string;
  isDefault: boolean;
}

interface AdminOptionsPanelProps {
  admins: Admin[];
  isAddingAdmin: boolean;
  setIsAddingAdmin: (val: boolean) => void;
  handlePromoteStaffToAdmin: (staffId: number, name: string, username: string) => Promise<void>;
  handleRemoveAdmin: (adminId: string) => Promise<void>;
  handleResetAdminPassword: (admin: Admin) => Promise<void>;
  staffList: any[];
}

export const AdminOptionsPanel: React.FC<AdminOptionsPanelProps> = ({
  admins,
  isAddingAdmin,
  setIsAddingAdmin,
  handlePromoteStaffToAdmin,
  handleRemoveAdmin,
  handleResetAdminPassword,
  staffList
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showDropdown, setShowDropdown] = React.useState(false);

  const filteredStaff = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return (staffList || []).filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.employee_id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, staffList]);

  return (
    <div className="flex-1 p-4 sm:p-8 bg-white animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">System Administrators</h2>
              <p className="text-xs text-slate-500 font-medium">Promote standard staff members to administrators with zero extra credentials required.</p>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchQuery('');
              setIsAddingAdmin(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Admin
          </button>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.map((admin) => (
            <div 
              key={admin.id}
              className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden group"
            >

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">
                      {admin.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{admin.name}</h3>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2 py-0.5 rounded">
                        {admin.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200/60 pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Username</span>
                    <span className="text-slate-900 font-bold font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{admin.username}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Password</span>
                    {admin.isDefault ? (
                      <span className="text-slate-900 font-bold font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{admin.password}</span>
                    ) : (
                      <span className="text-slate-500 font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 tracking-wider">
                        Standard Staff PW
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reset Password & Action Buttons */}
              <div className="border-t border-slate-200/60 mt-5 pt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleResetAdminPassword(admin)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-600 hover:text-white bg-white hover:bg-amber-600 border border-amber-250/65 hover:border-amber-600 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  <Key className="w-3.5 h-3.5" />
                  Reset Admin PW
                </button>
                
                {!admin.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(admin.id || String(admin.staffId) || '')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-white bg-white hover:bg-red-600 border border-slate-200 hover:border-red-600 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                  >
                    <X className="w-3.5 h-3.5" />
                    Revoke Admin Access
                  </button>
                ) : (
                  <span className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-[10px] font-bold text-slate-400 bg-slate-100/50 border border-dashed border-slate-200 rounded-lg cursor-not-allowed uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    Protected Account
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Admin Modal */}
        {isAddingAdmin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setIsAddingAdmin(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 z-[120] max-h-[92vh] flex flex-col">
              <div className="flex flex-col">
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex min-w-0 items-start sm:items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">Grant Admin Privilege</h3>
                      <p className="text-xs text-slate-500 font-medium">Search for an active staff member to promote.</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsAddingAdmin(false)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Search Existing Staff */}
                  <div className="relative space-y-1.5 pb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Search Existing Staff
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                        placeholder="Search by staff name or employee ID..."
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setShowDropdown(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 text-xs font-semibold border-0 bg-transparent p-0 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {showDropdown && filteredStaff.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 divide-y divide-slate-50">
                        {filteredStaff.map((staff) => {
                          const nameParts = String(staff.name || '').trim().split(/\s+/);
                          const firstName = nameParts[0] ? nameParts[0].toLowerCase() : '';
                          const empId = String(staff.employee_id || '').trim().toLowerCase();
                          const genUsername = `${firstName}${empId}`;
                          const isAlreadyAdmin = admins.some(a => !a.isDefault && String(a.staffId) === String(staff.id));

                          return (
                            <div
                              key={staff.id}
                              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-xs border-none bg-transparent hover:bg-slate-50 transition-all"
                            >
                              <div>
                                <span className="font-bold block text-slate-900">{staff.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">ID: {staff.employee_id || 'N/A'} • Username: {genUsername}</span>
                              </div>
                              
                              {isAlreadyAdmin ? (
                                <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">
                                  Already Admin
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePromoteStaffToAdmin(staff.id, staff.name, genUsername)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer shadow-sm hover:shadow"
                                >
                                  Give Admin Privilege
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {showDropdown && searchQuery && filteredStaff.length === 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 text-center text-xs text-slate-400 z-50 font-semibold">
                        No matching staff members found
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsAddingAdmin(false)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer animate-in fade-in"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
