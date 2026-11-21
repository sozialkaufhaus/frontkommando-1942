import { useState } from 'react';
import { Clock, Lock, X, Zap } from 'lucide-react';
import {
  BUILDINGS,
  BUILDING_ORDER,
  checkPrerequisites,
  getBuildingCost,
  getBuildingDurationSec,
  getBuildingEnergyUse,
  getEnergyProduced,
} from '@shared/gameData';
import type { BuildingId, GameStateResponse, Resources } from '@shared/types';
import { api, fmtDuration, fmtNum } from '../api';

interface BuildingsProps {
  state: GameStateResponse;
  liveResources: Resources;
  nowMs: number;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function Buildings({ state, liveResources, nowMs, onRefresh, onNotify }: BuildingsProps) {
  const { activeBase, research } = state;
  const [busy, setBusy] = useState<string | null>(null);

  const handleBuild = async (id: BuildingId) => {
    setBusy(id);
    try {
      await api.startBuild(activeBase.id, id);
      onNotify(`${BUILDINGS[id].name} wird ausgebaut.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Bau fehlgeschlagen.', true);
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy('cancel');
    try {
      await api.cancelBuild(activeBase.id);
      onNotify('Bauauftrag abgebrochen. Rohstoffe erstattet.');
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Abbruch fehlgeschlagen.', true);
    } finally {
      setBusy(null);
    }
  };

  const resourceBuildings = BUILDING_ORDER.filter((id) => BUILDINGS[id].category === 'resources');
  const facilityBuildings = BUILDING_ORDER.filter((id) => BUILDINGS[id].category === 'facility');

  const renderGroup = (title: string, ids: BuildingId[]) => (
    <section className="space-y-3">
      <h3 className="text-xs uppercase tracking-[0.22em] text-amber-400 font-semibold border-b border-stone-800 pb-2">
        {title}
      </h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ids.map((id) => {
          const def = BUILDINGS[id];
          const level = activeBase.buildings[id] || 0;
          const nextLevel = level + 1;
          const cost = getBuildingCost(id, nextLevel);
          const duration = getBuildingDurationSec(id, nextLevel, activeBase.buildings.hq);
          const prereq = checkPrerequisites(def.prereq, activeBase.buildings, research);
          const isBuildingThis = activeBase.buildQueue?.buildingId === id;
          const queueBusy = Boolean(activeBase.buildQueue);

          const canAfford =
            liveResources.steel >= cost.steel &&
            liveResources.munition >= cost.munition &&
            liveResources.fuel >= cost.fuel;

          const energyDelta =
            id === 'power_plant'
              ? getEnergyProduced(nextLevel) - getEnergyProduced(level)
              : -(getBuildingEnergyUse(id, nextLevel) - getBuildingEnergyUse(id, level));

          const remSec = isBuildingThis
            ? Math.max(0, Math.ceil((activeBase.buildQueue!.endsAt - nowMs) / 1000))
            : 0;

          return (
            <div key={id} className="ops-card rounded-xl overflow-hidden flex flex-col">
              <div className="relative h-36 bg-black/50">
                <img
                  src={def.image}
                  alt={def.name}
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121614] via-transparent to-black/30" />
                <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded bg-black/75 border border-amber-500/45 font-mono-num text-xs font-bold text-amber-300">
                  Stufe {level}
                </div>
                <div className="absolute bottom-2.5 left-3 right-3">
                  <div className="font-display text-base font-bold text-[#f3ebd8] leading-tight">
                    {def.name}
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-stone-400 leading-relaxed">{def.description}</p>

                  {energyDelta !== 0 && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-mono-num px-2 py-0.5 rounded bg-black/40 border border-stone-800">
                      <Zap className={`w-3 h-3 ${energyDelta > 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span className={energyDelta > 0 ? 'text-emerald-300' : 'text-stone-300'}>
                        Strom: {energyDelta > 0 ? `+${energyDelta}` : energyDelta}
                      </span>
                    </div>
                  )}

                  {/* Costs */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-num pt-1">
                    {cost.steel > 0 && (
                      <div
                        className={`px-2 py-1 rounded bg-black/45 border ${
                          liveResources.steel >= cost.steel
                            ? 'border-stone-800 text-slate-200'
                            : 'border-red-800/60 text-red-400'
                        }`}
                      >
                        <div className="text-[9px] text-stone-500 uppercase">Stahl</div>
                        {fmtNum(cost.steel)}
                      </div>
                    )}
                    {cost.munition > 0 && (
                      <div
                        className={`px-2 py-1 rounded bg-black/45 border ${
                          liveResources.munition >= cost.munition
                            ? 'border-stone-800 text-amber-200'
                            : 'border-red-800/60 text-red-400'
                        }`}
                      >
                        <div className="text-[9px] text-stone-500 uppercase">Munition</div>
                        {fmtNum(cost.munition)}
                      </div>
                    )}
                    {cost.fuel > 0 && (
                      <div
                        className={`px-2 py-1 rounded bg-black/45 border ${
                          liveResources.fuel >= cost.fuel
                            ? 'border-stone-800 text-emerald-200'
                            : 'border-red-800/60 text-red-400'
                        }`}
                      >
                        <div className="text-[9px] text-stone-500 uppercase">Treibstoff</div>
                        {fmtNum(cost.fuel)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div>
                  {isBuildingThis ? (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/50">
                      <span className="text-xs font-mono-num text-amber-300 font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Ausbau: {fmtDuration(remSec)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={busy !== null}
                        title="Abbrechen"
                        className="p-1 rounded bg-red-950/70 hover:bg-red-800/70 text-red-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : !prereq.met ? (
                    <div className="p-2 rounded-lg bg-black/50 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>Benötigt: {prereq.missing.join(', ')}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford || queueBusy || busy !== null}
                      onClick={() => handleBuild(id)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-between transition cursor-pointer ${
                        canAfford && !queueBusy
                          ? 'bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200'
                          : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Ausbau St. {nextLevel}</span>
                      <span className="font-mono-num text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtDuration(duration)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {/* Interactive Visual Base Compound Blueprint */}
      <div className="ops-panel rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-[#f3ebd8]">
              Taktischer Stützpunkt-Lageplan — {activeBase.name}
            </h2>
            <p className="text-xs text-stone-400">
              Klicke auf eine Anlage im Geländeplan, um sie direkt auszubauen.
            </p>
          </div>
          <div className="text-xs font-mono-num text-amber-300">
            Gesamt-Ausbaustufe:{' '}
            {BUILDING_ORDER.reduce((acc, id) => acc + (activeBase.buildings[id] || 0), 0)}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 p-3 rounded-lg bg-[#0c110e] border border-stone-800 ops-grid-bg">
          {BUILDING_ORDER.map((id) => {
            const def = BUILDINGS[id];
            const lvl = activeBase.buildings[id] || 0;
            const isUpgrading = activeBase.buildQueue?.buildingId === id;
            const prereq = checkPrerequisites(def.prereq, activeBase.buildings, research);
            const cost = getBuildingCost(id, lvl + 1);
            const canAfford =
              liveResources.steel >= cost.steel &&
              liveResources.munition >= cost.munition &&
              liveResources.fuel >= cost.fuel;

            return (
              <button
                key={id}
                type="button"
                disabled={!prereq.met || !canAfford || Boolean(activeBase.buildQueue) || busy !== null}
                onClick={() => handleBuild(id)}
                title={
                  isUpgrading
                    ? `${def.name} wird ausgebaut...`
                    : !prereq.met
                      ? `Benötigt: ${prereq.missing.join(', ')}`
                      : `Klicken für Ausbau auf Stufe ${lvl + 1}`
                }
                className={`relative rounded-lg overflow-hidden border text-left transition group ${
                  isUpgrading
                    ? 'border-amber-400 ring-1 ring-amber-400/60'
                    : prereq.met && canAfford && !activeBase.buildQueue
                      ? 'border-stone-700 hover:border-amber-400 cursor-pointer'
                      : 'border-stone-800/80 opacity-65 cursor-default'
                }`}
              >
                <div className="h-16 bg-black relative">
                  <img
                    src={def.image}
                    alt={def.name}
                    className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <span
                    className={`absolute top-1 right-1 px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold ${
                      isUpgrading
                        ? 'bg-amber-500 text-black animate-pulse'
                        : 'bg-black/80 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    St.{lvl}
                  </span>
                </div>
                <div className="px-2 py-1.5 bg-[#121714]">
                  <div className="text-[11px] font-semibold text-[#efe8d8] truncate">
                    {def.name}
                  </div>
                  <div className="text-[9px] text-stone-400 truncate">
                    {isUpgrading
                      ? 'Im Ausbau...'
                      : !prereq.met
                        ? 'Gesperrt'
                        : canAfford
                          ? 'Ausbau bereit'
                          : 'Rohstoffe fehlen'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {renderGroup('Rohstoff- & Energiebetriebe', resourceBuildings)}
      {renderGroup('Militär- & Stützpunktanlagen', facilityBuildings)}
    </div>
  );
}
