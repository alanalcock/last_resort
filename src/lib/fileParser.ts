export type PayslipLine = {
  label: string;
  currentAmount?: number | null;
  units?: number | null;
  ytdAmount?: number | null;
};

export type DeductionLine = {
  label: string;
  currentAmount?: number | null;
  ytdAmount?: number | null;
};

export type ParsedPayslipRecord = {
  kind: 'payslip';
  employeeName: string;
  department: string;
  trn: string;
  nisNumber: string;
  payDate: string;
  payPeriod: string;
  earnings: PayslipLine[];
  deductions: DeductionLine[];
  totalCurrent: number;
  totalYtd: number;
  deductionCurrent: number;
  deductionYtd: number;
  netPayCurrent: number;
  netPayYtd: number;
  vacationUsed?: number | null;
  benefits?: number | null;
  payeRefund?: number | null;
  rawRows: Array<Array<string | number | null>>;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed || trimmed === '***.**') {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const toCellValue = (value: unknown): string | number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return null;
};

const excelDateToIso = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  if (Number.isNaN(dateInfo.getTime())) {
    return '';
  }

  return dateInfo.toISOString().slice(0, 10);
};

const parseNameRow = (nameCell: string, trnCell: string, payDateCell: unknown) => {
  const nameMatch = nameCell.match(/^Name:\s*(.*?)(?:,\s*(.*))?$/i);
  const trnMatch = trnCell.match(/TRN:\s*([0-9]+)/i);
  const nisMatch = trnCell.match(/NIS:\s*([A-Z0-9]+)/i);

  return {
    employeeName: nameMatch?.[1]?.trim() ?? '',
    department: nameMatch?.[2]?.trim() ?? '',
    trn: trnMatch?.[1]?.trim() ?? '',
    nisNumber: nisMatch?.[1]?.trim() ?? '',
    payDate: excelDateToIso(payDateCell),
  };
};

const parsePayslipBlocks = (rows: unknown[][]): ParsedPayslipRecord[] => {
  const nameRowIndexes: number[] = [];

  rows.forEach((row, index) => {
    const nameCell = toText(row[0]);
    const trnCell = toText(row[4]);
    if (nameCell.startsWith('Name:') && trnCell.includes('TRN:')) {
      nameRowIndexes.push(index);
    }
  });

  return nameRowIndexes.map((startIndex, blockIndex) => {
    const endIndex = nameRowIndexes[blockIndex + 1] ?? rows.length;
    const blockRows = rows.slice(startIndex, endIndex);
    const rawStartIndex = Math.max(0, startIndex - 2);
    const rawEndIndex = nameRowIndexes[blockIndex + 1]
      ? Math.max(rawStartIndex, nameRowIndexes[blockIndex + 1] - 2)
      : rows.length;
    const rawRows = rows
      .slice(rawStartIndex, rawEndIndex)
      .map((row) => Array.from({ length: 7 }, (_, index) => toCellValue(row[index])));
    const nameRow = blockRows[0] ?? [];
    const totalsRow = blockRows.find((row) => toText(row[0]) === 'Total:') ?? [];
    const netPayRow = blockRows.find((row) => toText(row[0]) === 'Net Pay:') ?? [];
    const payPeriodRow = blockRows.find((row) => toText(row[0]).startsWith('Pay period:')) ?? [];

    const header = parseNameRow(toText(nameRow[0]), toText(nameRow[4]), nameRow[6]);
    const payPeriod = toText(payPeriodRow[0]).replace(/^Pay period:\s*/i, '');

    const earnings: PayslipLine[] = [];
    const deductions: DeductionLine[] = [];

    for (const row of blockRows.slice(3, 17)) {
      const earningLabel = toText(row[0]);
      const deductionLabel = toText(row[4]);

      if (earningLabel && earningLabel !== 'Total:' && earningLabel !== 'Net Pay:' && !earningLabel.startsWith('Pay period:')) {
        earnings.push({
          label: earningLabel,
          currentAmount: toNumber(row[1]),
          units: toNumber(row[2]),
          ytdAmount: toNumber(row[3]),
        });
      }

      if (deductionLabel && deductionLabel !== 'Vacation used' && deductionLabel !== 'Benefits' && deductionLabel !== 'PAYE Refund') {
        deductions.push({
          label: deductionLabel,
          currentAmount: toNumber(row[5]),
          ytdAmount: toNumber(row[6]),
        });
      }
    }

    return {
      kind: 'payslip' as const,
      employeeName: header.employeeName,
      department: header.department,
      trn: header.trn,
      nisNumber: header.nisNumber,
      payDate: header.payDate,
      payPeriod,
      earnings,
      deductions,
      totalCurrent: toNumber(totalsRow[1]) ?? 0,
      totalYtd: toNumber(totalsRow[3]) ?? 0,
      deductionCurrent: toNumber(totalsRow[5]) ?? 0,
      deductionYtd: toNumber(totalsRow[6]) ?? 0,
      netPayCurrent: toNumber(netPayRow[1]) ?? 0,
      netPayYtd: toNumber(netPayRow[3]) ?? 0,
      vacationUsed: toNumber(payPeriodRow[4]),
      benefits: toNumber(payPeriodRow[5]),
      payeRefund: toNumber(payPeriodRow[6]),
      rawRows,
    };
  }).filter((record) => Boolean(record.trn));
};

export const parsePayrollFile = async (file: File): Promise<ParsedPayslipRecord[] | any[]> => {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  if (isExcel) {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    const looksLikeStackedPayslips = rows.some((row) => {
      return toText(row[0]).startsWith('Name:') && toText(row[4]).includes('TRN:');
    });

    if (looksLikeStackedPayslips) {
      return parsePayslipBlocks(rows);
    }

    return XLSX.utils.sheet_to_json(worksheet);
  }

  const Papa = (await import('papaparse')).default;
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: any[] }) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
};
