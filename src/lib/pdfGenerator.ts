import type { ParsedPayslipRecord } from './fileParser';

const formatCellValue = (value: string | number | null | undefined, rowIndex?: number, colIndex?: number, payslip?: ParsedPayslipRecord) => {
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

const sanitizePdfFilename = (value: unknown, fallback: string) => {
  const name = String(value || fallback)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return name || fallback;
};

const getSafePdfFilename = (filename: string) => {
  const baseName = filename.toLowerCase().endsWith('.pdf') ? filename.slice(0, -4) : filename;
  return `${sanitizePdfFilename(baseName, 'payslip')}.pdf`;
};

const createPdfFile = (doc: any, filename: string) => {
  const safeFilename = getSafePdfFilename(filename);
  const buffer = doc.output('arraybuffer');

  return new File([buffer], safeFilename, { type: 'application/pdf' });
};

const downloadPdfFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');

  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  link.type = 'application/pdf';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const downloadPdfDocument = (doc: any, filename: string) => {
  downloadPdfFile(createPdfFile(doc, filename));
};

const drawSpreadsheetPayslip = (doc: any, payslip: ParsedPayslipRecord) => {
  const rows = payslip.rawRows ?? [];
  const left = 10;
  const top = 10;
  const rowHeight = 7.4;
  const colWidths = [58, 32, 18, 32, 48, 32, 32];
  const tableWidth = colWidths.reduce((total, width) => total + width, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let y = top;

  rows.forEach((row, rowIndex) => {
    const rowText = row.map((cell) => formatCellValue(cell)).join(' ').trim();
    const isCompany = rowText === 'LAST   RESORT  DETECTIVE   AGENCY  LIMITED';
    const isHeader = row[0] === 'Earnings';
    const isTotal = row[0] === 'Total:' || row[0] === 'Net Pay:';

    if (isCompany) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LAST   RESORT  DETECTIVE   AGENCY  LIMITED', left + tableWidth / 2, y + 5, { align: 'center' });
      y += rowHeight;
      return;
    }

    if (isHeader || isTotal) {
      doc.setFillColor(isHeader ? 241 : 248, isHeader ? 245 : 250, isHeader ? 249 : 252);
      doc.rect(left, y, tableWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }

    doc.setDrawColor(220);
    doc.line(left, y + rowHeight, left + tableWidth, y + rowHeight);

    let x = left;
    colWidths.forEach((width, colIndex) => {
      const value = formatCellValue(row[colIndex], rowIndex, colIndex, payslip);
      const alignRight = colIndex > 0 && value !== '' && !Number.isNaN(Number(String(value).replace(/,/g, '')));

      if (value) {
        doc.text(String(value), alignRight ? x + width - 2 : x + 2, y + 5, {
          align: alignRight ? 'right' : 'left',
          maxWidth: width - 4,
        });
      }

      x += width;
    });

    y += rowHeight;
  });
};

const drawFallbackPayslip = (doc: any, staff: any) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PAYSLIP', 140, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Employee: ${staff.name}`, 20, 40);
  doc.text(`Employee ID: ${staff.employee_id}`, 20, 48);
  doc.text(`TRN: ${staff.trn}`, 20, 56);
};

export const generatePDFDocument = async (staff: any, payslip?: ParsedPayslipRecord) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  if (payslip?.rawRows?.length) {
    drawSpreadsheetPayslip(doc, payslip);
    return doc;
  }

  drawFallbackPayslip(doc, staff);

  return doc;
};

export const getPayslipFilename = (staff: any, payslip?: any) => {
  const namePart = String(staff?.name || 'employee')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const rawDate = payslip?.payDate || payslip?.dateSent || payslip?.date_sent || '';
  const datePart = String(rawDate || new Date().toISOString().split('T')[0])
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  return getSafePdfFilename(`${namePart}_${datePart}`);
};

export const getBatchPayslipFilename = (
  entries: Array<{ dateSent?: string }>
) => {
  const batchDate = sanitizePdfFilename(entries[0]?.dateSent || new Date().toISOString().split('T')[0], 'batch');
  return getSafePdfFilename(`Payslip_Batch_${batchDate}`);
};

export const generatePDFArrayBuffer = async (staff: any, payslip?: ParsedPayslipRecord): Promise<ArrayBuffer> => {
  const doc = await generatePDFDocument(staff, payslip);
  return doc.output('arraybuffer');
};

export const generateBatchPDFArrayBuffer = async (
  entries: Array<{ staff: any; payslip?: ParsedPayslipRecord; dateSent?: string }>
): Promise<ArrayBuffer> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  entries.forEach((entry, index) => {
    if (index > 0) {
      doc.addPage('letter', 'landscape');
    }

    if (entry.payslip?.rawRows?.length) {
      drawSpreadsheetPayslip(doc, entry.payslip);
      return;
    }

    drawFallbackPayslip(doc, entry.staff);
  });

  return doc.output('arraybuffer');
};

export const handleDownloadPDF = async (staff: any, payslip?: ParsedPayslipRecord) => {
  const doc = await generatePDFDocument(staff, payslip);
  downloadPdfDocument(doc, getPayslipFilename(staff, payslip));
};

export const handleDownloadBatchPDF = async (
  entries: Array<{ staff: any; payslip?: ParsedPayslipRecord; dateSent?: string }>
) => {
  if (entries.length === 0) {
    return;
  }

  const buffer = await generateBatchPDFArrayBuffer(entries);
  downloadPdfFile(new File([buffer], getBatchPayslipFilename(entries), { type: 'application/pdf' }));
};

export const generatePDFFile = async (staff: any, payslip?: ParsedPayslipRecord): Promise<File> => {
  const doc = await generatePDFDocument(staff, payslip);
  const employeeName = sanitizePdfFilename(staff.employee_id || staff.name, 'employee');

  return createPdfFile(doc, `Payslip_${employeeName}.pdf`);
};

export const generatePDFBlobUrl = async (staff: any, payslip?: ParsedPayslipRecord): Promise<string> => {
  const file = await generatePDFFile(staff, payslip);
  return URL.createObjectURL(file);
};
