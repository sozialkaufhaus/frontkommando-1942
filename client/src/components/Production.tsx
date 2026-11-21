import { useState } from 'react';
import { Clock, Crosshair, Lock, Shield, Zap } from 'lucide-react';
import {
  DEFENSES,
  DEFENSE_ORDER,
  UNITS,
  UNIT_ORDER,
  checkPrerequisites,
  getCombatEntityStats,
  getUnitDurationSec,
} from '@shared/gameData';
import type { CombatEntityId, DefenseId, GameStateResponse, Resources, UnitId } from '@shared/types';
import { api, fmtDuration, fmtNum } from '../api';

interface ProductionProps {
  mode: 'unit' | 'defense';
  state: GameStateResponse;
  liveResources: Resources;
  nowMs: number;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function Production({
  mode,
  state,
  liveResources,
  nowMs,
  onRefresh,
  onNotify,
}: ProductionProps) {
  const { activeBase, research } = state;
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const ids: CombatEntityId[] = mode === 'unit' ? UNIT_ORDER : DEFENSE_ORDER;

  const getMaxAffordable = (id: CombatEntityId): number => {
    const cost = mode === 'unit' ? UNITS[id as UnitId].cost : DEFENSES[id as DefenseId].cost;
    const limits: number[] = [];
    if (cost.steel > 0) limits.push(Math.floor(liveResources.steel / cost.steel));
    if (cost.munition > 0) limits.push(Math.floor(liveResources.munition / cost.munition));
    if (cost.fuel > 0) limits.push(Math.floor(liveResources.fuel / cost.fuel));
    return Math.min(500, Math.max(0, limits.length ? Math.min(...limits) : 0));
  };

  const handleProduce = async (id: CombatEntityId) => {
    const count = Math.max(1, Math.floor(Number(counts[id] || 1)));
    setBusy(id);
    try {
      await api.produce(activeBase.id, mode, id, count);
      const name = mode === 'unit' ? UNITS[id as UnitId].name : DEFENSES[id as DefenseId].name;
      onNotify(`${count}× ${name} in die Produktions-Warteschlange eingereiht.`);
      setCounts((prev) => ({ ...prev, [id]: '' }));
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Produktion fehlgeschlagen.', true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Active Queue */}
      <div className="ops-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
            {mode === 'unit' ? (
              <Crosshair className="w-5 h-5 text-amber-400" />
            ) : (
              <Shield className="w-5 h-5 text-emerald-400" />
            )}
            {mode === 'unit'
              ? 'Panzerwerk & Flugplatz — Einheitenproduktion'
              : 'Verteidigungsanlagen — Stützpunkt-Befestigung'}
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Panzerwerk St. {activeBase.buildings.tank_works} • Flugplatz St.{' '}
            {activeBase.buildings.airfield} • Waffentechnik +{research.weapons_tech * 10}% • Panzerung +
            {research.armor_tech * 10}%
          </p>
        </div>
      </div>

      {/* Production Queue Strip */}
      {activeBase.unitQueue.length > 0 && (
        <div className="ops-panel rounded-xl p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-400 font-semibold">
            Aktive Produktions-Warteschlange
          </div>
          <div className="flex flex-wrap gap-2">
            {activeBase.unitQueue.map((item, idx) => {
              const name = getCombatEntityStats(item.entityId).name;
              const remSec = Math.max(0, Math.ceil((item.nextEndsAt - nowMs) / 1000));
              return (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-lg bg-black/50 border border-amber-500/35 text-xs flex items-center gap-2.5"
                >
                  <span className="font-semibold text-[#f3ebd8]">
                    {item.count}× {name}
                  </span>
                  <span className="font-mono-num text-amber-300 font-bold">
                    {idx === 0 ? fmtDuration(remSec) : `${item.unitDurationSec}s/Stk`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ids.map((id) => {
          const isUnit = mode === 'unit';
          const uDef = isUnit ? UNITS[id as UnitId] : null;
          const dDef = !isUnit ? DEFENSES[id as DefenseId] : null;
          const def = (uDef || dDef)!;
          const owned = isUnit
            ? activeBase.units[id as UnitId] || 0
            : activeBase.defenses[id as DefenseId] || 0;
          const prereq = checkPrerequisites(def.prereq, activeBase.buildings, research);
          const duration = getUnitDurationSec(
            id,
            activeBase.buildings.tank_works,
            activeBase.buildings.airfield
          );
          const maxAff = getMaxAffordable(id);
          const rawQty = counts[id] ?? '1';
          const qty = Math.max(1, Math.floor(Number(rawQty) || 1));

          const effAttack = Math.round(def.attack * (1 + research.weapons_tech * 0.1));
          const effArmor = Math.round(def.structure * (1 + research.armor_tech * 0.1));

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
                  Bestand: {fmtNum(owned)}
                </div>
                {uDef && (
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 border border-stone-600/60 text-[10px] uppercase tracking-wider text-stone-300">
                    {uDef.category === 'air' ? 'Luftwaffe' : 'Heer'}
                  </div>
                )}
                <div className="absolute bottom-2.5 left-3 right-3">
                  <div className="font-display text-base font-bold text-[#f3ebd8] leading-tight">
                    {def.name}
                  </div>
                </div>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <p className="text-xs text-stone-400 leading-relaxed">{def.description}</p>

                  {/* Combat Stats */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-num">
                    <div className="px-2 py-1 rounded bg-black/40 border border-stone-800">
                      <div className="text-[9px] text-stone-500 uppercase">Angriff</div>
                      <span className="text-red-300 font-semibold">{fmtNum(effAttack)}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-black/40 border border-stone-800">
                      <div className="text-[9px] text-stone-500 uppercase">Panzerung</div>
                      <span className="text-sky-300 font-semibold">{fmtNum(effArmor)}</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-black/40 border border-stone-800">
                      <div className="text-[9px] text-stone-500 uppercase">
                        {uDef ? 'Laderaum' : 'Deckung'}
                      </div>
                      <span className="text-amber-200 font-semibold">
                        {fmtNum(uDef ? uDef.cargo : def.shield)}
                      </span>
                    </div>
                  </div>

                  {/* Rapidfire tags */}
                  {def.rapidfire && Object.keys(def.rapidfire).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(Object.entries(def.rapidfire) as [CombatEntityId, number][]).map(
                        ([targetId, rf]) => (
                          <span
                            key={targetId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-600/30 text-[10px] text-amber-300"
                          >
                            <Zap className="w-2.5 h-2.5" />
                            RF {rf}× vs {getCombatEntityStats(targetId).name}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Unit Cost */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-num">
                    {def.cost.steel > 0 && (
                      <div className="px-2 py-1 rounded bg-black/45 border border-stone-800 text-slate-200">
                        <div className="text-[9px] text-stone-500 uppercase">Stahl</div>
                        {fmtNum(def.cost.steel)}
                      </div>
                    )}
                    {def.cost.munition > 0 && (
                      <div className="px-2 py-1 rounded bg-black/45 border border-stone-800 text-amber-200">
                        <div className="text-[9px] text-stone-500 uppercase">Munition</div>
                        {fmtNum(def.cost.munition)}
                      </div>
                    )}
                    {def.cost.fuel > 0 && (
                      <div className="px-2 py-1 rounded bg-black/45 border border-stone-800 text-emerald-200">
                        <div className="text-[9px] text-stone-500 uppercase">Treibstoff</div>
                        {fmtNum(def.cost.fuel)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Production input & button */}
                <div>
                  {!prereq.met ? (
                    <div className="p-2 rounded-lg bg-black/50 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>Benötigt: {prereq.missing.join(', ')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={rawQty}
                        onChange={(e) =>
                          setCounts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        className="w-16 px-2 py-2 rounded-lg bg-[#0d100e] border border-stone-700 text-xs font-mono-num text-center text-white focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCounts((prev) => ({ ...prev, [id]: String(Math.max(1, maxAff)) }))
                        }
                        disabled={maxAff === 0}
                        className="px-2 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] font-mono-num text-amber-300 cursor-pointer disabled:opacity-40"
                        title={`Maximal bezahlbar: ${maxAff}`}
                      >
                        Max ({maxAff})
                      </button>
                      <button
                        type="button"
                        disabled={maxAff < qty || busy !== null}
                        onClick={() => handleProduce(id)}
                        className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-between transition cursor-pointer ${
                          maxAff >= qty
                            ? 'bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200'
                            : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        <span>Bauen</span>
                        <span className="font-mono-num text-[10px] flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {fmtDuration(duration)}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
