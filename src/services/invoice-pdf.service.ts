import PDFDocument from 'pdfkit';
import { config } from '../config/env';
import type { InvoiceSummary } from '../db/schemas/invoices';

// Renders a single invoice as a PDF. Pure JavaScript (PDFKit), so no browser or system fonts are needed.

const money = (amount: string): string => {
  const [whole, cents] = Number(amount).toFixed(2).split('.');
  return `${config.rwanda.currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
};

const formatDate = (value: string | Date | null): string => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00+02:00`);
  return date.toLocaleDateString('en-GB', { timeZone: config.rwanda.timezone, day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABEL: Record<InvoiceSummary['invoiceStatus'], string> = {
  pending: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

export const renderInvoicePdf = (invoice: InvoiceSummary): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: 'IsanoMed' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).fillColor('#0f766e').text('IsanoMed', { continued: false });
    doc.fontSize(9).fillColor('#6b7280').text('Healthcare management, Rwanda');
    doc.moveDown(1.5);

    doc.fontSize(16).fillColor('#111827').text('INVOICE');
    doc.fontSize(10).fillColor('#374151');
    doc.text(`Invoice number: ${invoice.invoiceNumber}`);
    doc.text(`Invoice date: ${formatDate(invoice.invoiceDate)}`);
    doc.text(`Status: ${STATUS_LABEL[invoice.invoiceStatus]}`);
    if (invoice.paidAt) doc.text(`Paid on: ${formatDate(invoice.paidAt)}`);
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#111827').text('Billed to', { underline: true });
    doc.fontSize(10).fillColor('#374151').text(invoice.patientName);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#111827').text('Provided by', { underline: true });
    doc.fontSize(10).fillColor('#374151').text(invoice.doctorName);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fontSize(10).fillColor('#111827');
    doc.text('Description', 50, tableTop, { width: 330 });
    doc.text('Amount', 400, tableTop, { width: 145, align: 'right' });
    doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#d1d5db').stroke();

    const rowTop = tableTop + 26;
    doc.fillColor('#374151').text('Medical consultation (telemedicine)', 50, rowTop, { width: 330 });
    doc.text(money(invoice.totalAmount), 400, rowTop, { width: 145, align: 'right' });

    const totalTop = rowTop + 40;
    doc.moveTo(350, totalTop - 6).lineTo(545, totalTop - 6).strokeColor('#d1d5db').stroke();
    doc.fontSize(11).fillColor('#111827').text('Total', 350, totalTop, { width: 50 });
    doc.text(money(invoice.totalAmount), 400, totalTop, { width: 145, align: 'right' });

    doc.fontSize(8).fillColor('#6b7280');
    doc.text(
      'Pay online through the IsanoMed patient portal, or at the clinic reception. Keep this invoice for your records.',
      50,
      740,
      { width: 495, align: 'center' },
    );

    doc.end();
  });
