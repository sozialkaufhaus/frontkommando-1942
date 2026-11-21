import {
  Activity,
  Award,
  Building2,
  Compass,
  Crosshair,
  FlaskConical,
  Fuel,
  Hammer,
  LogOut,
  Mail,
  Map as MapIcon,
  Radio,
  Shield,
  Zap,
} from 'lucide-react';
import type { GameStateResponse, Resources } from '@shared/types';
import { fmtNum } from '../api';

export type NavTab =
  | 'overview'
  | 'buildings'
  | 'research'
  | 'units'
  | 'defense'
  | 'sectors'
  | 'fleet'
  | 'diplomacy'
  | 'messages'
  | 'highscore';

interface LayoutProps {
  state: GameStateResponse;
  liveResources: Resources;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onSelectBase: (baseId: number) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Lage-Übersicht', icon: Activity },
  { id: 'buildings', label: 'Stützpunkt-Ausbau', icon: Building2 },
  { id: 'research', label: 'Forschung', icon: FlaskConical },
  { id: 'units', label: 'Einheiten', icon: Crosshair },
  { id: 'defense', label: 'Verteidigung', icon: Shield },
  { id: 'sectors', label: 'Sektorenkarte', icon: MapIcon },
  { id: 'fleet', label: 'Marschbefehl', icon: Compass },
  { id: 'diplomacy', label: 'Allianz & Funk', icon: Radio },
  { id: 'messages', label: 'Nachrichten', icon: Mail },
  { id: 'highscore', label: 'Rangliste', icon: Award },
];

export function Layout({
  state,
  liveResources,
  activeTab,
  onSelectTab,
  onSelectBase,
  onLogout,
  children,
}: LayoutProps) {
  const { activeBase, user, bases } = state;
  const energyBalance = activeBase.energyProduced - activeBase.energyConsumed;
  const lowEnergy = energyBalance < 0;

  return (
    <div className="min-h-screen relative bg-[#0a0c0b] text-[#e5e2d9] flex flex-col">
      {/* Subtle tactical map backdrop */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-18 pointer-events-none"
        style={{ backgroundImage: "url('/assets/bg-map.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#0b0e0c]/90 via-[#0c0f0d]/85 to-[#080a09]/95 pointer-events-none" />
      <div className="fixed inset-0 ops-grid-bg pointer-events-none" />

      {/* Top Resource & Command Header */}
      <header className="sticky top-0 z-30 border-b border-stone-700/60 bg-[#0d110e]/95 backdrop-blur-md shadow-xl">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand + Base Selector */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/emblem.jpg"
              alt="Emblem"
              className="w-10 h-10 rounded-md object-cover border border-amber-500/40"
            />
            <div>
              <div className="font-display text-sm sm:text-base font-bold tracking-wider text-[#f3ebd8] leading-tight">
                FRONTKOMMANDO <span className="text-amber-400">1942</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-stone-400">
                <span className="text-amber-300/90 font-medium">
                  {user.allianceTag && (
                    <span className="text-emerald-400 mr-1">[{user.allianceTag}]</span>
                  )}
                  {user.username}
                </span>
                <span>•</span>
                <span className="font-mono-num">{fmtNum(user.points)} Pkt</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-mono-num">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {state.onlineCount} online
                </span>
              </div>
            </div>
          </div>

          {/* Live Resource Tickers */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ResourcePill
              icon={<Hammer className="w-3.5 h-3.5 text-slate-300" />}
              label="Stahl"
              amount={liveResources.steel}
              cap={activeBase.storage.steel}
              ratePerHour={activeBase.productionPerHour.steel}
              barColor="bg-slate-400"
            />
            <ResourcePill
              icon={<Crosshair className="w-3.5 h-3.5 text-amber-300" />}
              label="Munition"
              amount={liveResources.munition}
              cap={activeBase.storage.munition}
              ratePerHour={activeBase.productionPerHour.munition}
              barColor="bg-amber-400"
            />
            <ResourcePill
              icon={<Fuel className="w-3.5 h-3.5 text-emerald-400" />}
              label="Treibstoff"
              amount={liveResources.fuel}
              cap={activeBase.storage.fuel}
              ratePerHour={activeBase.productionPerHour.fuel}
              barColor="bg-emerald-400"
            />
            {/* Energy / Versorgung */}
            <div
              className={`px-3 py-1.5 rounded-lg border min-w-[116px] ${
                lowEnergy
                  ? 'bg-red-950/55 border-red-600/60 text-red-200'
                  : 'bg-[#151a16] border-stone-700/70 text-[#e8e3d5]'
              }`}
              title={`Produziert: ${activeBase.energyProduced} / Verbrauch: ${activeBase.energyConsumed} (Effizienz: ${Math.round(activeBase.energyEfficiency * 100)}%)`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-stone-400">
                <span className="flex items-center gap-1">
                  <Zap className={`w-3.5 h-3.5 ${lowEnergy ? 'text-red-400' : 'text-yellow-400'}`} />
                  Strom
                </span>
                <span className={`font-mono-num font-semibold ${lowEnergy ? 'text-red-300' : 'text-emerald-400'}`}>
                  {Math.round(activeBase.energyEfficiency * 100)}%
                </span>
              </div>
              <div className="font-mono-num text-xs sm:text-sm font-bold leading-tight mt-0.5">
                {energyBalance >= 0 ? `+${energyBalance}` : energyBalance}{' '}
                <span className="text-[10px] font-normal text-stone-400">
                  ({activeBase.energyProduced}/{activeBase.energyConsumed})
                </span>
              </div>
            </div>
          </div>

          {/* Base selector & Logout */}
          <div className="flex items-center gap-2">
            <select
              value={activeBase.id}
              onChange={(e) => onSelectBase(Number(e.target.value))}
              className="bg-[#151a16] border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-[#efe8d8] focus:border-amber-500 focus:outline-none"
            >
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} [{b.sector}:{b.position}]
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onLogout}
              title="Abmelden"
              className="p-2 rounded-lg bg-[#181c19] hover:bg-red-950/60 border border-stone-700 hover:border-red-700/60 text-stone-300 hover:text-red-200 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 py-5 flex flex-col lg:flex-row gap-5">
        {/* Sidebar Navigation */}
        <aside className="lg:w-60 shrink-0">
          <nav className="ops-panel rounded-xl p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const badge =
                item.id === 'messages' && user.unreadMessages > 0
                  ? user.unreadMessages
                  : item.id === 'fleet' && state.activeMissions.length > 0
                    ? state.activeMissions.length
                    : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-amber-600/20 text-amber-200 border border-amber-500/45 shadow-inner'
                      : 'text-stone-300 hover:bg-white/5 hover:text-[#f2ead8] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-stone-400'}`} />
                    {item.label}
                  </span>
                  {badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded-full ${
                        item.id === 'messages'
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Sector Status Card on Desktop */}
          <div className="hidden lg:block mt-4 ops-panel rounded-xl p-4 text-xs space-y-2.5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/90 font-semibold">
              Aktiver Stützpunkt
            </div>
            <div className="font-semibold text-sm text-[#f2ead8]">{activeBase.name}</div>
            <div className="flex justify-between text-stone-400">
              <span>Koordinaten</span>
              <span className="font-mono-num text-amber-300">
                [{activeBase.sector}:{activeBase.position}]
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Stützpunkte</span>
              <span className="font-mono-num text-stone-200">
                {bases.length} / {1 + state.research.colonization}
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Verbände aktiv</span>
              <span className="font-mono-num text-stone-200">
                {state.activeMissions.length} / {1 + state.research.logistics}
              </span>
            </div>
            {lowEnergy && (
              <div className="mt-2 p-2 rounded bg-red-950/60 border border-red-700/50 text-[11px] text-red-200">
                Strommangel! Baue das Kraftwerk aus, um 100% Produktion zu erreichen.
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function ResourcePill({
  icon,
  label,
  amount,
  cap,
  ratePerHour,
  barColor,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  cap: number;
  ratePerHour: number;
  barColor: string;
}) {
  const pct = Math.min(100, cap > 0 ? (amount / cap) * 100 : 0);
  const full = amount >= cap;
  return (
    <div
      className="px-3 py-1.5 rounded-lg bg-[#151a16] border border-stone-700/70 min-w-[126px]"
      title={`Lager: ${fmtNum(amount)} / ${fmtNum(cap)} (+${fmtNum(ratePerHour)}/h)`}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-stone-400">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="font-mono-num text-emerald-400/90">+{fmtNum(ratePerHour)}/h</span>
      </div>
      <div className={`font-mono-num text-xs sm:text-sm font-bold leading-tight mt-0.5 ${full ? 'text-amber-300' : 'text-[#f2ead8]'}`}>
        {fmtNum(amount)}
        <span className="text-[10px] font-normal text-stone-500"> / {fmtNum(cap)}</span>
      </div>
      <div className="h-1 w-full bg-black/60 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full ${full ? 'bg-red-500' : barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
