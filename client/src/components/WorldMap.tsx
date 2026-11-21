import { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  Crown,
  Eye,
  Flag,
  Globe2,
  Shield,
  Swords,
  Truck,
} from 'lucide-react';
import {
  FACTIONS,
  FACTION_ORDER,
  PROVINCES,
  PROVINCE_BY_COORDS,
  PROVINCE_BY_ID,
  type FactionId,
} from '@shared/worldMap';
import type { GameStateResponse, MissionType, WorldProvinceState } from '@shared/types';
import { api, fmtNum } from '../api';

interface WorldMapProps {
  state: GameStateResponse;
  onRefresh: () => void;
  onSelectBase: (baseId: number) => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onPlanMission: (sector: number, position: number, missionType: MissionType) => void;
}

export function WorldMap({
  state,
  onRefresh,
  onSelectBase,
  onNotify,
  onPlanMission,
}: WorldMapProps) {
  const [provinces, setProvinces] = useState<WorldProvinceState[]>([]);
  const [factionCounts, setFactionCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string>(() => {
    const ownProv = PROVINCE_BY_COORDS.get(
      `${state.activeBase.sector}:${state.activeBase.position}`
    );
    return ownProv?.id || 'rheinland';
  });
  const [spying, setSpying] = useState(false);
  const [showFactionPicker, setShowFactionPicker] = useState(false);

  const loadWorld = () => {
    api
      .getWorld()
      .then((res) => {
        setProvinces(res.provinces);
        setFactionCounts(res.factionCounts);
      })
      .catch((err) => onNotify(err.message, true));
  };

  useEffect(() => {
    loadWorld();
  }, [state.bases.length, state.activeMissions.length, state.user.faction]);

  const stateById = useMemo(
    () => new Map(provinces.map((p) => [p.provinceId, p])),
    [provinces]
  );

  const selectedDef = PROVINCE_BY_ID.get(selectedId) || PROVINCES[0];
  const selectedState = stateById.get(selectedDef.id);
  const myFaction = FACTIONS[state.user.faction] || FACTIONS.mitteleuropa;
  const maxBases = 1 + state.research.colonization;

  const handleQuickSpy = async (sector: number, position: number) => {
    if ((state.activeBase.units.scout_car || 0) < 1) {
      onNotify('Kein Spähwagen im aktiven Stützpunkt verfügbar.', true);
      return;
    }
    setSpying(true);
    try {
      await api.launchMission({
        originBaseId: state.activeBase.id,
        targetSector: sector,
        targetPosition: position,
        missionType: 'spy',
        units: { scout_car: 1 },
        cargo: { steel: 0, munition: 0, fuel: 0 },
      });
      onNotify(`Spähwagen zur Aufklärung nach ${selectedDef.name} entsandt!`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Aufklärung fehlgeschlagen.', true);
    } finally {
      setSpying(false);
    }
  };

  const handleSwitchFaction = async (fId: FactionId) => {
    try {
      await api.setFaction(fId);
      onNotify(`Fraktion gewechselt zu ${FACTIONS[fId].name}!`);
      setShowFactionPicker(false);
      onRefresh();
      loadWorld();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Wechsel fehlgeschlagen.', true);
    }
  };

  // Active march arrows between provinces on the map
  const marchLines = useMemo(() => {
    return state.activeMissions
      .map((m) => {
        const from = PROVINCE_BY_COORDS.get(`${m.originSector}:${m.originPosition}`);
        const to = PROVINCE_BY_COORDS.get(`${m.targetSector}:${m.targetPosition}`);
        if (!from || !to) return null;
        return {
          id: m.id,
          x1: m.status === 'outbound' ? from.cx : to.cx,
          y1: m.status === 'outbound' ? from.cy : to.cy,
          x2: m.status === 'outbound' ? to.cx : from.cx,
          y2: m.status === 'outbound' ? to.cy : from.cy,
          type: m.missionType,
          returning: m.status === 'returning',
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [state.activeMissions]);

  const totalProvinces = PROVINCES.length;

  return (
    <div className="space-y-4">
      {/* Top Strategic Bar: Faction Control + Expansion Status */}
      <div className="ops-panel rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-amber-400" />
              Europa-Frontkarte 1942 — Länder, Fraktionen &amp; Eroberung
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Deine Fraktion:{' '}
              <span className={`font-semibold ${myFaction.textClass}`}>{myFaction.name}</span> •
              Kontrollierte Provinzen:{' '}
              <span className="font-mono-num text-amber-300 font-bold">
                {state.bases.length} / {maxBases}
              </span>{' '}
              (erhöhe Limit über <em>Logistik-Kolonisierung</em>)
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFactionPicker((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${myFaction.bgClass} ${myFaction.textClass}`}
          >
            <Crown className="w-3.5 h-3.5" />
            Fraktion &amp; Doktrin ({myFaction.shortName})
          </button>
        </div>

        {/* Faction Territory Control Bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full overflow-hidden bg-stone-900 border border-stone-700/70 flex">
            {FACTION_ORDER.map((fId) => {
              const cnt = factionCounts[fId] || 0;
              if (cnt <= 0) return null;
              return (
                <div
                  key={fId}
                  style={{
                    width: `${(cnt / totalProvinces) * 100}%`,
                    backgroundColor: FACTIONS[fId].color,
                  }}
                  title={`${FACTIONS[fId].shortName}: ${cnt} Provinzen`}
                  className="h-full transition-all duration-500"
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-300">
            {FACTION_ORDER.map((fId) => (
              <span key={fId} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: FACTIONS[fId].color }}
                />
                <span>{FACTIONS[fId].shortName}:</span>
                <span className="font-mono-num font-bold">{factionCounts[fId] || 0}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-stone-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-stone-600" />
              Frei: <span className="font-mono-num font-bold">{factionCounts.neutral || 0}</span>
            </span>
          </div>
        </div>

        {/* Optional Faction Switcher Drawer */}
        {showFactionPicker && (
          <div className="pt-3 border-t border-stone-800 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FACTION_ORDER.map((fId) => {
              const f = FACTIONS[fId];
              const active = state.user.faction === fId;
              return (
                <button
                  key={fId}
                  type="button"
                  onClick={() => handleSwitchFaction(fId)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    active
                      ? `${f.bgClass} ring-1 ring-amber-400/70`
                      : 'bg-black/45 border-stone-800 hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-display text-xs font-bold ${f.textClass}`}>
                      {f.shortName}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{f.doctrine}</div>
                  <ul className="mt-2 space-y-0.5 text-[10px] text-stone-200">
                    {f.bonusSummary.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Split: Interactive Europe Map + Province Command Panel */}
      <div className="grid xl:grid-cols-4 gap-4">
        {/* Interactive SVG Europe Map */}
        <div className="xl:col-span-3 ops-panel rounded-xl p-3 relative overflow-hidden">
          <div className="relative rounded-lg overflow-hidden border border-stone-700/70 bg-[#0d151b]">
            <svg
              viewBox="0 0 1000 620"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Interaktive Europa-Strategiekarte 1942"
            >
              <defs>
                <radialGradient id="seaGrad" cx="48%" cy="45%" r="65%">
                  <stop offset="0%" stopColor="#16242d" />
                  <stop offset="100%" stopColor="#091015" />
                </radialGradient>
                <pattern id="seaGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#6da5c0"
                    strokeOpacity="0.07"
                    strokeWidth="1"
                  />
                </pattern>
                <marker
                  id="arrowAmber"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#fbbf24" />
                </marker>
                <marker
                  id="arrowRed"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#f87171" />
                </marker>
              </defs>

              {/* Ocean & tactical coordinates grid */}
              <rect width="1000" height="620" fill="url(#seaGrad)" />
              <rect width="1000" height="620" fill="url(#seaGrid)" />

              {/* Sea labels */}
              <text x="65" y="120" fill="#6d92a6" fillOpacity="0.28" fontSize="13" letterSpacing="4">
                ATLANTIK
              </text>
              <text x="310" y="165" fill="#6d92a6" fillOpacity="0.28" fontSize="11" letterSpacing="3">
                NORDSEE
              </text>
              <text x="275" y="518" fill="#6d92a6" fillOpacity="0.28" fontSize="12" letterSpacing="4">
                MITTELMEER
              </text>

              {/* Neighbor supply lines (subtle) */}
              {PROVINCES.map((prov) =>
                prov.neighbors.map((nId) => {
                  if (prov.id > nId) return null;
                  const nb = PROVINCE_BY_ID.get(nId);
                  if (!nb) return null;
                  return (
                    <line
                      key={`${prov.id}-${nId}`}
                      x1={prov.cx}
                      y1={prov.cy}
                      x2={nb.cx}
                      y2={nb.cy}
                      stroke="#cbd5c0"
                      strokeOpacity="0.14"
                      strokeWidth="1"
                      strokeDasharray="3 4"
                    />
                  );
                })
              )}

              {/* Province Polygons */}
              {PROVINCES.map((prov) => {
                const st = stateById.get(prov.id);
                const isSelected = prov.id === selectedDef.id;
                const isOwn = Boolean(st?.isOwn);
                const isActiveBase =
                  prov.sector === state.activeBase.sector &&
                  prov.position === state.activeBase.position;

                const factionColor = st?.ownerFaction
                  ? FACTIONS[st.ownerFaction]?.color || '#64748b'
                  : '#374151';

                return (
                  <g
                    key={prov.id}
                    onClick={() => setSelectedId(prov.id)}
                    className="cursor-pointer group"
                  >
                    <path
                      d={prov.path}
                      fill={factionColor}
                      fillOpacity={isSelected ? 0.52 : st?.baseId ? 0.34 : 0.14}
                      stroke={
                        isSelected
                          ? '#fcd34d'
                          : isOwn
                            ? '#fbbf24'
                            : st?.baseId
                              ? factionColor
                              : '#6b7280'
                      }
                      strokeWidth={isSelected ? 3 : isOwn ? 2.2 : 1.3}
                      className="transition-all duration-200 hover:fill-opacity-50"
                    />

                    {/* Base / Capital marker */}
                    {st?.baseId ? (
                      <g>
                        <circle
                          cx={prov.cx}
                          cy={prov.cy - 8}
                          r={isActiveBase ? 7 : 5}
                          fill={isOwn ? '#fbbf24' : factionColor}
                          stroke="#0b0e0c"
                          strokeWidth="2"
                        />
                        {isOwn && (
                          <circle
                            cx={prov.cx}
                            cy={prov.cy - 8}
                            r="11"
                            fill="none"
                            stroke="#fbbf24"
                            strokeOpacity="0.55"
                            strokeWidth="1.2"
                          />
                        )}
                      </g>
                    ) : (
                      <circle
                        cx={prov.cx}
                        cy={prov.cy - 8}
                        r="3"
                        fill="#9ca3af"
                        fillOpacity="0.55"
                      />
                    )}

                    {/* Province Name */}
                    <text
                      x={prov.cx}
                      y={prov.cy + 10}
                      textAnchor="middle"
                      fill={isSelected ? '#fef3c7' : '#e5e2d9'}
                      fontSize="11"
                      fontWeight={isSelected || isOwn ? '700' : '600'}
                      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
                    >
                      {prov.name}
                    </text>

                    {/* Regional Bonus Micro-Tag */}
                    <text
                      x={prov.cx}
                      y={prov.cy + 23}
                      textAnchor="middle"
                      fill="#d6d3c8"
                      fillOpacity="0.78"
                      fontSize="9"
                      fontFamily="monospace"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
                    >
                      {prov.bonus.label}
                    </text>
                  </g>
                );
              })}

              {/* Animated Live March Arrows */}
              {marchLines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={
                    line.type === 'attack' || line.type === 'conquer' ? '#f87171' : '#fbbf24'
                  }
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  markerEnd={
                    line.type === 'attack' || line.type === 'conquer'
                      ? 'url(#arrowRed)'
                      : 'url(#arrowAmber)'
                  }
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Right Tactical Province Command Inspector */}
        <div className="ops-panel rounded-xl p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="border-b border-stone-800 pb-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold">
                {selectedDef.theater} • [{selectedDef.sector}:{selectedDef.position}]
              </div>
              <h3 className="font-display text-xl font-bold text-[#f4ede0] mt-0.5">
                {selectedDef.name}
              </h3>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-950/50 border border-amber-500/40 text-[11px] font-mono-num text-amber-200">
                Provinz-Bonus: {selectedDef.bonus.label}
              </div>
            </div>

            {/* Owner & Faction Info */}
            {selectedState?.baseId ? (
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-black/45 border border-stone-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Stützpunkt</span>
                    <span className="font-semibold text-[#f0e9d8]">{selectedState.baseName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Kommandant</span>
                    <span className="font-semibold text-stone-200">
                      {selectedState.allianceTag && (
                        <span className="text-emerald-400 mr-1">
                          [{selectedState.allianceTag}]
                        </span>
                      )}
                      {selectedState.ownerName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Fraktion</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: selectedState.ownerFaction
                          ? FACTIONS[selectedState.ownerFaction].color
                          : '#ccc',
                      }}
                    >
                      {selectedState.ownerFaction
                        ? FACTIONS[selectedState.ownerFaction].shortName
                        : 'Neutral'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Status</span>
                    <span className="font-mono-num text-amber-300">
                      {selectedState.isOwn
                        ? 'Dein Gebiet'
                        : selectedState.isAi
                          ? `KI • ${selectedState.aiDifficulty}`
                          : selectedState.isOnline
                            ? 'Spieler (Online)'
                            : 'Spieler (Offline)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Gesamtpunkte</span>
                    <span className="font-mono-num text-stone-200">
                      {fmtNum(selectedState.points)} Pkt
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-700/40 text-xs text-emerald-200 leading-relaxed">
                Unbesetzte strategische Provinz! Entsende einen Verband mit dem Auftrag{' '}
                <strong>Provinz einnehmen</strong>, um dein Staatsgebiet zu erweitern und den
                regionalen Bonus ({selectedDef.bonus.label}) zu sichern.
              </div>
            )}

            {/* Neighboring provinces */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">
                Angrenzende Provinzen
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedDef.neighbors.map((nId) => {
                  const nb = PROVINCE_BY_ID.get(nId);
                  if (!nb) return null;
                  return (
                    <button
                      key={nId}
                      type="button"
                      onClick={() => setSelectedId(nId)}
                      className="px-2 py-1 rounded bg-black/45 hover:bg-stone-800 border border-stone-700 text-[11px] text-stone-300 cursor-pointer"
                    >
                      {nb.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tactical Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-stone-800">
            {selectedState?.isOwn && selectedState.baseId && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectBase(selectedState.baseId!)}
                  className="w-full py-2.5 px-3 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-4 h-4" /> Stützpunkt verwalten
                </button>
                {selectedState.baseId !== state.activeBase.id && (
                  <button
                    type="button"
                    onClick={() =>
                      onPlanMission(selectedDef.sector, selectedDef.position, 'deploy')
                    }
                    className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" /> Truppen verlegen / Nachschub
                  </button>
                )}
              </>
            )}

            {selectedState?.baseId && !selectedState.isOwn && (
              <>
                <button
                  type="button"
                  disabled={spying}
                  onClick={() => handleQuickSpy(selectedDef.sector, selectedDef.position)}
                  className="w-full py-2 px-3 rounded-lg bg-sky-950/60 hover:bg-sky-900/70 border border-sky-600/50 text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" /> Sofort aufklären (1 Spähwagen)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPlanMission(selectedDef.sector, selectedDef.position, 'attack')
                  }
                  className="w-full py-2 px-3 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-600/50 text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" /> Angreifen (Plündern)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPlanMission(selectedDef.sector, selectedDef.position, 'conquer')
                  }
                  className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-[#12100b] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Swords className="w-4 h-4" /> Provinz erobern &amp; annektieren
                </button>
              </>
            )}

            {!selectedState?.baseId && (
              <button
                type="button"
                onClick={() =>
                  onPlanMission(selectedDef.sector, selectedDef.position, 'colonize')
                }
                className="w-full py-2.5 px-3 rounded-lg bg-emerald-700/35 hover:bg-emerald-700/55 border border-emerald-500/60 text-emerald-100 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Flag className="w-4 h-4" /> Provinz einnehmen (Land erweitern)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
