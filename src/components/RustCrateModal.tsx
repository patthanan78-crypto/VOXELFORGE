import React, { useState } from 'react';
import { RUST_CRATE_FILES, RustRuntimeSummary } from '../data/rustCrate';
import { MinecraftVersion, PlatformTarget } from '../data/versions';
import { buildZipBlob } from '../utils/zipBuilder';
import { Check, Copy, Download, FileArchive, FileCode2, Terminal, X } from 'lucide-react';

interface RustCrateModalProps {
  version: MinecraftVersion;
  platform: PlatformTarget;
  runtime: RustRuntimeSummary;
  onClose: () => void;
}

export const RustCrateModal: React.FC<RustCrateModalProps> = ({
  version,
  platform,
  runtime,
  onClose,
}) => {
  const [activePath, setActivePath] = useState<string>(RUST_CRATE_FILES[0].path);
  const [copied, setCopied] = useState(false);

  const activeFile =
    RUST_CRATE_FILES.find((f) => f.path === activePath) ?? RUST_CRATE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeFile.content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleDownloadAllZip = () => {
    const zipBlob = buildZipBlob(
      RUST_CRATE_FILES.map((f) => ({ path: f.path, content: f.content })),
    );
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voxelforge-rust-github.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#080c11]/88 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#10161e] border border-white/15 rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileCode2 className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                Rust Launcher Crate · {runtime.targetTriple}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                MC {version.id} · {platform === 'android' ? 'Android ARM64 NDK' : 'Windows x86_64'} · {runtime.graphicsBackend}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadAllZip}
              className="h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download ZIP (All Files)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Rust Crate Viewer"
              className="h-9 w-9 rounded-lg bg-[#18212c] hover:bg-[#233040] text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Runtime Tuning Strip */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#0c1117] border-b border-white/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-tabular text-slate-300 shrink-0">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Terminal className="w-3.5 h-3.5" />
            Java {runtime.javaVersion}
          </span>
          <span>Present: {runtime.presentMode}</span>
          <span className="truncate text-emerald-400">{runtime.flags}</span>
        </div>

        {/* File Tabs + Code Viewer */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Sidebar File List */}
          <div className="md:w-60 border-b md:border-b-0 md:border-r border-white/10 p-2.5 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0 launcher-scroll">
            {RUST_CRATE_FILES.map((file) => {
              const selected = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setActivePath(file.path)}
                  className={`px-3 py-2 rounded-lg text-left text-xs font-mono-tabular whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selected
                      ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold'
                      : 'bg-transparent border border-transparent text-slate-300 hover:bg-[#17202b]'
                  }`}
                >
                  {file.path.replace('rust-launcher/', '')}
                </button>
              );
            })}
          </div>

          {/* Code View */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#0b1016]">
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-mono-tabular font-semibold text-white truncate">
                  {activeFile.path}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{activeFile.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-8 px-2.5 rounded-md bg-[#18212c] hover:bg-[#233040] text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="h-8 px-2.5 rounded-md bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-slate-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
            <pre className="flex-1 p-4 overflow-auto text-xs leading-relaxed font-mono-tabular text-slate-200 launcher-scroll">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
