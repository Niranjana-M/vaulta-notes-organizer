import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff, Wifi, CloudOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);
    } else if (wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div
        id="pwa-offline-indicator"
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 bg-amber-900/90 dark:bg-amber-950/95 text-amber-100 border border-amber-500/50 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300"
      >
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              You're offline
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
            Vaulta is running from cached app shell. Cloud storage uploads, downloads, and sync require an internet connection.
          </p>
        </div>
      </div>
    );
  }

  if (showRestoredNotice) {
    return (
      <div
        id="pwa-online-restored-indicator"
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-50 bg-emerald-900/90 dark:bg-emerald-950/95 text-emerald-100 border border-emerald-500/50 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
          <Wifi className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <p className="font-semibold text-emerald-200">Back online</p>
          <p className="text-emerald-300/80 text-[11px]">Connection restored.</p>
        </div>
      </div>
    );
  }

  return null;
};
