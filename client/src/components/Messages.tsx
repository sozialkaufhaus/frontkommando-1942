import { useEffect, useState } from 'react';
import { CheckCheck, Crosshair, Eye, Mail, Shield, Truck } from 'lucide-react';
import { BUILDINGS, RESEARCH, getCombatEntityStats } from '@shared/gameData';
import type {
  BuildingId,
  CombatEntityId,
  CombatReportData,
  GameMessage,
  MissionType,
  ResearchId,
  SpyReportData,
} from '@shared/types';
import { api, fmtNum, fmtTime } from '../api';

interface MessagesProps {
  onRefreshState: () => void;
  onPlanMission: (sector: number, position: number, missionType: MissionType) => void;
}

export function Messages({ onRefreshState, onPlanMission }: MessagesProps) {
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [filter, setFilter] = useState<'all' | 'combat' | 'spy' | 'transport' | 'diplomacy' | 'system'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .getMessages()
      .then((res) => {
        setMessages(res.messages);
        if (res.messages.length > 0 && expandedId === null) {
          setExpandedId(res.messages[0].id);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpen = async (msg: GameMessage) => {
    setExpandedId((prev) => (prev === msg.id ? null : msg.id));
    if (!msg.isRead) {
      await api.markMessageRead(msg.id);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      onRefreshState();
    }
  };

  const handleReadAll = async () => {
    await api.markAllMessagesRead();
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    onRefreshState();
  };

  const filtered = filter === 'all' ? messages : messages.filter((m) => m.type === filter);

  return (
    <div className="space-y-4">
      <div className="ops-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-400" />
          <h2 className="font-display text-lg font-bold text-[#f3ebd8]">
            Nachrichten- &amp; Berichtszentrale
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'combat', 'spy', 'transport', 'diplomacy', 'system'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                filter === f
                  ? 'bg-amber-600/25 border-amber-500 text-amber-200'
                  : 'bg-black/40 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {f === 'all'
                ? 'Alle'
                : f === 'combat'
                  ? 'Kampfberichte'
                  : f === 'spy'
                    ? 'Aufklärung'
                    : f === 'transport'
                      ? 'Nachschub'
                      : f === 'diplomacy'
                        ? 'Diplomatie'
                        : 'System'}
            </button>
          ))}
          <button
            type="button"
            onClick={handleReadAll}
            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-xs text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Alle gelesen
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ops-panel rounded-xl p-8 text-center text-xs text-stone-400">
          Lade Funksprüche...
        </div>
      ) : filtered.length === 0 ? (
        <div className="ops-panel rounded-xl p-8 text-center text-xs text-stone-500">
          Keine Nachrichten in dieser Kategorie vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => {
            const expanded = expandedId === msg.id;
            return (
              <div
                key={msg.id}
                className={`ops-panel rounded-xl overflow-hidden border transition ${
                  msg.isRead ? 'border-stone-800/80' : 'border-amber-500/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(msg)}
                  className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-white/[0.02] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {msg.type === 'combat' ? (
                      <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
                    ) : msg.type === 'spy' ? (
                      <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : msg.type === 'transport' ? (
                      <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className={`text-sm ${msg.isRead ? 'text-[#e3dccb]' : 'font-bold text-amber-200'}`}>
                      {msg.title}
                    </span>
                    {!msg.isRead && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500 text-black">
                        Neu
                      </span>
                    )}
                  </div>
                  <span className="font-mono-num text-[11px] text-stone-500">
                    {fmtTime(msg.createdAt)}
                  </span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-stone-800/80 space-y-3 text-xs">
                    <p className="text-stone-300 leading-relaxed">{msg.body}</p>

                    {msg.type === 'combat' && msg.data && (
                      <CombatReportView report={msg.data as CombatReportData} />
                    )}

                    {msg.type === 'spy' && msg.data && (
                      <SpyReportView
                        report={msg.data as SpyReportData}
                        onAttack={(s, p) => onPlanMission(s, p, 'attack')}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CombatReportView({ report }: { report: CombatReportData }) {
  const renderCounts = (counts: Partial<Record<CombatEntityId, number>>) => {
    const entries = (Object.entries(counts) as [CombatEntityId, number][]).filter(([, c]) => c > 0);
    if (entries.length === 0) return <span className="text-stone-500">Vernichtet / Keine</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([id, c]) => (
          <span
            key={id}
            className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono-num text-[11px] text-stone-200"
          >
            {c}× {getCombatEntityStats(id).name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 bg-black/45 border border-stone-800 rounded-lg p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800">
        <div>
          <span className="text-amber-300 font-bold">{report.attackerName}</span>
          <span className="text-stone-500 mx-2">vs.</span>
          <span className="text-red-300 font-bold">{report.defenderName}</span>
          <span className="font-mono-num text-stone-400 ml-2">{report.targetCoords}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
            report.outcome === 'attacker_win'
              ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
              : report.outcome === 'defender_win'
                ? 'bg-red-900/60 text-red-200 border border-red-500/40'
                : 'bg-amber-900/60 text-amber-200 border border-amber-500/40'
          }`}
        >
          {report.outcome === 'attacker_win'
            ? 'Angreifer siegreich'
            : report.outcome === 'defender_win'
              ? 'Verteidiger siegreich'
              : 'Unentschieden'}
        </span>
      </div>

      {/* Initial Forces */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-2.5 rounded bg-black/40 border border-stone-800 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-amber-400">
            Angreifer (Waffen +{report.attackerTech.weapons * 10}% / Panz. +{report.attackerTech.armor * 10}%)
          </div>
          {renderCounts(report.attackerInitial)}
        </div>
        <div className="p-2.5 rounded bg-black/40 border border-stone-800 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-red-400">
            Verteidiger (Waffen +{report.defenderTech.weapons * 10}% / Panz. +{report.defenderTech.armor * 10}%)
          </div>
          {renderCounts(report.defenderInitial)}
        </div>
      </div>

      {/* Rounds */}
      <div className="space-y-1.5">
        {report.rounds.map((r) => (
          <div
            key={r.round}
            className="p-2.5 rounded bg-[#101412] border border-stone-800/80 text-[11px] space-y-1"
          >
            <div className="font-bold text-amber-300">Gefechtsrunde {r.round}</div>
            <div className="text-stone-300">
              Angreifer feuert <span className="font-mono-num text-white">{r.attackerShots}×</span> (
              <span className="font-mono-num text-amber-200">{fmtNum(r.attackerDamage)}</span> Schaden,{' '}
              <span className="font-mono-num text-sky-300">{fmtNum(r.defenderAbsorbed)}</span> absorbiert).
            </div>
            <div className="text-stone-300">
              Verteidiger feuert <span className="font-mono-num text-white">{r.defenderShots}×</span> (
              <span className="font-mono-num text-red-300">{fmtNum(r.defenderDamage)}</span> Schaden,{' '}
              <span className="font-mono-num text-sky-300">{fmtNum(r.attackerAbsorbed)}</span> absorbiert).
            </div>
          </div>
        ))}
      </div>

      {/* Loot & Losses */}
      <div className="grid sm:grid-cols-3 gap-2 pt-2 border-t border-stone-800 font-mono-num text-[11px]">
        <div className="p-2 rounded bg-emerald-950/35 border border-emerald-700/40">
          <div className="text-[10px] text-emerald-400 uppercase font-sans">Beute</div>
          <div>
            {fmtNum(report.loot.steel)} St / {fmtNum(report.loot.munition)} Mu /{' '}
            {fmtNum(report.loot.fuel)} Tr
          </div>
        </div>
        <div className="p-2 rounded bg-black/40 border border-stone-800">
          <div className="text-[10px] text-amber-400 uppercase font-sans">Verluste Angreifer</div>
          <div>
            {fmtNum(
              report.attackerLosses.steel +
                report.attackerLosses.munition +
                report.attackerLosses.fuel
            )}{' '}
            Rohst.
          </div>
        </div>
        <div className="p-2 rounded bg-black/40 border border-stone-800">
          <div className="text-[10px] text-red-400 uppercase font-sans">Verluste Verteidiger</div>
          <div>
            {fmtNum(
              report.defenderLosses.steel +
                report.defenderLosses.munition +
                report.defenderLosses.fuel
            )}{' '}
            Rohst.
          </div>
        </div>
      </div>
    </div>
  );
}

function SpyReportView({
  report,
  onAttack,
}: {
  report: SpyReportData;
  onAttack: (sector: number, position: number) => void;
}) {
  const match = report.coords.match(/\[(\d+):(\d+)\]/);
  const sector = match ? Number(match[1]) : 1;
  const position = match ? Number(match[2]) : 1;

  return (
    <div className="space-y-3 bg-sky-950/20 border border-sky-700/40 rounded-lg p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-sky-200">
          Ziel: {report.targetName} ({report.ownerName}) {report.coords}
        </div>
        <button
          type="button"
          onClick={() => onAttack(sector, position)}
          className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800/70 border border-red-500/50 text-red-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
        >
          <Crosshair className="w-3 h-3" /> Angriff planen
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono-num text-[11px]">
        <div className="p-2 rounded bg-black/45 border border-stone-800">
          <div className="text-[9px] text-stone-400 uppercase font-sans">Stahl</div>
          {fmtNum(report.resources.steel)}
        </div>
        <div className="p-2 rounded bg-black/45 border border-stone-800">
          <div className="text-[9px] text-stone-400 uppercase font-sans">Munition</div>
          {fmtNum(report.resources.munition)}
        </div>
        <div className="p-2 rounded bg-black/45 border border-stone-800">
          <div className="text-[9px] text-stone-400 uppercase font-sans">Treibstoff</div>
          {fmtNum(report.resources.fuel)}
        </div>
      </div>

      {report.units && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
            Stationierte Einheiten
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(report.units).filter(([, c]) => (c || 0) > 0).length === 0 ? (
              <span className="text-stone-400">Keine Einheiten gesichtet</span>
            ) : (
              Object.entries(report.units)
                .filter(([, c]) => (c || 0) > 0)
                .map(([id, c]) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono-num text-[11px]"
                  >
                    {c}× {getCombatEntityStats(id as CombatEntityId).name}
                  </span>
                ))
            )}
          </div>
        </div>
      )}

      {report.defenses && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">
            Verteidigungsanlagen
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(report.defenses).filter(([, c]) => (c || 0) > 0).length === 0 ? (
              <span className="text-stone-400">Keine Verteidigung gesichtet</span>
            ) : (
              Object.entries(report.defenses)
                .filter(([, c]) => (c || 0) > 0)
                .map(([id, c]) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono-num text-[11px]"
                  >
                    {c}× {getCombatEntityStats(id as CombatEntityId).name}
                  </span>
                ))
            )}
          </div>
        </div>
      )}

      {report.buildings && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Gebäude</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(report.buildings) as [BuildingId, number][])
              .filter(([, lvl]) => lvl > 0)
              .map(([id, lvl]) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-black/40 border border-stone-800 text-[11px]"
                >
                  {BUILDINGS[id].name} St. {lvl}
                </span>
              ))}
          </div>
        </div>
      )}

      {report.research && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Forschung</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(report.research) as [ResearchId, number][])
              .filter(([, lvl]) => lvl > 0)
              .map(([id, lvl]) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-black/40 border border-stone-800 text-[11px]"
                >
                  {RESEARCH[id].name} St. {lvl}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
