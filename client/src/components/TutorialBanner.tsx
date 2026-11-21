import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Gift, Target, X } from 'lucide-react';
import { TUTORIAL_STEPS } from '@shared/tutorial';
import type { GameStateResponse } from '@shared/types';
import { api } from '../api';
import type { NavTab } from './Layout';

interface TutorialBannerProps {
  state: GameStateResponse;
  onNavigate: (tab: NavTab) => void;
  onRefresh: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function TutorialBanner({
  state,
  onNavigate,
  onRefresh,
  onNotify,
}: TutorialBannerProps) {
  const { tutorial, activeBase } = state;
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (tutorial.completed || tutorial.dismissed) return null;

  const stepDef = TUTORIAL_STEPS[tutorial.currentStep];
  if (!stepDef) return null;

  const handleClaim = async () => {
    setBusy(true);
    try {
      const res = await api.claimTutorial(activeBase.id);
      onNotify(`Einsatz abgeschlossen! Belohnung erhalten: ${res.rewardLabel}`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Belohnung konnte nicht abgeholt werden.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await api.dismissTutorial(true);
      onRefresh();
    } catch {
      // ignore
    }
  };

  const progressPct = ((tutorial.currentStep + (tutorial.stepReadyToClaim ? 1 : 0)) / tutorial.totalSteps) * 100;

  return (
    <div
      className={`mb-5 rounded-xl border overflow-hidden shadow-xl transition ${
        tutorial.stepReadyToClaim
          ? 'bg-gradient-to-r from-emerald-950/80 via-[#13221a]/95 to-[#141a16]/95 border-emerald-500/65'
          : 'bg-gradient-to-r from-amber-950/45 via-[#181c19]/95 to-[#121614]/95 border-amber-500/45'
      }`}
    >
      {/* Top header strip */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase tracking-wider ${
              tutorial.stepReadyToClaim
                ? 'bg-emerald-500 text-black'
                : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
            }`}
          >
            OPERATION GRUNDSTEIN • {tutorial.currentStep + 1}/{tutorial.totalSteps}
          </span>
          <span className="font-display text-sm font-bold text-[#f4ede0] flex items-center gap-1.5">
            {tutorial.stepReadyToClaim ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Target className="w-4 h-4 text-amber-400" />
            )}
            {stepDef.code}: {stepDef.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden sm:block w-28 h-1.5 bg-black/60 rounded-full overflow-hidden mr-2">
            <div
              className={`h-full transition-all duration-500 ${
                tutorial.stepReadyToClaim ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Aufklappen' : 'Minimieren'}
            className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white cursor-pointer"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            title="Einführungsmission ausblenden"
            className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-red-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-stone-300 leading-relaxed">{stepDef.briefing}</p>
            <div className="text-xs font-semibold text-amber-200">
              Einsatzziel: <span className="text-[#f5efe2] font-normal">{stepDef.objective}</span>
            </div>
            <div className="text-[11px] text-stone-400">
              Tipp: {stepDef.tip}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num text-emerald-300 bg-emerald-950/40 border border-emerald-700/40 px-2.5 py-0.5 rounded mt-1">
              <Gift className="w-3.5 h-3.5" />
              Belohnung: {stepDef.rewardLabel}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {tutorial.stepReadyToClaim ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleClaim}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-[#07150d] font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 cursor-pointer animate-pulse disabled:opacity-50"
              >
                <Gift className="w-4 h-4" />
                Belohnung einfordern!
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(stepDef.targetTab)}
                className="px-4 py-2.5 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                Zum Einsatzort <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
