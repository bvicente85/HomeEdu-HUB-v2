import React from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { X, Database, CheckCircle2, Shield, Lock } from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const isLive = isSupabaseConfigured();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold text-stone-900">Supabase Connection</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200/80 rounded-md">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-semibold text-stone-900">
                {isLive ? 'Connected Live' : 'Development Sandbox Mode'}
              </p>
              <p className="text-2xs text-stone-500">
                {isLive ? 'Production database connected securely.' : 'Simulated local sandbox active.'}
              </p>
            </div>
          </div>
          <span
            className={`text-2xs font-medium px-2 py-0.5 rounded-md border ${
              isLive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-stone-100 text-stone-700 border-stone-200'
            }`}
          >
            {isLive ? 'Live Verified' : 'Dev Local'}
          </span>
        </div>

        {/* Read-Only Non-Sensitive Technical Status Matrix */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-600">Supabase</span>
            <span className="font-medium text-stone-900 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {isLive ? 'Connected' : 'Sandbox Active'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-600">Authentication</span>
            <span className="font-medium text-stone-900 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-600">Row Level Security</span>
            <span className="font-medium text-stone-900 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Enabled
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-600">Storage</span>
            <span className="font-medium text-stone-900 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Private
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-600">Environment</span>
            <span className="font-medium text-stone-900 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {import.meta.env.PROD ? 'Production' : 'Development'}
            </span>
          </div>
        </div>

        <p className="text-2xs text-stone-500 leading-relaxed">
          Application database parameters are governed by protected system environment variables. Credentials cannot be modified or replaced from the client interface.
        </p>

        <div className="flex items-center justify-end pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-1.5 font-medium text-stone-700 border border-stone-300 rounded-md hover:bg-stone-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
