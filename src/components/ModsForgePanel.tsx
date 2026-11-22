import React, { useMemo, useState } from 'react';
import { MinecraftVersion } from '../data/versions';
import {
  buildFullForgeJavaProject,
  buildFullForgeRustProject,
  FORGE_MODS_CATALOG,
  ForgeModDefinition,
  ForgeModId,
  ModCodeLanguage,
  sanitizeForgeModId,
} from '../data/forgeMods';
import { buildZipBlob } from '../utils/zipBuilder';
import {
  Anchor,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Package,
  Play,
  PlusCircle,
  PowerOff,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';

interface ModsForgePanelProps {
  selectedVersion: MinecraftVersion;
  activeMods: ForgeModId[];
  onChangeActiveMods: (next: ForgeModId[]) => void;
  modCodeLang: ModCodeLanguage;
  onChangeModCodeLang: (lang: ModCodeLanguage) => void;
  onEnterGame?: () => void;
}

export const ModsForgePanel: React.FC<ModsForgePanelProps> = ({
  selectedVersion,
  activeMods,
  onChangeActiveMods,
  modCodeLang,
  onChangeModCodeLang,
  onEnterGame,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ForgeModDefinition['category']>('All');
  const [inspectedModId, setInspectedModId] = useState<ForgeModId>('drin_anchors');
  const [customModName, setCustomModName] = useState('VoxelForge DrinPack');
  const [customModId, setCustomModId] = useState('voxelforge_drinpack');
  const [copiedCode, setCopiedCode] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const activeSet = useMemo(() => new Set(activeMods), [activeMods]);

  const filteredMods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FORGE_MODS_CATALOG.filter((m) => {
      if (categoryFilter !== 'All' && m.category !== categoryFilter) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.summary.toLowerCase().includes(q) && !m.modId.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [searchQuery, categoryFilter]);

  const inspectedMod = useMemo(
    () => FORGE_MODS_CATALOG.find((m) => m.id === inspectedModId) ?? FORGE_MODS_CATALOG[0],
    [inspectedModId],
  );

  const importModToGame = (mod: ForgeModDefinition) => {
    if (!activeSet.has(mod.id)) {
      onChangeActiveMods([...activeMods, mod.id]);
    }
    setInspectedModId(mod.id);
    setImportNotice(`Imported "${mod.name}" directly into the game and enabled it.`);
  };

  const toggleMod = (mod: ForgeModDefinition) => {
    if (activeSet.has(mod.id)) {
      onChangeActiveMods(activeMods.filter((m) => m !== mod.id));
      setImportNotice(`Disabled "${mod.name}" in game.`);
    } else {
      importModToGame(mod);
    }
  };

  const enableAllMods = () => {
    onChangeActiveMods(FORGE_MODS_CATALOG.map((m) => m.id));
    setImportNotice(`Imported and enabled all ${FORGE_MODS_CATALOG.length} mods in the game.`);
  };

  const clearAllMods = () => {
    onChangeActiveMods([]);
    setImportNotice('Cleared all active mods from the game.');
  };

  const activeDisplayedCode =
    modCodeLang === 'java' ? inspectedMod.javaCode : inspectedMod.rustCode;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeDisplayedCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadForgeProject = () => {
    const modList = activeMods.length > 0 ? activeMods : [inspectedMod.id];
    const safeId = sanitizeForgeModId(customModId);
    const entries =
      modCodeLang === 'java'
        ? buildFullForgeJavaProject(modList, customModName, safeId, selectedVersion.id)
        : buildFullForgeRustProject(modList, customModName, safeId, selectedVersion.id);
    const blob = buildZipBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      modCodeLang === 'java'
        ? `${safeId}-forge-java-${selectedVersion.id}.zip`
        : `${safeId}-rust-mc-mod-${selectedVersion.id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Left Column: All Forge Mods & Drin Anchors Browser */}
      <section
        aria-label="Forge Mods and Drin Anchors"
        className="lg:col-span-6 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col max-h-[68vh]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-300" />
              <span>Forge Mods &amp; Drin Anchors</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeMods.length} of {FORGE_MODS_CATALOG.length} mods enabled · Live sandbox hooks + full Forge mod export
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={enableAllMods}
              className="h-8 px-2.5 rounded-lg bg-[#17202b] hover:bg-[#223040] border border-emerald-400/35 text-[11px] font-semibold text-emerald-300 cursor-pointer"
            >
              Import All to Game
            </button>
            <button
              type="button"
              onClick={clearAllMods}
              disabled={activeMods.length === 0}
              className="h-8 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 disabled:opacity-40 border border-rose-400/35 text-[11px] font-semibold text-rose-200 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <PowerOff className="w-3 h-3" />
              <span>Disable All</span>
            </button>
          </div>
        </div>

        {importNotice && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
            <span className="truncate">{importNotice}</span>
            {onEnterGame && (
              <button
                type="button"
                onClick={onEnterGame}
                className="text-emerald-300 hover:text-white font-bold shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play Now</span>
              </button>
            )}
          </div>
        )}

        {/* Search + Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Drin Anchors, VeinMiner, Create, JEI..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0b1016] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto launcher-scroll">
            {(['All', 'Anchor', 'World', 'Movement', 'Tech', 'Utility'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#17202b] text-slate-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Mod Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 launcher-scroll min-h-[200px]">
          {filteredMods.map((mod) => {
            const enabled = activeSet.has(mod.id);
            const selected = inspectedModId === mod.id;
            return (
              <div
                key={mod.id}
                onClick={() => setInspectedModId(mod.id)}
                className={`p-3 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                  selected
                    ? 'bg-[#182330] border-emerald-400/75'
                    : 'bg-[#151d27]/85 border-white/10 hover:bg-[#1a2431]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {mod.category === 'Anchor' && (
                        <Anchor className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      )}
                      <span className="text-sm font-bold text-white truncate">{mod.name}</span>
                      {mod.remakeTag && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-mono-tabular font-extrabold text-amber-300 tracking-wide">
                          {mod.remakeTag}
                        </span>
                      )}
                      <span className="text-[11px] font-mono-tabular text-slate-400">
                        @{mod.modId} · {modLangLabel(modCodeLang)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-snug">{mod.summary}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {enabled ? (
                      <>
                        <span className="h-8 px-2 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMod(mod);
                          }}
                          className="h-8 px-2.5 rounded-md border bg-rose-500/20 hover:bg-rose-500 hover:text-white border-rose-400/45 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          <span>Disable</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMod(mod);
                        }}
                        className="h-8 px-2.5 rounded-md border bg-amber-400/15 hover:bg-amber-400 hover:text-slate-950 border-amber-400/45 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Import to Game</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-emerald-300/90 truncate">{mod.sandboxActiveHint}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href={mod.modrinthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <span>Modrinth</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={mod.curseforgeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1"
                    >
                      <span>CurseForge</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2.5 mt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Browse complete Modrinth / Forge `.jar` libraries:</span>
          <a
            href="https://modrinth.com/mods?g=categories:forge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1"
          >
            <span>All Forge Mods on Modrinth</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </section>

      {/* Right Column: Forge Mod Builder + Java (Default) vs Rust Minecraft Mod Code Pane */}
      <section
        aria-label="Forge Mod Code and Builder"
        className="lg:col-span-6 bg-[#10161e]/94 border border-white/12 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3 max-h-[68vh]"
      >
        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div>
              <div className="text-xs font-mono-tabular text-amber-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>Forge Mod Maker · MC {selectedVersion.id}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-white mt-0.5">
                {inspectedMod.name}
              </h2>
            </div>

            {/* Code Language Toggle: Java Code Pane stays ON by default; Rust clicked manually */}
            <div
              role="group"
              aria-label="Mod Code Language Pane"
              className="flex items-center gap-1 p-1 rounded-lg bg-[#0b1016] border border-white/15 shrink-0"
            >
              <button
                type="button"
                onClick={() => onChangeModCodeLang('java')}
                className={`h-8 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  modCodeLang === 'java'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Java Code (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeModCodeLang('rust')}
                className={`h-8 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  modCodeLang === 'rust'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rust Mod Code</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-300">
            {modCodeLang === 'java'
              ? 'Java Code Pane is active by default for standard Minecraft Forge (@Mod). Click "Rust Mod Code" manually to convert every mod into native Rust JNI modules.'
              : 'Rust Mode Active: Every Forge mod in this workspace (Drin Anchors, VeinMiner, MTR Remake, Create, JEI, etc.) runs as native Rust cdylib JNI modules.'}
          </p>

          {inspectedMod.remakeTag && inspectedMod.remakeHighlights && (
            <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/35 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono-tabular font-bold text-amber-300">
                  {inspectedMod.remakeTag} · {inspectedMod.versionTag}
                </span>
                {modCodeLang === 'java' && (
                  <button
                    type="button"
                    onClick={() => onChangeModCodeLang('rust')}
                    className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold cursor-pointer"
                  >
                    Switch to Rust Remake Code
                  </button>
                )}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-slate-200 leading-snug">
                {inspectedMod.remakeHighlights.map((item) => (
                  <li key={item} className="truncate" title={item}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Custom Forge Modpack Name & ID */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Custom Forge Mod Name
              </label>
              <input
                type="text"
                value={customModName}
                onChange={(e) => setCustomModName(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[#0b1016] border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Forge Mod ID
              </label>
              <input
                type="text"
                value={customModId}
                onChange={(e) => setCustomModId(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-[#0b1016] border border-white/15 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 min-h-[160px] flex flex-col rounded-lg bg-[#090d12] border border-white/12 overflow-hidden">
            <div className="px-3 py-1.5 bg-[#141b24] border-b border-white/10 flex items-center justify-between text-[11px] font-mono-tabular">
              <span className="text-slate-300 truncate">
                {modCodeLang === 'java'
                  ? `src/main/java/com/voxelforge/${inspectedMod.modId}.java`
                  : `crates/${inspectedMod.modId}_rs/src/lib.rs`}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="text-emerald-300 hover:text-emerald-200 font-sans font-semibold flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="flex-1 p-3 overflow-auto font-mono-tabular text-[11px] leading-relaxed text-slate-200 launcher-scroll">
              <code>{activeDisplayedCode}</code>
            </pre>
          </div>
        </div>

        {/* Direct Import to Game + Full Forge Mod Export */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleMod(inspectedMod)}
              className={`h-10 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors border ${
                activeSet.has(inspectedMod.id)
                  ? 'bg-rose-500/20 border-rose-400/50 text-rose-200 hover:bg-rose-500 hover:text-white'
                  : 'bg-[#17202b] hover:bg-emerald-500 hover:text-slate-950 border-emerald-400/50 text-emerald-300'
              }`}
            >
              {activeSet.has(inspectedMod.id) ? (
                <>
                  <PowerOff className="w-4 h-4" />
                  <span>Disable Mod</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Import Mod to Game</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadForgeProject}
              className={`h-10 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                modCodeLang === 'java'
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <FileArchive className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {modCodeLang === 'java'
                  ? `Export Forge Java (.zip · ${activeMods.length || 1})`
                  : `Export Rust Mod (.zip · ${activeMods.length || 1})`}
              </span>
              <Download className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
          <p className="text-[11px] text-center text-slate-400">
            {modCodeLang === 'java'
              ? 'Includes build.gradle, META-INF/mods.toml, and @Mod Java sources ready for ./gradlew build'
              : 'Includes Cargo.toml (jni cdylib), lib.rs, and every selected mod converted to Rust'}
          </p>
        </div>
      </section>
    </div>
  );
};

function modLangLabel(lang: ModCodeLanguage): string {
  return lang === 'java' ? 'Java @Mod' : 'Rust JNI';
}
