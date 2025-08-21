// PNCL Cage Monitor – Phase 2 Draft Frontend (React + Tailwind)
// Update 2025-08-21b: Further compaction. Smaller cards, tighter spacing, fixed heights,
// cleaned AUTO layout (no descriptive text), and MANUAL switches converted to single toggles.

import { useMemo, useRef, useState } from "react";

const MODES = ["OFF", "MANUAL", "SEMI", "AUTO"] as const;
type Mode = typeof MODES[number];

type Bowl = "IN" | "OUT";
type Level = "OK" | "LOW";

type AutoSettings = {
  stirEveryMin: number;
  stirDurationSec: number;
  autoExitEnabled: boolean;
  autoExitTime: string; // HH:MM 24h
};

type Cage = {
  id: number; // 0..47
  station: number; // 1..8
  cageNumber: number; // 1..6 in station
  name: string; // C1..C48
  mode: Mode;
  bowl: Bowl;
  stirring: boolean;
  valveOpen: boolean;
  level: Level; // display-only here
  selected: boolean;
  auto: AutoSettings;
};

function createInitialCages(): Cage[] {
  const out: Cage[] = [];
  let id = 0;
  for (let s = 1; s <= 8; s++) {
    for (let c = 1; c <= 6; c++) {
      out.push({
        id,
        station: s,
        cageNumber: c,
        name: `C${id + 1}`,
        mode: "OFF",
        bowl: "IN",
        stirring: false,
        valveOpen: false,
        level: "OK",
        selected: false,
        auto: { stirEveryMin: 15, stirDurationSec: 10, autoExitEnabled: false, autoExitTime: "06:00" },
      });
      id++;
    }
  }
  return out;
}

export default function CageMonitorApp() {
  const [cages, setCages] = useState<Cage[]>(createInitialCages);

  const autoIntervals = useRef<Map<number, any>>(new Map());
  const autoTimeouts = useRef<Map<number, any>>(new Map());

  function updateCage(id: number, updater: (c: Cage) => Cage) {
    setCages((prev) => prev.map((c) => (c.id === id ? updater({ ...c }) : c)));
  }
  function updateMany(ids: number[], updater: (c: Cage) => Cage) {
    setCages((prev) => prev.map((c) => (ids.includes(c.id) ? updater({ ...c }) : c)));
  }

  function clearAutoTimers(id: number) {
    const i = autoIntervals.current.get(id);
    if (i) clearInterval(i);
    autoIntervals.current.delete(id);
    const t = autoTimeouts.current.get(id);
    if (t) clearTimeout(t);
    autoTimeouts.current.delete(id);
  }

  function autoAdjustValveByLevel(c: Cage): boolean {
    return c.level === "LOW";
  }

  function startAutoSchedule(c: Cage) {
    clearAutoTimers(c.id);
    updateCage(c.id, (cc) => ({ ...cc, stirring: true }));
    const t = setTimeout(() => updateCage(c.id, (cc) => ({ ...cc, stirring: false })), 30_000);
    autoTimeouts.current.set(c.id, t);

    const minutes = Math.max(0, c.auto.stirEveryMin);
    const durSec = Math.max(0, c.auto.stirDurationSec);
    if (minutes > 0 && durSec > 0) {
      const i = setInterval(() => {
        updateCage(c.id, (cc) => ({ ...cc, stirring: true }));
        const to = setTimeout(() => updateCage(c.id, (cc) => ({ ...cc, stirring: false })), durSec * 1000);
        const old = autoTimeouts.current.get(c.id);
        if (old) clearTimeout(old);
        autoTimeouts.current.set(c.id, to);
      }, minutes * 60 * 1000);
      autoIntervals.current.set(c.id, i);
    }
  }

  function applyMode(id: number, mode: Mode) {
    updateCage(id, (c) => {
      if (c.mode === "AUTO" && mode !== "AUTO") clearAutoTimers(id);
      let next: Cage = { ...c, mode };
      if (mode === "OFF") next = { ...next, bowl: "IN", stirring: false, valveOpen: false };
      if (mode === "MANUAL") next = { ...next, bowl: "OUT", stirring: false, valveOpen: false };
      if (mode === "SEMI") next = { ...next, bowl: "IN", stirring: false, valveOpen: false };
      if (mode === "AUTO") {
        next = { ...next, bowl: "IN", stirring: true, valveOpen: autoAdjustValveByLevel(c) };
        setTimeout(() => startAutoSchedule({ ...next }), 0);
      }
      return next;
    });
  }

  function toggleBowl(id: number) {
    updateCage(id, (c) => {
      const to: Bowl = c.bowl === "IN" ? "OUT" : "IN";
      const next = { ...c, bowl: to };
      if (to === "OUT") next.valveOpen = false; // interlock
      return next;
    });
  }
  function toggleStir(id: number) {
    updateCage(id, (c) => ({ ...c, stirring: !c.stirring }));
  }
  function toggleValve(id: number) {
    updateCage(id, (c) => {
      if (c.bowl !== "IN" && !c.valveOpen) return c; // cannot open if bowl OUT
      return { ...c, valveOpen: !c.valveOpen };
    });
  }

  function toggleSelected(id: number) {
    updateCage(id, (c) => ({ ...c, selected: !c.selected }));
  }

  function setLevel(id: number, level: Level) {
    updateCage(id, (c) => {
      const next = { ...c, level };
      if (c.mode === "AUTO") next.valveOpen = autoAdjustValveByLevel(next);
      return next;
    });
  }
  function setAutoSettings(id: number, patch: Partial<AutoSettings>) {
    updateCage(id, (c) => {
      const next = { ...c, auto: { ...c.auto, ...patch } };
      if (c.mode === "AUTO") setTimeout(() => startAutoSchedule(next), 0);
      return next;
    });
  }

  const stations = useMemo(() => {
    const m: Record<number, Cage[]> = {};
    cages.forEach((c) => {
      if (!m[c.station]) m[c.station] = [];
      m[c.station].push(c);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.id - b.id));
    return m;
  }, [cages]);

  const selectedIds = cages.filter((c) => c.selected).map((c) => c.id);
  const selectedCages = cages.filter((c) => c.selected);
  const allSelectedSameMode = selectedCages.length > 0 && selectedCages.every((c) => c.mode === selectedCages[0].mode);

  const [groupMode, setGroupMode] = useState<Mode>("OFF");
  const [groupAuto, setGroupAuto] = useState<AutoSettings>({ stirEveryMin: 15, stirDurationSec: 10, autoExitEnabled: false, autoExitTime: "06:00" });

  function applyGroupMode() {
    selectedIds.forEach((id) => applyMode(id, groupMode));
  }
  function applyGroupManual(action: "BOWL" | "STIR" | "VALVE") {
    updateMany(selectedIds, (c) => {
      if (c.mode !== "MANUAL") return c;
      if (action === "BOWL") {
        const to = c.bowl === "IN" ? "OUT" : "IN";
        const next = { ...c, bowl: to } as Cage;
        if (to === "OUT") next.valveOpen = false;
        return next;
      }
      if (action === "STIR") return { ...c, stirring: !c.stirring };
      if (action === "VALVE") {
        if (c.bowl !== "IN" && !c.valveOpen) return c;
        return { ...c, valveOpen: !c.valveOpen };
      }
      return c;
    });
  }
  function applyGroupAutoSettings() {
    updateMany(selectedIds, (c) => {
      if (c.mode !== "AUTO") return c;
      const next: Cage = { ...c, auto: { ...c.auto, ...groupAuto } };
      setTimeout(() => startAutoSchedule(next), 0);
      return next;
    });
  }

  function selectAllInStation(station: number, value: boolean) {
    setCages((prev) => prev.map((c) => (c.station === station ? { ...c, selected: value } : c)));
  }
  function clearAllSelections() {
    setCages((prev) => prev.map((c) => ({ ...c, selected: false })));
  }

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 text-[11px] leading-tight">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-3 py-2 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">PNCL Cage Monitor</h1>
            <p className="text-[10px] text-slate-600">48 cages</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <LegendBadge color="bg-slate-400" label="Off" />
            <LegendBadge color="bg-sky-500" label="Manual" />
            <LegendBadge color="bg-violet-500" label="Semi (API)" />
            <LegendBadge color="bg-emerald-500" label="Automatic" />
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-3 py-3 flex gap-3">
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((station) => (
              <StationCard
                key={station}
                station={station}
                cages={stations[station] || []}
                onSelectAll={(val) => selectAllInStation(station, val)}
                applyMode={applyMode}
                toggleBowl={toggleBowl}
                toggleStir={toggleStir}
                toggleValve={toggleValve}
                toggleSelected={toggleSelected}
                setLevel={setLevel}
                setAutoSettings={setAutoSettings}
              />
            ))}
          </div>
        </div>

        <div className="w-48 shrink-0">
          <GroupPanel
            selectedCount={selectedIds.length}
            allSelectedSameMode={allSelectedSameMode}
            sharedMode={allSelectedSameMode && selectedCages.length ? selectedCages[0].mode : undefined}
            groupMode={groupMode}
            setGroupMode={setGroupMode}
            onApplyGroupMode={applyGroupMode}
            onClearSelections={clearAllSelections}
            groupAuto={groupAuto}
            setGroupAuto={setGroupAuto}
            onApplyGroupManual={applyGroupManual}
            onApplyGroupAuto={applyGroupAutoSettings}
            selectedCages={selectedCages}
          />
        </div>
      </div>
    </div>
  );
}

function LegendBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded ${color}`}></span>
      <span>{label}</span>
    </div>
  );
}

function StationCard({
  station,
  cages,
  onSelectAll,
  applyMode,
  toggleBowl,
  toggleStir,
  toggleValve,
  toggleSelected,
  setLevel,
  setAutoSettings,
}: {
  station: number;
  cages: Cage[];
  onSelectAll: (value: boolean) => void;
  applyMode: (id: number, m: Mode) => void;
  toggleBowl: (id: number) => void;
  toggleStir: (id: number) => void;
  toggleValve: (id: number) => void;
  toggleSelected: (id: number) => void;
  setLevel: (id: number, level: Level) => void;
  setAutoSettings: (id: number, patch: Partial<AutoSettings>) => void;
}) {
  const allSelected = cages.length > 0 && cages.every((c) => c.selected);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="px-2.5 py-1 border-b border-slate-100 flex items-center justify-between">
        <div className="font-medium text-[13px] flex items-center gap-2">
          <span>Feeding Station {station}</span>
          <a href="#brainbox1" className="text-[11px] underline text-slate-600 hover:text-slate-800">BrainBox 1</a>
          <a href="#brainbox2" className="text-[11px] underline text-slate-600 hover:text-slate-800">BrainBox 2</a>
        </div>
        <label className="flex items-center gap-2 text-[11px] select-none">
          <input type="checkbox" className="h-3.5 w-3.5" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
          Select all in station
        </label>
      </div>
      <div className="p-1.5 grid grid-cols-3 gap-1">
        {cages.map((cage) => (
          <CageCard
            key={cage.id}
            cage={cage}
            applyMode={applyMode}
            toggleBowl={toggleBowl}
            toggleStir={toggleStir}
            toggleValve={toggleValve}
            toggleSelected={toggleSelected}
            setLevel={setLevel}
            setAutoSettings={setAutoSettings}
          />
        ))}
      </div>
    </div>
  );
}

function CageCard({
  cage,
  applyMode,
  toggleBowl,
  toggleStir,
  toggleValve,
  toggleSelected,
  setAutoSettings,
}: {
  cage: Cage;
  applyMode: (id: number, m: Mode) => void;
  toggleBowl: (id: number) => void;
  toggleStir: (id: number) => void;
  toggleValve: (id: number) => void;
  toggleSelected: (id: number) => void;
  setLevel: (id: number, level: Level) => void;
  setAutoSettings: (id: number, patch: Partial<AutoSettings>) => void;
}) {
  const modeColor = cage.mode === "OFF" ? "bg-slate-50" : cage.mode === "MANUAL" ? "bg-sky-50" : cage.mode === "SEMI" ? "bg-violet-50" : "bg-emerald-50";
  const headerPill = cage.mode === "OFF" ? "bg-slate-400" : cage.mode === "MANUAL" ? "bg-sky-500" : cage.mode === "SEMI" ? "bg-violet-500" : "bg-emerald-500";

  return (
    <div className={`border border-slate-200 rounded-md ${modeColor}`}>
      <div className="px-1.5 py-0.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded ${headerPill}`}></span>
          <span className="font-semibold text-[12px]">{cage.name}</span>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] select-none">
          <input type="checkbox" className="h-3.5 w-3.5" checked={cage.selected} onChange={() => toggleSelected(cage.id)} />
          Sel
        </label>
      </div>

      {/* Mode Selector */}
      <div className="px-1.5 pt-0.5 pb-0.5 flex flex-wrap gap-0.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => applyMode(cage.id, m)}
            className={`${cage.mode === m ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300"} px-1.5 py-0.5 rounded-full text-[10px] border`}
          >
            {m === "SEMI" ? "SEMI" : m}
          </button>
        ))}
      </div>

      {/* Status row (hidden for OFF) */}
      {cage.mode !== "OFF" && (
        <div className="px-1.5 pb-0.5 grid grid-cols-2 gap-0.5 text-[10px]">
          <StatusChip label="Bowl" value={cage.bowl} />
          <StatusChip label="Stir" value={cage.stirring ? "ON" : "OFF"} />
          <StatusChip label="Valve" value={cage.valveOpen ? "ON" : "OFF"} />
          <StatusChip label="Level" value={cage.level} />
        </div>
      )}

      {/* Fixed-height body (smaller) */}
      <div className="px-1.5 pb-1.5 min-h-[88px]">
        {cage.mode === "OFF" && <p className="text-[10px] text-slate-600">Inactive. Bowl <b>IN</b>. All off.</p>}

        {cage.mode === "MANUAL" && (
          <div className="grid grid-cols-3 gap-0.5">
            <CompactToggle
              label="Bowl"
              value={cage.bowl === "IN" ? "IN" : "OUT"}
              onClick={() => toggleBowl(cage.id)}
            />
            <CompactToggle label="Stir" value={cage.stirring ? "ON" : "OFF"} onClick={() => toggleStir(cage.id)} />
            <CompactToggle
              label="Valve"
              value={cage.valveOpen ? "ON" : "OFF"}
              onClick={() => toggleValve(cage.id)}
              disabled={cage.bowl !== "IN" && !cage.valveOpen}
              title={cage.bowl !== "IN" && !cage.valveOpen ? "Requires bowl IN" : ""}
            />
          </div>
        )}

        {cage.mode === "SEMI" && <div className="text-[11px] text-slate-600">API-controlled. Manual disabled.</div>}

        {cage.mode === "AUTO" && (
          <div className="bg-white rounded border p-1 space-y-1">
            <div className="text-[10px] font-medium">Stir</div>
            <div className="flex items-center gap-1 text-[10px] whitespace-nowrap">
              <span>Every</span>
              <input
                type="number"
                min={0}
                className="w-10 px-1 py-0.5 border rounded text-[10px] appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={cage.auto.stirEveryMin}
                onChange={(e) => setAutoSettings(cage.id, { stirEveryMin: Number(e.target.value) })}
              />
              <span>min</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] whitespace-nowrap">
              <span>for</span>
              <input
                type="number"
                min={0}
                className="w-10 px-1 py-0.5 border rounded text-[10px] appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={cage.auto.stirDurationSec}
                onChange={(e) => setAutoSettings(cage.id, { stirDurationSec: Number(e.target.value) })}
              />
              <span>sec</span>
            </div>
            <label className="flex items-center gap-1 text-[10px]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={cage.auto.autoExitEnabled}
                onChange={(e) => setAutoSettings(cage.id, { autoExitEnabled: e.target.checked })}
              />
              Auto exit at
            </label>
            <div className="flex items-center gap-1 text-[10px]">
              <input
                type="time"
                className="px-1 py-0.5 border rounded text-[10px]"
                value={cage.auto.autoExitTime}
                onChange={(e) => setAutoSettings(cage.id, { autoExitTime: e.target.value })}
                disabled={!cage.auto.autoExitEnabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border px-1 py-0.5 flex items-center justify-between">
      <span className="text-slate-500 text-[9px]">{label}</span>
      <span className="font-semibold text-[9px]">{value}</span>
    </div>
  );
}

function CompactToggle({ label, value, onClick, disabled, title }: { label: string; value: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      className={`bg-white rounded border px-1.5 py-0.5 text-left ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"}`}
      onClick={() => !disabled && onClick()}
      title={title}
    >
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="text-[11px] font-semibold">{value}</div>
    </button>
  );
}

function GroupPanel({
  selectedCount,
  allSelectedSameMode,
  sharedMode,
  groupMode,
  setGroupMode,
  onApplyGroupMode,
  onClearSelections,
  groupAuto,
  setGroupAuto,
  onApplyGroupManual,
  onApplyGroupAuto,
  selectedCages,
}: {
  selectedCount: number;
  allSelectedSameMode: boolean;
  sharedMode?: Mode;
  groupMode: Mode;
  setGroupMode: (m: Mode) => void;
  onApplyGroupMode: () => void;
  onClearSelections: () => void;
  groupAuto: AutoSettings;
  setGroupAuto: (s: AutoSettings) => void;
  onApplyGroupManual: (act: "BOWL" | "STIR" | "VALVE") => void;
  onApplyGroupAuto: () => void;
  selectedCages: Cage[];
}) {
  const canManual = allSelectedSameMode && sharedMode === "MANUAL";
  const canAuto = allSelectedSameMode && sharedMode === "AUTO";

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm sticky top-[56px] max-h-[calc(100vh-72px)] overflow-auto">
      <div className="px-2.5 py-1.5 border-b border-slate-100">
        <div className="font-medium">Group Control</div>
        <div className="text-[11px] text-slate-600">{selectedCount} selected</div>
      </div>

      <div className="p-2.5 space-y-2.5 text-[11px]">
        <section className="bg-slate-50 rounded border border-slate-200 p-2">
          <div className="font-medium mb-1">Set Mode</div>
          <div className="flex flex-wrap gap-1">
            {MODES.map((m) => (
              <button key={m} onClick={() => setGroupMode(m)} className={`px-2 py-0.5 rounded-full text-[11px] border ${groupMode === m ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300"}`}>{m === "SEMI" ? "SEMI" : m}</button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <button onClick={onApplyGroupMode} className="px-2.5 py-0.5 rounded border bg-slate-900 text-white" disabled={selectedCount === 0}>Apply</button>
            <button onClick={onClearSelections} className="px-2.5 py-0.5 rounded border">Clear</button>
          </div>
          {!allSelectedSameMode && selectedCount > 0 && (
            <div className="mt-1 text-[10px] text-slate-500">Mixed modes selected. Controls disabled until unified.</div>
          )}
        </section>

        <section className={`rounded border p-2 ${canManual ? "bg-sky-50 border-sky-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
          <div className="font-medium mb-1">Manual Controls</div>
          <div className="grid grid-cols-3 gap-0.5">
            <button className="px-2 py-1 rounded border" disabled={!canManual} onClick={() => onApplyGroupManual("BOWL")}>Toggle Bowl</button>
            <button className="px-2 py-1 rounded border" disabled={!canManual} onClick={() => onApplyGroupManual("STIR")}>Toggle Stir</button>
            <button className="px-2 py-1 rounded border" disabled={!canManual} onClick={() => onApplyGroupManual("VALVE")}>Toggle Valve</button>
          </div>
        </section>

        <section className={`rounded border p-2 ${canAuto ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
          <div className="font-medium mb-1">Automatic Controls</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span>Every</span>
              <input
                type="number"
                min={0}
                className="w-16 px-1 py-0.5 border rounded"
                value={groupAuto.stirEveryMin}
                onChange={(e) => setGroupAuto({ ...groupAuto, stirEveryMin: Number(e.target.value) })}
                disabled={!canAuto}
              />
              <span>min</span>
            </div>
            <div className="flex items-center gap-1">
              <span>for</span>
              <input
                type="number"
                min={0}
                className="w-16 px-1 py-0.5 border rounded"
                value={groupAuto.stirDurationSec}
                onChange={(e) => setGroupAuto({ ...groupAuto, stirDurationSec: Number(e.target.value) })}
                disabled={!canAuto}
              />
              <span>sec</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-3.5 w-3.5" checked={groupAuto.autoExitEnabled} onChange={(e) => setGroupAuto({ ...groupAuto, autoExitEnabled: e.target.checked })} disabled={!canAuto} />
                Exit at
              </label>
              <input type="time" className="px-1 py-0.5 border rounded" value={groupAuto.autoExitTime} onChange={(e) => setGroupAuto({ ...groupAuto, autoExitTime: e.target.value })} disabled={!canAuto} />
            </div>
            <button className="px-2.5 py-0.5 rounded border bg-slate-900 text-white" onClick={onApplyGroupAuto} disabled={!canAuto}>Apply Auto Settings</button>
          </div>
        </section>

        <section className="rounded border border-slate-200 p-2 bg-white">
          <div className="font-medium mb-0.5">Selection</div>
          {selectedCages.length === 0 ? (
            <div className="text-[11px] text-slate-500">None</div>
          ) : (
            <ul className="text-[11px] text-slate-700 list-disc ml-4 space-y-0.5">
              {selectedCages.map((c) => (
                <li key={c.id}>{c.name}: <span className="uppercase">{c.mode}</span> · Bowl {c.bowl} · Stir {c.stirring ? "ON" : "OFF"} · Valve {c.valveOpen ? "ON" : "OFF"}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
