import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  Crosshair,
  Edit3,
  FlaskConical,
  RotateCcw,
  Shield,
} from 'lucide-react';
import { BUILDINGS, DEFENSES, RESEARCH, UNITS, UNIT_ORDER, DEFENSE_ORDER } from '@shared/gameData';
import type { GameStateResponse } from '@shared/types';
import { MISSION_LABELS, api, fmtDuration, fmtNum } from '../api';
import type { NavTab } from './Layout';

interface OverviewProps {
  state: GameStateResponse;
  nowMs: number;
  onRefresh: () => void;
  onNavigate: (tab: NavTab) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function Overview({ state, nowMs, onRefresh, onNavigate, onNotify }: OverviewProps) {
  const { activeBase, researchQueue, activeMissions, incomingMissions } = state;
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(activeBase.name);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.renameBase(activeBase.id, nameInput);
      setEditingName(false);
      onNotify('Stützpunkt umbenannt.');
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Fehler beim Umbenennen.', true);
    }
  };

  const handleRecall = async (missionId: number) => {
    try {
      await api.recallMission(missionId);
      onNotify('Marschverband zurückbeordert.');
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Rückruf fehlgeschlagen.', true);
    }
  };

  const stationedUnits = UNIT_ORDER.filter((id) => (activeBase.units[id] || 0) > 0);
  const stationedDefenses = DEFENSE_ORDER.filter((id) => (activeBase.defenses[id] || 0) > 0);

  return (
    <div className="space-y-5">
      {/* Incoming attack alert banner */}
      {incomingMissions.length > 0 && (
        <div className="p-4 rounded-xl bg-red-950/70 border border-red-500/70 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <div className="text-sm text-red-100">
            <span className="font-bold uppercase tracking-wider">Feindbewegung erkannt!</span>{' '}
            {incomingMissions.length} anrückende(r) Verband/Verbände auf deine Stützpunkte!
          </div>
        </div>
      )}

      {/* Hero Base Banner */}
      <div className="ops-panel rounded-xl overflow-hidden relative">
        <div className="relative h-44 sm:h-52">
          <img
            src="/assets/bld-hq.jpg"
            alt={activeBase.name}
            className="w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d110e] via-[#0d110e]/50 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-amber-400 font-semibold">
                Front-Stützpunkt • Sektor {activeBase.sector}, Position {activeBase.position}
              </div>
              {editingName ? (
                <form onSubmit={handleRename} className="flex items-center gap-2 mt-1">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={28}
                    className="px-2.5 py-1 rounded bg-black/70 border border-amber-500/60 text-sm text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-amber-600 text-black text-xs font-bold cursor-pointer"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    className="px-2 py-1 rounded bg-stone-800 text-stone-300 text-xs cursor-pointer"
                  >
                    Abbrechen
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#f4ede0]">
                    {activeBase.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(activeBase.name);
                      setEditingName(true);
                    }}
                    title="Stützpunkt umbenennen"
                    className="p-1.5 rounded bg-black/40 hover:bg-black/70 text-stone-400 hover:text-amber-300 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate('world')}
                className="px-3.5 py-2 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
              >
                Europa-Karte öffnen
              </button>
              <button
                type="button"
                onClick={() => onNavigate('fleet')}
                className="px-3.5 py-2 rounded-lg bg-[#232b24] hover:bg-[#2d382e] border border-stone-600 text-[#ede6d6] text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
              >
                Verband entsenden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Operations Grid: Build, Research, Production */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Active Build */}
        <div className="ops-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-stone-400 mb-3">
              <span className="flex items-center gap-1.5 font-semibold text-amber-300/90">
                <Building2 className="w-4 h-4" /> Bauauftrag
              </span>
              <button
                type="button"
                onClick={() => onNavigate('buildings')}
                className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
              >
                Ausbauen →
              </button>
            </div>
            {activeBase.buildQueue ? (
              <QueueProgress
                title={BUILDINGS[activeBase.buildQueue.buildingId].name}
                subtitle={`Ausbau auf Stufe ${activeBase.buildQueue.targetLevel}`}
                startedAt={activeBase.buildQueue.startedAt}
                endsAt={activeBase.buildQueue.endsAt}
                nowMs={nowMs}
              />
            ) : (
              <p className="text-xs text-stone-500 py-3">Kein aktiver Bauauftrag.</p>
            )}
          </div>
        </div>

        {/* Active Research */}
        <div className="ops-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-stone-400 mb-3">
              <span className="flex items-center gap-1.5 font-semibold text-amber-300/90">
                <FlaskConical className="w-4 h-4" /> Forschung
              </span>
              <button
                type="button"
                onClick={() => onNavigate('research')}
                className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
              >
                Forschen →
              </button>
            </div>
            {researchQueue ? (
              <QueueProgress
                title={RESEARCH[researchQueue.researchId].name}
                subtitle={`Forschung auf Stufe ${researchQueue.targetLevel}`}
                startedAt={researchQueue.startedAt}
                endsAt={researchQueue.endsAt}
                nowMs={nowMs}
              />
            ) : (
              <p className="text-xs text-stone-500 py-3">Keine aktive Forschung.</p>
            )}
          </div>
        </div>

        {/* Active Unit/Defense Production */}
        <div className="ops-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-stone-400 mb-3">
              <span className="flex items-center gap-1.5 font-semibold text-amber-300/90">
                <Crosshair className="w-4 h-4" /> Rüstungs-Warteschlange
              </span>
              <button
                type="button"
                onClick={() => onNavigate('units')}
                className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
              >
                Produzieren →
              </button>
            </div>
            {activeBase.unitQueue.length > 0 ? (
              <div className="space-y-2">
                {activeBase.unitQueue.slice(0, 2).map((item, idx) => {
                  const name =
                    item.entityType === 'unit'
                      ? UNITS[item.entityId as keyof typeof UNITS].name
                      : DEFENSES[item.entityId as keyof typeof DEFENSES].name;
                  const remSec = Math.max(0, Math.ceil((item.nextEndsAt - nowMs) / 1000));
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-black/40 border border-stone-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#ede6d6]">
                          {item.count}× {name}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {idx === 0 ? 'In Fertigung' : 'In Warteschlange'}
                        </div>
                      </div>
                      <span className="font-mono-num text-amber-300 font-semibold">
                        {idx === 0 ? fmtDuration(remSec) : `${item.unitDurationSec}s/Stk`}
                      </span>
                    </div>
                  );
                })}
                {activeBase.unitQueue.length > 2 && (
                  <div className="text-[11px] text-stone-400">
                    +{activeBase.unitQueue.length - 2} weitere Aufträge...
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500 py-3">Keine laufende Einheitenproduktion.</p>
            )}
          </div>
        </div>
      </div>

      {/* Active Troop Movements */}
      <div className="ops-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" /> Aktive Truppenbewegungen ({activeMissions.length})
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('fleet')}
            className="text-xs text-amber-300 hover:underline cursor-pointer"
          >
            Neuer Marschbefehl →
          </button>
        </div>

        {activeMissions.length === 0 ? (
          <p className="text-xs text-stone-500 py-2">
            Derzeit sind keine Verbände unterwegs. Nutze die Sektorenkarte, um Ziele aufzuklären oder anzugreifen.
          </p>
        ) : (
          <div className="space-y-2.5">
            {activeMissions.map((m) => {
              const targetTs = m.status === 'outbound' ? m.arrivesAt : m.returnsAt || m.arrivesAt;
              const remSec = Math.max(0, Math.ceil((targetTs - nowMs) / 1000));
              const totalUnits = Object.values(m.units).reduce((a, b) => a + (b || 0), 0);
              return (
                <div
                  key={m.id}
                  className="p-3 rounded-lg bg-black/45 border border-stone-700/70 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        m.missionType === 'attack'
                          ? 'bg-red-900/60 text-red-200 border border-red-600/50'
                          : m.missionType === 'spy'
                            ? 'bg-sky-900/60 text-sky-200 border border-sky-600/50'
                            : 'bg-emerald-900/60 text-emerald-200 border border-emerald-600/50'
                      }`}
                    >
                      {MISSION_LABELS[m.missionType]}
                    </span>
                    <div>
                      <div className="font-semibold text-[#f0e9d8] flex items-center gap-1.5">
                        {m.status === 'outbound' ? (
                          <>
                            <span>
                              {m.originName} [{m.originSector}:{m.originPosition}]
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {m.targetBaseName} [{m.targetSector}:{m.targetPosition}]
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              Rückmarsch von [{m.targetSector}:{m.targetPosition}]
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{m.originName}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {totalUnits} Einheiten
                        {m.cargo.steel + m.cargo.munition + m.cargo.fuel > 0 && (
                          <span className="ml-2 text-amber-300/90">
                            • Fracht: {fmtNum(m.cargo.steel)} St / {fmtNum(m.cargo.munition)} Mu / {fmtNum(m.cargo.fuel)} Tr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono-num text-sm font-bold text-amber-300">
                        {fmtDuration(remSec)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {m.status === 'outbound' ? 'Ankunft' : 'Rückkehr'}
                      </div>
                    </div>
                    {m.status === 'outbound' && (
                      <button
                        type="button"
                        onClick={() => handleRecall(m.id)}
                        title="Verband zurückrufen"
                        className="p-1.5 rounded bg-stone-800 hover:bg-red-900/60 border border-stone-600 text-stone-300 hover:text-red-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stationed Garrison Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="ops-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5" /> Stationierte Truppen
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('units')}
              className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
            >
              Rekrutieren →
            </button>
          </div>
          {stationedUnits.length === 0 ? (
            <p className="text-xs text-stone-500">Keine Truppen im Stützpunkt stationiert.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stationedUnits.map((uId) => (
                <div
                  key={uId}
                  className="px-3 py-2 rounded-lg bg-black/40 border border-stone-800 flex items-center justify-between text-xs"
                >
                  <span className="text-stone-300">{UNITS[uId].name}</span>
                  <span className="font-mono-num font-bold text-amber-300">
                    {fmtNum(activeBase.units[uId])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ops-panel rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Verteidigungsanlagen
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('defense')}
              className="text-[11px] text-stone-400 hover:text-amber-300 cursor-pointer"
            >
              Befestigen →
            </button>
          </div>
          {stationedDefenses.length === 0 ? (
            <p className="text-xs text-stone-500">Noch keine Verteidigungsstellungen errichtet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stationedDefenses.map((dId) => (
                <div
                  key={dId}
                  className="px-3 py-2 rounded-lg bg-black/40 border border-stone-800 flex items-center justify-between text-xs"
                >
                  <span className="text-stone-300">{DEFENSES[dId].name}</span>
                  <span className="font-mono-num font-bold text-emerald-300">
                    {fmtNum(activeBase.defenses[dId])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueProgress({
  title,
  subtitle,
  startedAt,
  endsAt,
  nowMs,
}: {
  title: string;
  subtitle: string;
  startedAt: number;
  endsAt: number;
  nowMs: number;
}) {
  const total = Math.max(1000, endsAt - startedAt);
  const elapsed = Math.min(total, Math.max(0, nowMs - startedAt));
  const pct = (elapsed / total) * 100;
  const remSec = Math.max(0, Math.ceil((endsAt - nowMs) / 1000));

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm text-[#f3ebd8]">{title}</div>
          <div className="text-[11px] text-stone-400">{subtitle}</div>
        </div>
        <span className="font-mono-num text-sm font-bold text-amber-300">
          {fmtDuration(remSec)}
        </span>
      </div>
      <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden border border-stone-800">
        <div
          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
