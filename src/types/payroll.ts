import type { ParsedPayslipRecord } from '@/lib/fileParser';

export type StaffRecord = {
  id: number;
  name: string;
  trn: string | null;
  nis_number: string | null;
  employee_id: string | null;
  dob: string | null;
  home_address: string | null;
  employment_date: string | null;
  insurance: string | null;
  insurance_expiry: string | null;
  psra: string | null;
  psra_expiry: string | null;
  job_role: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  password?: string | null;
  send_whatsapp?: boolean | null;
  send_email?: boolean | null;
};

export type DeliveryLogRecord = {
  id: number | string;
  staffId: number | null;
  staffName: string | null;
  phone: string | null;
  email: string | null;
  dateSent: string | null;
  whatsappStatus: string | null;
  emailStatus: string | null;
  staffData?: StaffRecord | null;
  payslipData?: ParsedPayslipRecord | Record<string, unknown> | null;
  payslip_data?: ParsedPayslipRecord | Record<string, unknown> | null;
};

export type AdminRecord = {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: string;
  isDefault: boolean;
  staffId?: string;
};

export type PreviewBatchEntry = {
  id: string;
  staff: StaffRecord;
  payslip: ParsedPayslipRecord;
  dateSent: string;
  sendWhatsApp: boolean;
  isUpdate?: boolean;
  diffs?: string[];
};

export type UnmatchedPayslipEntry = {
  id: string;
  payslip: ParsedPayslipRecord;
};
