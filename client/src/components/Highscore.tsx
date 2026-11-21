import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import type { HighscoreEntry } from '@shared/types';
import { api, fmtNum } from '../api';

interface HighscoreProps {
  currentUserId: number;
}

export function Highscore({ currentUserId }: HighscoreProps) {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getHighscore()
      .then((res) => setEntries(res.entries))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="ops-panel rounded-xl p-4">
        <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          Oberkommando-Rangliste
        </h2>
        <p className="text-xs text-stone-400 mt-0.5">
          1 Punkt pro 1.000 verbaute Rohstoffe in Stützpunkten, Forschung, Truppen &amp; Verteidigung.
        </p>
      </div>

      <div className="ops-panel rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">Lade Rangliste...</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-800 text-[10px] uppercase tracking-wider text-stone-400 bg-black/40">
                <th className="py-3 px-4">Rang</th>
                <th className="py-3 px-4">Kommandant</th>
                <th className="py-3 px-4 text-center">Stützpunkte</th>
                <th className="py-3 px-4 text-right">Gebäude</th>
                <th className="py-3 px-4 text-right">Forschung</th>
                <th className="py-3 px-4 text-right">Militär</th>
                <th className="py-3 px-4 text-right">Gesamtpunkte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/70">
              {entries.map((e) => {
                const isSelf = e.userId === currentUserId;
                return (
                  <tr
                    key={e.userId}
                    className={
                      isSelf
                        ? 'bg-amber-950/30 text-amber-100'
                        : 'hover:bg-white/[0.02] text-stone-200'
                    }
                  >
                    <td className="py-3 px-4 font-mono-num font-bold text-amber-400">
                      #{e.rank}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        {!e.isAi && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              e.isOnline ? 'bg-emerald-400' : 'bg-stone-600'
                            }`}
                            title={e.isOnline ? 'Online' : 'Offline'}
                          />
                        )}
                        {e.allianceTag && (
                          <span className="text-emerald-400 font-semibold">[{e.allianceTag}]</span>
                        )}
                        <span className="font-semibold">{e.username}</span>
                      </span>
                      {isSelf && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300">
                          Du
                        </span>
                      )}
                      {e.isAi && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-[10px] text-stone-400">
                          KI
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono-num">{e.basesCount}</td>
                    <td className="py-3 px-4 text-right font-mono-num text-stone-300">
                      {fmtNum(e.buildingPoints)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-stone-300">
                      {fmtNum(e.researchPoints)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-stone-300">
                      {fmtNum(e.militaryPoints)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-amber-300">
                      {fmtNum(e.totalPoints)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
