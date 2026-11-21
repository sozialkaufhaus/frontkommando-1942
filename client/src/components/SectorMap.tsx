import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Flag,
  Map as MapIcon,
  Truck,
} from 'lucide-react';
import { MAX_SECTORS } from '@shared/gameData';
import type { GameStateResponse, MissionType, SectorSlot } from '@shared/types';
import { api, fmtNum } from '../api';

interface SectorMapProps {
  state: GameStateResponse;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onPlanMission: (sector: number, position: number, missionType: MissionType) => void;
}

export function SectorMap({ state, onRefresh, onNotify, onPlanMission }: SectorMapProps) {
  const [sector, setSector] = useState(state.activeBase.sector);
  const [slots, setSlots] = useState<SectorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [spyingPos, setSpyingPos] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getSector(sector)
      .then((res) => {
        if (!cancelled) setSlots(res.slots);
      })
      .catch((err) => {
        if (!cancelled) onNotify(err.message, true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sector, onNotify]);

  const handleQuickSpy = async (targetPos: number) => {
    if ((state.activeBase.units.scout_car || 0) < 1) {
      onNotify('Kein Spähwagen im aktiven Stützpunkt! Baue zuerst einen Spähwagen.', true);
      return;
    }
    setSpyingPos(targetPos);
    try {
      await api.launchMission({
        originBaseId: state.activeBase.id,
        targetSector: sector,
        targetPosition: targetPos,
        missionType: 'spy',
        units: { scout_car: 1 },
        cargo: { steel: 0, munition: 0, fuel: 0 },
      });
      onNotify(`Spähwagen zur Aufklärung nach [${sector}:${targetPos}] entsandt!`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Aufklärung fehlgeschlagen.', true);
    } finally {
      setSpyingPos(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sector Navigator */}
      <div className="ops-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-amber-400" />
            Taktische Sektorenkarte — Front-Sektor {sector}
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Spähwagen bereit: <span className="font-mono-num text-amber-300 font-bold">{state.activeBase.units.scout_car || 0}</span> •
            Direkte Aufklärung per Klick oder detaillierter Marschbefehl.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={sector <= 1}
            onClick={() => setSector((s) => Math.max(1, s - 1))}
            className="p-2 rounded-lg bg-[#161b17] hover:bg-[#222a23] border border-stone-700 disabled:opacity-35 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1">
            {Array.from({ length: MAX_SECTORS }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSector(s)}
                className={`w-9 h-9 rounded-lg font-mono-num text-xs font-bold border transition cursor-pointer ${
                  s === sector
                    ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                    : 'bg-[#141815] border-stone-700/70 text-stone-400 hover:text-stone-200'
                }`}
              >
                S{s}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={sector >= MAX_SECTORS}
            onClick={() => setSector((s) => Math.min(MAX_SECTORS, s + 1))}
            className="p-2 rounded-lg bg-[#161b17] hover:bg-[#222a23] border border-stone-700 disabled:opacity-35 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sector Positions Table */}
      <div className="ops-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">
            Lade Sektor-Aufklärungsdaten...
          </div>
        ) : (
          <div className="divide-y divide-stone-800/80">
            {slots.map((slot) => {
              const isCurrentOrigin =
                slot.sector === state.activeBase.sector &&
                slot.position === state.activeBase.position;

              return (
                <div
                  key={slot.position}
                  className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs transition ${
                    slot.isOwn
                      ? 'bg-emerald-950/20'
                      : slot.isAi
                        ? 'bg-amber-950/10 hover:bg-amber-950/20'
                        : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-[240px]">
                    <span className="font-mono-num text-xs font-bold px-2 py-1 rounded bg-black/50 border border-stone-700 text-amber-300 w-14 text-center">
                      [{slot.sector}:{slot.position}]
                    </span>

                    {slot.baseId ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#f3ebd8]">
                            {slot.baseName}
                          </span>
                          {slot.isOwn && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-900/60 border border-emerald-500/40 text-emerald-200">
                              Eigener Stützpunkt
                            </span>
                          )}
                          {slot.isAi && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                slot.aiDifficulty === 'Leicht'
                                  ? 'bg-lime-950/60 border-lime-600/50 text-lime-300'
                                  : slot.aiDifficulty === 'Mittel'
                                    ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                                    : 'bg-red-950/60 border-red-600/50 text-red-300'
                              }`}
                            >
                              KI • {slot.aiDifficulty}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                          {!slot.isAi && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                slot.isOnline ? 'bg-emerald-400' : 'bg-stone-600'
                              }`}
                              title={slot.isOnline ? 'Online' : 'Offline'}
                            />
                          )}
                          <span>
                            Kommandant:{' '}
                            {slot.allianceTag && (
                              <span className="text-emerald-400 font-semibold mr-1">
                                [{slot.allianceTag}]
                              </span>
                            )}
                            <span className="text-stone-200">{slot.ownerName}</span> •{' '}
                            <span className="font-mono-num">{fmtNum(slot.points || 0)} Pkt</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-stone-500 italic">
                        Freies Frontgebiet — einnehmbar
                      </span>
                    )}
                  </div>

                  {/* Tactical Actions */}
                  <div className="flex items-center gap-1.5">
                    {slot.baseId && !slot.isOwn && (
                      <>
                        <button
                          type="button"
                          disabled={spyingPos === slot.position}
                          onClick={() => handleQuickSpy(slot.position)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/70 border border-sky-600/45 text-sky-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Sofort 1 Spähwagen zur Aufklärung senden"
                        >
                          <Eye className="w-3.5 h-3.5" /> Aufklären
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlanMission(slot.sector, slot.position, 'attack')}
                          className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-600/45 text-red-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" /> Angreifen
                        </button>
                      </>
                    )}

                    {slot.baseId && !isCurrentOrigin && (
                      <button
                        type="button"
                        onClick={() =>
                          onPlanMission(
                            slot.sector,
                            slot.position,
                            slot.isOwn ? 'deploy' : 'transport'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 border border-stone-600 text-stone-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />{' '}
                        {slot.isOwn ? 'Stationieren / Nachschub' : 'Transport'}
                      </button>
                    )}

                    {!slot.baseId && (
                      <button
                        type="button"
                        onClick={() => onPlanMission(slot.sector, slot.position, 'colonize')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-600/45 text-emerald-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" /> Einnehmen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
