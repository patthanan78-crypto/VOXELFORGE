import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="h-10 px-3.5 rounded-lg bg-emerald-500/18 border border-emerald-400/45 text-emerald-300 hover:bg-emerald-500/28 hover:text-emerald-200 transition-colors flex items-center gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-[#080c11]/88 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111821] border border-white/15 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">
                Install as App (Zero Coding)
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="h-8 w-8 rounded-lg bg-[#1a2430] hover:bg-[#233142] text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                <li>Open the Shared App URL in Safari (outside an embedded preview frame).</li>
                <li>Tap the <strong className="text-white">Share</strong> button in Safari.</li>
                <li>Tap <strong className="text-white">Add to Home Screen</strong>.</li>
              </ol>
            ) : (
              <div className="text-sm text-slate-300 space-y-3">
                <p>
                  Open the <strong className="text-white">Shared App URL</strong> directly in your browser (outside the preview frame), then:
                </p>
                <div className="space-y-2 bg-[#0b1016] border border-white/10 rounded-lg p-3 text-xs">
                  <div>
                    <strong className="text-emerald-400">Android (Chrome):</strong> Tap the 3-dot menu → <strong className="text-white">Install app</strong> (or <strong className="text-white">Add to Home screen</strong>).
                  </div>
                  <div>
                    <strong className="text-sky-400">Windows (Chrome / Edge):</strong> Click the <strong className="text-white">Install</strong> icon in the right side of the address bar.
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
