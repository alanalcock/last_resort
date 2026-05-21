import type { ParsedPayslipRecord } from '@/lib/fileParser';
import type { AdminRecord, DeliveryLogRecord, StaffRecord } from '@/types/payroll';

export const DEFAULT_ADMINS: AdminRecord[] = [
  {
    id: 'default',
    username: 'admin',
    password: 'admin',
    name: 'Default Admin',
    role: 'System Owner',
    isDefault: true,
  },
];

export const normalizeTrn = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export const formatPayslipCell = (
  value: string | number | null | undefined,
  rowIndex: number,
  colIndex: number,
  payslip?: ParsedPayslipRecord,
) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (rowIndex === 2 && colIndex === 6 && payslip?.payDate) {
    return payslip.payDate;
  }

  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  return value;
};

export const mapStaffRecord = (staff: Partial<StaffRecord>): StaffRecord => ({
  id: Number(staff.id),
  name: staff.name || '',
  trn: staff.trn || null,
  nis_number: staff.nis_number || null,
  employee_id: staff.employee_id || null,
  dob: staff.dob || null,
  home_address: staff.home_address || null,
  employment_date: staff.employment_date || null,
  insurance: staff.insurance || null,
  insurance_expiry: staff.insurance_expiry || null,
  psra: staff.psra || null,
  psra_expiry: staff.psra_expiry || null,
  job_role: staff.job_role || null,
  email: staff.email || null,
  phone: staff.phone || null,
  status: staff.status || 'Employeed',
  password: staff.password || null,
  send_whatsapp: staff.send_whatsapp ?? null,
  send_email: staff.send_email ?? null,
});

export const mapDeliveryLogRecord = (log: any): DeliveryLogRecord => ({
  id: log.id,
  staffId: typeof log.staff_id === 'number' ? log.staff_id : typeof log.staffId === 'number' ? log.staffId : null,
  staffName: log.staff?.name || log.staffName || null,
  phone: log.staff?.phone || log.phone || null,
  email: log.staff?.email || log.email || null,
  dateSent: log.date_sent || log.dateSent || null,
  whatsappStatus: log.whatsapp_status || log.whatsappStatus || null,
  emailStatus: log.email_status || log.emailStatus || null,
  staffData: log.staff ? mapStaffRecord(log.staff) : log.staffData ? mapStaffRecord(log.staffData) : null,
  payslipData: log.payslip_data || log.payslipData || null,
  payslip_data: log.payslip_data || log.payslipData || null,
});

export const parseAdminsSetting = (settings: Array<{ key?: string; value?: string }> | null | undefined) => {
  if (!Array.isArray(settings)) {
    return DEFAULT_ADMINS;
  }

  const adminsValue = settings.find((setting) => setting.key === 'admins_list')?.value;
  if (!adminsValue) {
    return DEFAULT_ADMINS;
  }

  try {
    const parsed = JSON.parse(adminsValue);
    return Array.isArray(parsed) ? parsed : DEFAULT_ADMINS;
  } catch (error) {
    console.error('Error parsing admins list:', error);
    return DEFAULT_ADMINS;
  }
};
