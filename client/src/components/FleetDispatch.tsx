import { useEffect, useState } from 'react';
import { Clock, Compass, Fuel, Package, Send } from 'lucide-react';
import {
  MAX_SECTORS,
  POSITIONS_PER_SECTOR,
  UNITS,
  UNIT_ORDER,
  getFleetTravelStats,
  getMaxSimultaneousMissions,
} from '@shared/gameData';
import type { GameStateResponse, MissionType, Resources, UnitId } from '@shared/types';
import { MISSION_LABELS, api, fmtDuration, fmtNum } from '../api';

interface FleetDispatchProps {
  state: GameStateResponse;
  liveResources: Resources;
  initialTarget: { sector: number; position: number; missionType: MissionType } | null;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onDispatched: () => void;
}

const MISSION_TYPES: MissionType[] = ['attack', 'conquer', 'spy', 'transport', 'deploy', 'colonize'];

export function FleetDispatch({
  state,
  liveResources,
  initialTarget,
  onRefresh,
  onNotify,
  onDispatched,
}: FleetDispatchProps) {
  const { activeBase, research, activeMissions } = state;

  const [targetSector, setTargetSector] = useState(initialTarget?.sector ?? activeBase.sector);
  const [targetPosition, setTargetPosition] = useState(initialTarget?.position ?? 3);
  const [missionType, setMissionType] = useState<MissionType>(
    initialTarget?.missionType ?? 'attack'
  );
  const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitId, number>>>({});
  const [cargo, setCargo] = useState<Resources>({ steel: 0, munition: 0, fuel: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [showEmptyUnits, setShowEmptyUnits] = useState(false);

  useEffect(() => {
    if (initialTarget) {
      setTargetSector(initialTarget.sector);
      setTargetPosition(initialTarget.position);
      setMissionType(initialTarget.missionType);
      if (initialTarget.missionType === 'spy' && (activeBase.units.scout_car || 0) > 0) {
        setSelectedUnits({ scout_car: 1 });
      }
    }
  }, [initialTarget, activeBase.units.scout_car]);

  const maxSlots = getMaxSimultaneousMissions(research.logistics);
  const totalSelected = Object.values(selectedUnits).reduce((a, b) => a + (b || 0), 0);
  const travel = getFleetTravelStats(
    selectedUnits,
    activeBase.sector,
    activeBase.position,
    targetSector,
    targetPosition,
    research.engine_tech
  );

  const cargoUsed = cargo.steel + cargo.munition + cargo.fuel;
  const cargoOverflow = cargoUsed > travel.cargoCapacity;
  const notEnoughFuel = liveResources.fuel < cargo.fuel + travel.fuelCost;

  const setUnitCount = (id: UnitId, val: number) => {
    const max = activeBase.units[id] || 0;
    const clamped = Math.max(0, Math.min(max, Math.floor(val || 0)));
    setSelectedUnits((prev) => ({ ...prev, [id]: clamped }));
  };

  const selectAllCombat = () => {
    const next: Partial<Record<UnitId, number>> = {};
    for (const id of UNIT_ORDER) {
      if ((activeBase.units[id] || 0) > 0) next[id] = activeBase.units[id];
    }
    setSelectedUnits(next);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.launchMission({
        originBaseId: activeBase.id,
        targetSector,
        targetPosition,
        missionType,
        units: selectedUnits,
        cargo,
      });
      onNotify(
        `Marschbefehl „${MISSION_LABELS[missionType]}“ nach [${targetSector}:${targetPosition}] erteilt!`
      );
      setSelectedUnits({});
      setCargo({ steel: 0, munition: 0, fuel: 0 });
      onRefresh();
      onDispatched();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Marschbefehl fehlgeschlagen.', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleDispatch} className="space-y-5">
      <div className="ops-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            Marschbefehl &amp; Einsatzplanung
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Ausgangsbasis: {activeBase.name} [{activeBase.sector}:{activeBase.position}] • Aktive
            Verbände:{' '}
            <span className="font-mono-num text-amber-300 font-bold">
              {activeMissions.length} / {maxSlots}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={selectAllCombat}
          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-xs text-amber-200 cursor-pointer"
        >
          Alle verfügbaren Einheiten auswählen
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Unit Selection */}
        <div className="lg:col-span-2 ops-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold">
              1. Verband zusammenstellen
            </h3>
            <button
              type="button"
              onClick={() => setShowEmptyUnits((v) => !v)}
              className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
            >
              {showEmptyUnits ? 'Nur verfügbare zeigen' : 'Alle 60 Typen zeigen'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
            {UNIT_ORDER.filter((id) => showEmptyUnits || (activeBase.units[id] || 0) > 0).map(
              (id) => {
                const def = UNITS[id];
                const avail = activeBase.units[id] || 0;
                const chosen = selectedUnits[id] || 0;
                const displayName = def.factionNames[state.user.faction] || def.name;
                return (
                  <div
                    key={id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                      avail > 0
                        ? 'bg-black/45 border-stone-700/80'
                        : 'bg-black/20 border-stone-800/50 opacity-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#f0e9d8] truncate">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate">
                        #{def.archetypeNumber} {def.name}
                      </div>
                      <div className="text-[11px] font-mono-num text-stone-400">
                        Verfügbar: <span className="text-amber-300">{fmtNum(avail)}</span> • Lade:{' '}
                        {fmtNum(def.cargo)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={avail}
                        disabled={avail === 0}
                        value={chosen || ''}
                        placeholder="0"
                        onChange={(e) => setUnitCount(id, Number(e.target.value))}
                        className="w-16 px-2 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs font-mono-num text-center text-white focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={avail === 0}
                        onClick={() => setUnitCount(id, avail)}
                        className="px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-mono-num text-amber-300 cursor-pointer disabled:opacity-30"
                      >
                        Alle
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Right: Target, Mission, Cargo & Summary */}
        <div className="ops-panel rounded-xl p-4 space-y-4">
          <h3 className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold">
            2. Ziel &amp; Auftrag
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">
                Ziel-Sektor (1–{MAX_SECTORS})
              </label>
              <input
                type="number"
                min={1}
                max={MAX_SECTORS}
                value={targetSector}
                onChange={(e) => setTargetSector(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0c0f0d] border border-stone-700 font-mono-num text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">
                Position (1–{POSITIONS_PER_SECTOR})
              </label>
              <input
                type="number"
                min={1}
                max={POSITIONS_PER_SECTOR}
                value={targetPosition}
                onChange={(e) => setTargetPosition(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0c0f0d] border border-stone-700 font-mono-num text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">
              Missionstyp
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {MISSION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMissionType(t)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    missionType === t
                      ? 'bg-amber-600/25 border-amber-500 text-amber-200'
                      : 'bg-black/40 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {MISSION_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Cargo for Transport / Deploy / Colonize */}
          {(missionType === 'transport' ||
            missionType === 'deploy' ||
            missionType === 'colonize') && (
            <div className="space-y-2 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span className="flex items-center gap-1 uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-amber-400" /> Fracht
                </span>
                <span className={`font-mono-num ${cargoOverflow ? 'text-red-400 font-bold' : ''}`}>
                  {fmtNum(cargoUsed)} / {fmtNum(travel.cargoCapacity)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['steel', 'munition', 'fuel'] as const).map((resKey) => (
                  <div key={resKey}>
                    <label className="block text-[9px] uppercase text-stone-500 mb-0.5">
                      {resKey === 'steel'
                        ? 'Stahl'
                        : resKey === 'munition'
                          ? 'Munition'
                          : 'Treibstoff'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={Math.floor(liveResources[resKey])}
                      value={cargo[resKey] || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setCargo((prev) => ({
                          ...prev,
                          [resKey]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 font-mono-num text-xs text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Mission Telemetry */}
          <div className="p-3 rounded-lg bg-black/50 border border-stone-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Marschzeit (einfach)
              </span>
              <span className="font-mono-num font-bold text-amber-300">
                {totalSelected > 0 ? fmtDuration(travel.durationSec) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-emerald-400" /> Treibstoffbedarf
              </span>
              <span
                className={`font-mono-num font-bold ${
                  notEnoughFuel ? 'text-red-400' : 'text-emerald-300'
                }`}
              >
                {totalSelected > 0 ? fmtNum(travel.fuelCost) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-stone-400" /> Ladekapazität
              </span>
              <span className="font-mono-num text-stone-200">{fmtNum(travel.cargoCapacity)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              totalSelected === 0 ||
              cargoOverflow ||
              notEnoughFuel ||
              activeMissions.length >= maxSlots
            }
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-[#12100b] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Befehl wird übermittelt...' : 'Marschbefehl ausführen'}
          </button>
        </div>
      </div>
    </form>
  );
}
