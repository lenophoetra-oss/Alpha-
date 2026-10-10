import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan sistem.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.errorMessage.includes('Quota exceeded');
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900">
                {isQuotaError ? 'Kuota Harian Database Terlampaui' : 'Kendala Memuat Data'}
              </h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isQuotaError
                ? 'Batas kuota pembacaan harian gratis Firebase telah tercapai dan akan direset otomatis besok.'
                : 'Terjadi kesalahan saat memproses permintaan data. Silakan muat ulang halaman.'}
            </p>
            <pre className="p-3 bg-slate-100 rounded-lg text-xs font-mono-tabular text-slate-700 overflow-x-auto">
              {this.state.errorMessage}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
