'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Etwas ist schiefgelaufen
            </h1>
            {this.state.error?.message && (
              <p className="text-sm text-gray-500 bg-gray-100 rounded-lg p-3 break-words font-mono">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Seite neu laden
              </button>
              <button
                onClick={exportData}
                className="w-full rounded-xl bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Daten exportieren
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-200 transition-colors"
              >
                Daten löschen &amp; neu starten
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const exportData = () => {
  try {
    const data = localStorage.getItem('cycletrack_data');
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycletrack-notfall-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed', e);
  }
};

export default ErrorBoundary;
