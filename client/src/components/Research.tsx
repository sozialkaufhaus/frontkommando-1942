import { useState } from 'react';
import { Clock, FlaskConical, Lock } from 'lucide-react';
import {
  RESEARCH,
  RESEARCH_ORDER,
  checkPrerequisites,
  getResearchCost,
  getResearchDurationSec,
} from '@shared/gameData';
import type { GameStateResponse, ResearchId, Resources } from '@shared/types';
import { api, fmtDuration, fmtNum } from '../api';

interface ResearchProps {
  state: GameStateResponse;
  liveResources: Resources;
  nowMs: number;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function Research({ state, liveResources, nowMs, onRefresh, onNotify }: ResearchProps) {
  const { activeBase, research, researchQueue } = state;
  const [busy, setBusy] = useState<string | null>(null);

  const handleResearch = async (id: ResearchId) => {
    setBusy(id);
    try {
      await api.startResearch(activeBase.id, id);
      onNotify(`Forschung „${RESEARCH[id].name}“ gestartet.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Forschung fehlgeschlagen.', true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="ops-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-400" />
            Forschungszentrum (Stufe {activeBase.buildings.research_lab})
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Forschung gilt global für alle deine Stützpunkte und Verbände.
          </p>
        </div>
        {activeBase.buildings.research_lab === 0 && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-600/50 text-xs text-amber-200">
            Baue zuerst ein Forschungszentrum im Stützpunkt-Ausbau!
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {RESEARCH_ORDER.map((id) => {
          const def = RESEARCH[id];
          const level = research[id] || 0;
          const nextLevel = level + 1;
          const cost = getResearchCost(id, nextLevel);
          const duration = getResearchDurationSec(
            id,
            nextLevel,
            activeBase.buildings.research_lab
          );
          const prereq = checkPrerequisites(def.prereq, activeBase.buildings, research);
          const isResearchingThis = researchQueue?.researchId === id;
          const queueBusy = Boolean(researchQueue);

          const canAfford =
            liveResources.steel >= cost.steel &&
            liveResources.munition >= cost.munition &&
            liveResources.fuel >= cost.fuel;

          const remSec = isResearchingThis
            ? Math.max(0, Math.ceil((researchQueue!.endsAt - nowMs) / 1000))
            : 0;

          return (
            <div key={id} className="ops-card rounded-xl overflow-hidden flex flex-col">
              <div className="relative h-36 bg-black/50">
                <img
                  src={def.image}
                  alt={def.name}
                  className="w-full h-full object-cover opacity-80"
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
                  <div className="text-[11px] font-semibold text-amber-300/90 bg-amber-950/35 border border-amber-600/30 rounded px-2 py-1">
                    {def.effectText}
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed">{def.description}</p>

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

                <div>
                  {isResearchingThis ? (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/50 text-xs font-mono-num text-amber-300 font-bold flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Forschung läuft: {fmtDuration(remSec)}
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
                      onClick={() => handleResearch(id)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-between transition cursor-pointer ${
                        canAfford && !queueBusy
                          ? 'bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200'
                          : 'bg-stone-900/80 border border-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Erforschen St. {nextLevel}</span>
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
    </div>
  );
}
