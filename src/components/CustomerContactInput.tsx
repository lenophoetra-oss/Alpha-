import React, { useState, useRef } from 'react';
import { CustomerRecord, CustomerCategory, CUSTOMER_CATEGORY_LABELS } from '../types';
import { saveCustomerRecord } from '../services/firestoreService';
import {
  pickPhoneContactFromDevice,
  parseVCardText,
  parseClipboardContact,
} from '../utils/phoneContacts';
import { Contact, Users, UserPlus, Check, Search, Upload, ClipboardPaste } from 'lucide-react';

interface CustomerContactInputProps {
  uid: string;
  customers: CustomerRecord[];
  nameValue: string;
  onNameChange: (name: string) => void;
  phoneValue?: string;
  onPhoneChange?: (phone: string) => void;
  nameLabel?: string;
  phoneLabel?: string;
  namePlaceholder?: string;
  phonePlaceholder?: string;
  nameRequired?: boolean;
  phoneRequired?: boolean;
  showPhoneField?: boolean;
  defaultCategory?: CustomerCategory;
}

export const CustomerContactInput: React.FC<CustomerContactInputProps> = ({
  uid,
  customers,
  nameValue,
  onNameChange,
  phoneValue = '',
  onPhoneChange,
  nameLabel = 'Nama Pelanggan',
  phoneLabel = 'Nomor HP / WhatsApp',
  namePlaceholder = 'Contoh: Budi Santoso',
  phonePlaceholder = 'Contoh: 081234567890',
  nameRequired = false,
  phoneRequired = false,
  showPhoneField = true,
  defaultCategory = 'umum',
}) => {
  const [showSavedList, setShowSavedList] = useState(false);
  const [showFallbackTools, setShowFallbackTools] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactNotice, setContactNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'info'>('info');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const vcfInputRef = useRef<HTMLInputElement | null>(null);

  const applyAndAutoSaveContact = async (pickedName: string, pickedPhone: string) => {
    if (pickedName) onNameChange(pickedName);
    if (pickedPhone && onPhoneChange) {
      onPhoneChange(pickedPhone);
    }

    // Automatically save to Customer Book if not already in customers list
    if (pickedName.trim()) {
      const exists = customers.some(
        (c) =>
          c.name.toLowerCase() === pickedName.trim().toLowerCase() ||
          (pickedPhone && c.phone === pickedPhone)
      );
      if (!exists) {
        try {
          await saveCustomerRecord(uid, {
            name: pickedName.trim(),
            phone: pickedPhone || '-',
            category: defaultCategory,
            notes: 'Diambil dari Kontak Telepon HP',
          });
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        } catch {
          // Ignore auto-save error
        }
      }
    }
  };

  const handlePickFromPhoneContacts = async () => {
    setContactNotice('');
    const res = await pickPhoneContactFromDevice();
    if (res.status === 'picked' && res.contact) {
      await applyAndAutoSaveContact(res.contact.name, res.contact.phone);
      setNoticeType('success');
      setContactNotice(
        `Kontak "${res.contact.name}" (${res.contact.phone || 'tanpa nomor'}) berhasil diambil & disimpan ke Buku Pelanggan.`
      );
      setShowFallbackTools(false);
      return;
    }

    if (res.status === 'blocked_iframe' || res.status === 'unsupported') {
      setShowSavedList(true);
      setShowFallbackTools(true);
      setNoticeType('info');
      setContactNotice(res.message || 'Pilih dari Buku Pelanggan, tempel nomor, atau impor file kontak (.vcf).');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseClipboardContact(text);
      if (parsed && (parsed.name || parsed.phone)) {
        await applyAndAutoSaveContact(parsed.name || nameValue, parsed.phone || phoneValue);
        setNoticeType('success');
        setContactNotice('Data kontak berhasil ditempel dari Clipboard HP.');
      } else {
        setNoticeType('info');
        setContactNotice('Clipboard kosong. Salin nama/nomor telepon terlebih dahulu.');
      }
    } catch {
      setNoticeType('info');
      setContactNotice('Tekan lama pada kolom Nama atau Nomor HP di bawah lalu pilih Tempel (Paste).');
    }
  };

  const handleVcfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const list = parseVCardText(text);
      if (list.length > 0) {
        const first = list[0];
        await applyAndAutoSaveContact(first.name, first.phone);
        setNoticeType('success');
        setContactNotice(`Kontak "${first.name}" (${first.phone}) berhasil dimuat dari file kontak.`);
      } else {
        setNoticeType('info');
        setContactNotice('File .vcf tidak berisi nomor kontak yang valid.');
      }
    } catch {
      setNoticeType('info');
      setContactNotice('Gagal membaca file kontak .vcf.');
    } finally {
      e.target.value = '';
    }
  };

  const handleQuickSaveCustomer = async () => {
    if (!nameValue.trim()) return;
    setIsSavingCustomer(true);
    setSavedSuccess(false);
    try {
      await saveCustomerRecord(uid, {
        name: nameValue.trim(),
        phone: phoneValue.trim() || '-',
        category: defaultCategory,
        notes: 'Disimpan dari input transaksi',
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.notes.toLowerCase().includes(q)
    );
  });

  const isAlreadySaved = customers.some(
    (c) => c.name.toLowerCase() === nameValue.trim().toLowerCase()
  );

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        onChange={handleVcfFileChange}
        className="hidden"
      />

      {/* Top Action Bar: Pilih Pelanggan & Buka Kontak Telepon HP */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600">
          Pelanggan & Kontak Telepon HP
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handlePickFromPhoneContacts}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Contact className="w-3.5 h-3.5" />
            <span>Buka Kontak HP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSavedList(!showSavedList)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Buku Pelanggan ({customers.length})</span>
          </button>

          {nameValue.trim() && !isAlreadySaved && (
            <button
              type="button"
              onClick={handleQuickSaveCustomer}
              disabled={isSavingCustomer}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Tersimpan</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  <span>{isSavingCustomer ? '...' : '+ Simpan'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {contactNotice && (
        <div
          className={`text-[11px] rounded-lg px-2.5 py-2 space-y-2 border ${
            noticeType === 'success'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}
        >
          <div>{contactNotice}</div>
          {showFallbackTools && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 text-slate-800 hover:bg-amber-100 rounded-md text-[11px] font-semibold cursor-pointer"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Tempel Nomor dari Clipboard</span>
              </button>
              <button
                type="button"
                onClick={() => vcfInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 text-slate-800 hover:bg-amber-100 rounded-md text-[11px] font-semibold cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Pilih File Kontak (.vcf)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Saved Customers Picker */}
      {showSavedList && (
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau nomor WA pelanggan..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          {filteredCustomers.length === 0 ? (
            <div className="text-[11px] text-slate-500 text-center py-2">
              Belum ada data pelanggan yang cocok. Ketik di bawah lalu klik "+ Simpan".
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onNameChange(c.name);
                    if (onPhoneChange && c.phone !== '-') {
                      onPhoneChange(c.phone);
                    }
                    setShowSavedList(false);
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {CUSTOMER_CATEGORY_LABELS[c.category]}
                    </div>
                  </div>
                  <div className="text-xs font-mono-tabular text-emerald-700 font-medium shrink-0">
                    {c.phone !== '-' ? c.phone : 'Tanpa No'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Fields */}
      <div className={`grid grid-cols-1 ${showPhoneField ? 'sm:grid-cols-2' : ''} gap-2.5`}>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{nameLabel}</label>
          <input
            type="text"
            required={nameRequired}
            value={nameValue}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          />
        </div>

        {showPhoneField && onPhoneChange && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{phoneLabel}</label>
            <input
              type="tel"
              required={phoneRequired}
              value={phoneValue}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder={phonePlaceholder}
              className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-xl bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};
