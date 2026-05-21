import type { ParsedPayslipRecord } from '@/lib/fileParser';
import { normalizeTrn } from '@/lib/payroll/utils';
import type { PreviewBatchEntry, StaffRecord, UnmatchedPayslipEntry } from '@/types/payroll';

type BuildPayrollPreviewOptions = {
  records: ParsedPayslipRecord[];
  staffList: StaffRecord[];
  deliveryByStaffDate: Map<string, any>;
  today: string;
};

type BuildPayrollPreviewResult = {
  previewEntries: PreviewBatchEntry[];
  unmatchedEntries: UnmatchedPayslipEntry[];
  matchedCount: number;
  skippedCount: number;
};

export const buildPayrollPreview = ({
  records,
  staffList,
  deliveryByStaffDate,
  today,
}: BuildPayrollPreviewOptions): BuildPayrollPreviewResult => {
  const staffByTrn = new Map(
    staffList
      .map((person) => [normalizeTrn(person.trn), person] as const)
      .filter(([trn]) => Boolean(trn)),
  );

  const matchedEntries: Array<{ staff: StaffRecord; payslip: ParsedPayslipRecord }> = [];
  const unmatchedEntries: UnmatchedPayslipEntry[] = [];

  records.forEach((record, index) => {
    const staff = staffByTrn.get(normalizeTrn(record.trn));
    if (!staff) {
      unmatchedEntries.push({
        id: `${normalizeTrn(record.trn) || 'missing-trn'}-${index}`,
        payslip: record,
      });
      return;
    }

    matchedEntries.push({ staff, payslip: record });
  });

  let skippedCount = 0;
  const previewEntries: PreviewBatchEntry[] = matchedEntries.flatMap(({ staff, payslip }) => {
    const targetDate = payslip.payDate || today;
    const existingLog = deliveryByStaffDate.get(`${staff.id}-${targetDate}`);

    let isUpdate = false;
    const diffs: string[] = [];

    if (existingLog) {
      const oldDataStr = JSON.stringify(existingLog.payslipData || existingLog.payslip_data || {});
      const newDataStr = JSON.stringify(payslip);

      if (oldDataStr === newDataStr) {
        skippedCount += 1;
        return [];
      }

      isUpdate = true;
      const oldData: any = existingLog.payslipData || existingLog.payslip_data || {};

      if (oldData.netPayCurrent !== payslip.netPayCurrent) {
        diffs.push(
          `Net Pay changed from $${Number(oldData.netPayCurrent || 0).toFixed(2)} to $${Number(payslip.netPayCurrent || 0).toFixed(2)}`,
        );
      }
      if (oldData.totalCurrent !== payslip.totalCurrent) {
        diffs.push(
          `Total Earnings changed from $${Number(oldData.totalCurrent || 0).toFixed(2)} to $${Number(payslip.totalCurrent || 0).toFixed(2)}`,
        );
      }
      if (oldData.deductionCurrent !== payslip.deductionCurrent) {
        diffs.push(
          `Total Deductions changed from $${Number(oldData.deductionCurrent || 0).toFixed(2)} to $${Number(payslip.deductionCurrent || 0).toFixed(2)}`,
        );
      }
      if (diffs.length === 0) {
        diffs.push('Minor breakdown changes detected');
      }
    }

    return [
      {
        id: isUpdate ? `updated-${staff.id}-${targetDate}` : `${staff.id}-${targetDate}`,
        staff,
        payslip,
        dateSent: targetDate,
        sendWhatsApp: Boolean(staff.phone && staff.send_whatsapp),
        isUpdate,
        diffs,
      },
    ];
  });

  return {
    previewEntries,
    unmatchedEntries,
    matchedCount: matchedEntries.length,
    skippedCount,
  };
};

