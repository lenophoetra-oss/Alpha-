import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatIDR } from '../types';
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface AssetDistributionChartProps {
  cashAmount: number;
  phoneInventoryValue: number;
  activePawnLoans: number;
  phoneUnitsCount?: number;
  activePawnsCount?: number;
}

interface AssetSlice {
  id: 'cash' | 'phones' | 'pawns';
  name: string;
  shortName: string;
  value: number;
  rawValue: number;
  percentage: number;
  color: string;
  subtitle: string;
}

export const AssetDistributionChart: React.FC<AssetDistributionChartProps> = ({
  cashAmount,
  phoneInventoryValue,
  activePawnLoans,
  phoneUnitsCount = 0,
  activePawnsCount = 0,
}) => {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  const { slices, totalPositiveAssets } = useMemo(() => {
    const safeCash = Math.max(0, cashAmount);
    const safePhones = Math.max(0, phoneInventoryValue);
    const safePawns = Math.max(0, activePawnLoans);
    const total = safeCash + safePhones + safePawns;

    const items: AssetSlice[] = [
      {
        id: 'cash',
        name: 'Saldo Kas Aktif',
        shortName: 'Kas & Bank',
        value: safeCash,
        rawValue: cashAmount,
        percentage: total > 0 ? (safeCash / total) * 100 : 0,
        color: '#10b981', // emerald-500
        subtitle: 'Laci, Bank & Server',
      },
      {
        id: 'phones',
        name: 'Nilai Stok HP',
        shortName: 'Stok HP',
        value: safePhones,
        rawValue: phoneInventoryValue,
        percentage: total > 0 ? (safePhones / total) * 100 : 0,
        color: '#0f172a', // slate-900
        subtitle: `${phoneUnitsCount} unit aktif`,
      },
      {
        id: 'pawns',
        name: 'Pinjaman Gadai',
        shortName: 'Gadai Aktif',
        value: safePawns,
        rawValue: activePawnLoans,
        percentage: total > 0 ? (safePawns / total) * 100 : 0,
        color: '#f59e0b', // amber-500
        subtitle: `${activePawnsCount} barang gadai`,
      },
    ];

    return {
      slices: items,
      totalPositiveAssets: total,
    };
  }, [cashAmount, phoneInventoryValue, activePawnLoans, phoneUnitsCount, activePawnsCount]);

  const pieData = useMemo(() => {
    if (totalPositiveAssets <= 0) {
      return [{ name: 'Belum Ada Aset', value: 1, color: '#e2e8f0', percentage: 0, isPlaceholder: true }];
    }
    return slices.map((s) => ({
      ...s,
      isPlaceholder: false,
    }));
  }, [slices, totalPositiveAssets]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2.5 h-full flex flex-col justify-between">
      {/* Compact Header & Chart Mode Toggle */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
            Distribusi Aset (Kas · Stok HP · Gadai)
          </h3>
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setChartType('donut')}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              chartType === 'donut'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChartIcon className="w-3 h-3" />
            <span>Donut</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              chartType === 'bar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>Batang</span>
          </button>
        </div>
      </div>

      {/* Compact Side-by-Side Visualization + Breakdown List */}
      <div className="grid grid-cols-12 gap-2.5 sm:gap-3 items-center flex-1">
        {/* Left: Compact Recharts Container */}
        <div className="col-span-5 sm:col-span-5 h-36 sm:h-40 w-full relative flex items-center justify-center bg-slate-50/60 rounded-xl p-1.5">
          {chartType === 'donut' ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={58}
                    paddingAngle={totalPositiveAssets > 0 ? 3 : 0}
                    strokeWidth={0}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {totalPositiveAssets > 0 && (
                    <Tooltip
                      formatter={(value) => [formatIDR(Number(value) || 0), 'Nilai']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#f8fafc',
                        fontSize: '11px',
                        padding: '6px 10px',
                      }}
                      itemStyle={{ color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                <span className="text-[9px] uppercase tracking-wider font-medium text-slate-400">
                  Total
                </span>
                <span className="text-[10px] sm:text-xs font-bold font-mono-tabular text-slate-900 truncate max-w-[78px]">
                  {formatIDR(totalPositiveAssets)}
                </span>
              </div>
            </>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={slices}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  hide
                  domain={[0, totalPositiveAssets > 0 ? 'dataMax' : 1000000]}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={68}
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(value) => [formatIDR(Number(value) || 0), 'Nilai']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '11px',
                    padding: '6px 10px',
                  }}
                  itemStyle={{ color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {slices.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right: Tight Breakdown Rows */}
        <div className="col-span-7 sm:col-span-7 divide-y divide-slate-100">
          {slices.map((item) => (
            <div key={item.id} className="py-1.5 first:pt-0 last:pb-0 space-y-1">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[11px] font-semibold text-slate-800 truncate">
                    {item.name}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-bold font-mono-tabular text-slate-900 shrink-0">
                  {formatIDR(item.rawValue)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                <span className="truncate">{item.subtitle}</span>
                <span className="font-mono-tabular shrink-0">{item.percentage.toFixed(0)}%</span>
              </div>

              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
