import React, { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { License, LicenseType } from '../types';
import { KeyRound, Plus, ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';

interface LicenseDashboardProps {
  uid: string;
  userEmail: string | null;
  licenses: License[];
  onAddLicense: (license: Omit<License, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export const LicenseDashboard: React.FC<LicenseDashboardProps> = ({
  uid,
  userEmail,
  licenses,
  onAddLicense,
}) => {
  const isAdmin = userEmail === 'lenophoetra@gmail.com';
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [licenseType, setLicenseType] = useState<LicenseType>('trial');
  const [custPhone, setCustPhone] = useState('');
  const [expiryDays, setExpiryDays] = useState(3);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const expiryDate = new Timestamp(
      Math.floor((Date.now() + expiryDays * 24 * 60 * 60 * 1000) / 1000),
      0
    );
    await onAddLicense({
      ownerId: uid,
      customerPhone: custPhone,
      licenseKey: `KEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      type: licenseType,
      expiryDate,
      status: 'active',
    });
    setShowAddLicense(false);
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Lisensi Aktif</h3>
            <button
              onClick={() => setShowAddLicense(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
            >
              + Lisensi Baru
            </button>
          </div>
          
          {showAddLicense && (
            <form onSubmit={handleAdd} className="p-4 bg-slate-50 rounded-xl space-y-3">
              <input
                type="text"
                placeholder="No HP Customer"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
              <div className="flex gap-2">
                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value as LicenseType)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="trial">Trial</option>
                  <option value="full">Full</option>
                </select>
                <input
                  type="number"
                  placeholder="Hari"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLicense(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg cursor-pointer"
                >
                  Simpan Lisensi
                </button>
              </div>
            </form>
          )}
          
          <div className="divide-y divide-slate-100">
            {licenses.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{l.customerPhone}</div>
                  <div className="text-xs text-slate-500">{l.type.toUpperCase()} · Exp: {l.expiryDate.toDate().toLocaleDateString()}</div>
                </div>
                <button onClick={() => copyToClipboard(l.licenseKey)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
                  {copiedKey === l.licenseKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Status Lisensi Customer</h3>
          <p className="text-sm text-slate-600">
            Aplikasi Anda saat ini {licenses.length > 0 ? 'Aktif' : 'Trial'}
          </p>
          <input type="text" placeholder="Masukkan Kode Lisensi" className="w-full px-3 py-2 border rounded-xl" />
          <button className="w-full py-2 bg-emerald-600 text-white rounded-xl cursor-pointer">Aktifkan Lisensi</button>
        </div>
      )}
    </div>
  );
};
