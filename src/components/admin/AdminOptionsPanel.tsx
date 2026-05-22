import React from 'react';
import { Shield, Key, User, Plus, X } from 'lucide-react';

interface Admin {
  id: string | number;
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
  handlePromoteStaffToAdmin: (name: string, username: string) => Promise<void>;
  handleRemoveAdmin: (adminId: string | number) => Promise<void>;
  handleResetAdminPassword: (admin: Admin) => Promise<void>;
}

export const AdminOptionsPanel: React.FC<AdminOptionsPanelProps> = ({
  admins,
  isAddingAdmin,
  setIsAddingAdmin,
  handlePromoteStaffToAdmin,
  handleRemoveAdmin,
  handleResetAdminPassword
}) => {
  const [fullName, setFullName] = React.useState('');
  const [customUsername, setCustomUsername] = React.useState('');

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
          {admins.map((admin, idx) => (
            <div 
              key={admin.id || admin.username || `admin-${idx}`}
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
                      <span className="text-slate-900 font-bold font-mono bg-white px-2 py-0.5 rounded border border-slate-200 select-none">
                        ••••••••
                      </span>
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
                {!admin.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleResetAdminPassword(admin)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-600 hover:text-white bg-white hover:bg-amber-600 border border-amber-250/65 hover:border-amber-600 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Reset Admin PW
                  </button>
                ) : (
                  <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold text-slate-400 bg-slate-100/50 border border-dashed border-slate-200 rounded-lg cursor-not-allowed uppercase tracking-wider">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    Reset Password Disabled
                  </span>
                )}
                
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
              onClick={() => {
                setIsAddingAdmin(false);
                setFullName('');
                setCustomUsername('');
              }}
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
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">Add New Administrator</h3>
                      <p className="text-xs text-slate-500 font-medium">Create a brand new administrator account.</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddingAdmin(false);
                      setFullName('');
                      setCustomUsername('');
                    }}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Administrator Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          const nameVal = e.target.value;
                          setFullName(nameVal);
                          // Auto-generate username from name: lowercase and strip spaces
                          const genUsername = nameVal.trim().toLowerCase().replace(/\s+/g, '');
                          setCustomUsername(genUsername);
                        }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                        placeholder="e.g. John Doe"
                        required
                      />
                    </div>
                  </div>

                  {/* Assign Admin Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                      Assign Admin Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-mono"
                        placeholder="username"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                      💡 The new admin will sign in using this username and the default password <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-slate-900">admin</code>. Upon their first login, they will be prompted to choose a new secure password.
                    </p>
                  </div>

                  {/* Creation Action */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!fullName.trim() || !customUsername.trim()}
                      onClick={async () => {
                        if (!fullName.trim()) {
                          alert('Please specify a valid full name.');
                          return;
                        }
                        if (!customUsername.trim()) {
                          alert('Please specify a valid username.');
                          return;
                        }
                        await handlePromoteStaffToAdmin(fullName.trim(), customUsername.trim());
                        setFullName('');
                        setCustomUsername('');
                        setIsAddingAdmin(false);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 disabled:bg-slate-200 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer"
                    >
                      Confirm & Create Admin
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAdmin(false);
                      setFullName('');
                      setCustomUsername('');
                    }}
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
