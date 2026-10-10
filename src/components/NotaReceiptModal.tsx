import React, { useState } from 'react';
import {
  ReceiptPayload,
  StoreSettings,
  CustomerRecord,
  formatIDR,
  buildWhatsAppUrl,
} from '../types';
import { Printer, MessageCircle, Copy, Check, Contact, X, Store } from 'lucide-react';
import { pickPhoneContactFromDevice } from '../utils/phoneContacts';

interface NotaReceiptModalProps {
  receipt: ReceiptPayload | null;
  settings: StoreSettings;
  customers?: CustomerRecord[];
  onClose: () => void;
}

export const NotaReceiptModal: React.FC<NotaReceiptModalProps> = ({
  receipt,
  settings,
  customers = [],
  onClose,
}) => {
  if (!receipt) return null;

  // Try to auto-match customer's phone from saved customers if not explicitly provided
  const matchedCustomer = customers.find(
    (c) =>
      c.name.toLowerCase() === receipt.customerName.toLowerCase() &&
      c.phone &&
      c.phone !== '-'
  );

  const [waPhone, setWaPhone] = useState(
    receipt.customerPhone && receipt.customerPhone !== '-'
      ? receipt.customerPhone
      : matchedCustomer?.phone || ''
  );
  const [copied, setCopied] = useState(false);

  const handlePickPhoneContact = async () => {
    const res = await pickPhoneContactFromDevice();
    if (res.status === 'picked' && res.contact?.phone) {
      setWaPhone(res.contact.phone);
    }
  };

  const buildReceiptText = () => {
    const lines: string[] = [
      `*${settings.storeName.toUpperCase()}*`,
      settings.storeAddress,
      `WA Konter: ${settings.storePhone}`,
      `--------------------------------`,
      `No. Nota : ${receipt.receiptNo}`,
      `Tanggal  : ${receipt.dateString}${receipt.timeString ? ` ${receipt.timeString}` : ''}`,
      `Pelanggan: ${receipt.customerName || 'Umum'}`,
      `Kategori : ${receipt.categoryLabel}`,
      `--------------------------------`,
      `*${receipt.title}*`,
    ];

    if (receipt.extraLines && receipt.extraLines.length > 0) {
      for (const item of receipt.extraLines) {
        lines.push(`${item.label}: ${item.value}`);
      }
    }

    if (receipt.notes && receipt.notes !== '-') {
      lines.push(`Catatan  : ${receipt.notes}`);
    }

    lines.push(
      `--------------------------------`,
      `*TOTAL   : ${formatIDR(receipt.amount)}*`,
      `--------------------------------`,
      settings.receiptFooter
    );

    return lines.join('\n');
  };

  const receiptText = buildReceiptText();
  const waUrl = buildWhatsAppUrl(waPhone, receiptText);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto sm:hidden" />

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Nota & Kirim Struk WhatsApp</h3>
            <p className="text-xs text-slate-500">
              Ukuran Kertas Thermal: {settings.paperSize.toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Thermal Receipt Preview */}
        <div
          id="printable-receipt-area"
          className={`mx-auto bg-white text-slate-900 border border-dashed border-slate-300 rounded-xl p-4 font-mono-tabular text-xs space-y-2.5 ${
            settings.paperSize === '58mm' ? 'max-w-[290px]' : 'max-w-[360px]'
          }`}
        >
          {/* Store Header */}
          <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
            {settings.showLogoOnReceipt && (
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto mb-1">
                <Store className="w-4 h-4" />
              </div>
            )}
            <div className="text-sm font-bold uppercase tracking-tight">{settings.storeName}</div>
            <div className="text-[11px] text-slate-600 leading-snug">{settings.storeAddress}</div>
            <div className="text-[11px] text-slate-600">Telp/WA: {settings.storePhone}</div>
          </div>

          {/* Meta Info */}
          <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">No. Nota:</span>
              <span className="font-semibold">{receipt.receiptNo}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Tanggal:</span>
              <span>
                {receipt.dateString} {receipt.timeString || ''}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Pelanggan:</span>
              <span className="font-semibold text-right">{receipt.customerName || 'Umum'}</span>
            </div>
            {waPhone && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">No. HP/WA:</span>
                <span>{waPhone}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Kategori:</span>
              <span>{receipt.categoryLabel}</span>
            </div>
          </div>

          {/* Item Details */}
          <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-300">
            <div className="font-bold text-xs text-slate-900">{receipt.title}</div>
            {receipt.extraLines &&
              receipt.extraLines.map((line, i) => (
                <div key={i} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">{line.label}:</span>
                  <span className="text-right font-medium">{line.value}</span>
                </div>
              ))}
            {receipt.notes && receipt.notes !== '-' && (
              <div className="text-[11px] text-slate-600 pt-0.5">Ket: {receipt.notes}</div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-1 text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatIDR(receipt.amount)}</span>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500 leading-relaxed">
            {settings.receiptFooter}
          </div>
        </div>

        {/* WhatsApp Target Number Input */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">
              Nomor WhatsApp Pelanggan (Opsional)
            </label>
            <button
              type="button"
              onClick={handlePickPhoneContact}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-emerald-600 text-white rounded-lg cursor-pointer"
            >
              <Contact className="w-3 h-3" />
              <span>Kontak HP</span>
            </button>
          </div>
          <input
            type="tel"
            value={waPhone}
            onChange={(e) => setWaPhone(e.target.value)}
            placeholder="Contoh: 081234567890 (Kosongkan untuk pilih kontak di WA)"
            className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-xl bg-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Kirim Nota ke WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Nota</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Teks Nota Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks Nota</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
