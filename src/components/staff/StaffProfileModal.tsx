import React from 'react';
import { Users, X, FileText, Calendar, Download } from 'lucide-react';

interface StaffProfileModalProps {
  activeStaffDetails: any;
  setActiveStaffDetails: (val: any) => void;
  deliveryLogs: any[];
  handlePreviewBatchView: (staff: any, parsedPayslip: any) => void;
  handleDownloadPDF: (staff: any, parsedPayslip: any) => void;
}

export const StaffProfileModal: React.FC<StaffProfileModalProps> = ({
  activeStaffDetails,
  setActiveStaffDetails,
  deliveryLogs,
  handlePreviewBatchView,
  handleDownloadPDF
}) => {
  const staffLogs = React.useMemo(() => {
    if (!activeStaffDetails) {
      return [];
    }

    return deliveryLogs.filter(log => log.staffId === activeStaffDetails.id);
  }, [activeStaffDetails, deliveryLogs]);

  if (!activeStaffDetails) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setActiveStaffDetails(null)}
      />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 flex flex-col max-h-[92vh] sm:max-h-[85vh] z-[120]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex min-w-0 items-start sm:items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 break-words">{activeStaffDetails.name}</h3>
              <p className="text-xs text-slate-500 font-medium">
                Employee ID: <span className="font-bold text-slate-700">#{activeStaffDetails.employee_id}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveStaffDetails(null)}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Profile Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-lg">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TRN Number</p>
              <p className="text-sm font-semibold text-slate-800 tracking-wide uppercase">{activeStaffDetails.trn || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIS Number</p>
              <p className="text-sm font-semibold text-slate-800 tracking-wide uppercase">{activeStaffDetails.nis_number || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Email</p>
              <p className="text-sm font-semibold text-slate-800 truncate" title={activeStaffDetails.email}>{activeStaffDetails.email || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
              <p className="text-sm font-semibold text-slate-800">{activeStaffDetails.phone || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joined Date</p>
              <p className="text-sm font-semibold text-slate-800">{activeStaffDetails.joinedDate || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
              <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                activeStaffDetails.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200/50' : 'bg-amber-50 text-amber-700 border border-amber-250/50'
              }`}>
                {activeStaffDetails.status}
              </span>
            </div>
          </div>

          {/* Historical Payslips Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Historical Payslips</h4>
            {(() => {
              if (staffLogs.length === 0) {
                return (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No Payslips Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">No payslip records have been published to the portal for this employee yet.</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white overflow-hidden">
                  {staffLogs.map((log) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50/50 transition-colors border-b sm:border-b-0 last:border-b-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-800">{log.dateSent}</span>
                        </div>
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-slate-500">
                            Channel: <span className="font-semibold text-slate-700">{log.phone ? 'Portal / WhatsApp' : 'Portal'}</span>
                          </span>
                          <span className="text-slate-300">&bull;</span>
                          <span className="text-slate-500">
                            Status: <span className="font-semibold text-green-600">Published</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <button
                          onClick={() => {
                            handlePreviewBatchView(activeStaffDetails, log.payslip_data || {});
                          }}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(activeStaffDetails, log.payslip_data || {})}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button 
            onClick={() => setActiveStaffDetails(null)}
            className="w-full sm:w-auto px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
          >
            Close Portal Profile
          </button>
        </div>
      </div>
    </div>
  );
};
