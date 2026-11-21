import { useEffect, useRef, useState } from 'react';
import { Crosshair, KeyRound, Shield, UserPlus, Zap } from 'lucide-react';
import { FACTIONS, FACTION_ORDER, type FactionId } from '@shared/worldMap';
import { api, setStoredToken } from '../api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [faction, setFaction] = useState<FactionId>('mitteleuropa');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [showGoogleHint, setShowGoogleHint] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const factionRef = useRef<FactionId>(faction);
  factionRef.current = faction;

  useEffect(() => {
    api
      .getAuthProviders()
      .then((res) => {
        if (res.googleEnabled && res.googleClientId) {
          setGoogleClientId(res.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;

    const initGsi = () => {
      if (!window.google || !googleBtnRef.current) return;
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp) => {
          if (!resp.credential) return;
          setError(null);
          setLoading(true);
          try {
            const res = await api.loginWithGoogle(resp.credential, factionRef.current);
            setStoredToken(res.token);
            onAuthenticated();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google-Anmeldung fehlgeschlagen.');
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 280,
        text: 'continue_with',
        locale: 'de',
      });
    };

    if (window.google) {
      initGsi();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [googleClientId, onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, password, faction);
      setStoredToken(res.token);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickstart = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.quickstart(faction);
      setStoredToken(res.token);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schnellstart fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#0a0c0b]">
      {/* Strategic map background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: "url('/assets/bg-map.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-[#090b0a]" />
      <div className="absolute inset-0 ops-grid-bg" />

      <div className="relative z-10 w-full max-w-4xl grid md:grid-cols-5 gap-6 items-stretch">
        {/* Left Briefing Panel */}
        <div className="md:col-span-3 ops-panel rounded-xl p-7 flex flex-col justify-between border border-amber-500/25">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <img
                src="/assets/emblem.jpg"
                alt="FRONTKOMMANDO 1942 Emblem"
                className="w-16 h-16 rounded-lg object-cover border border-amber-500/40 shadow-lg"
              />
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-400/90 font-semibold">
                  Taktische Echtzeit-Kriegsführung
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-[#f2ead8]">
                  FRONTKOMMANDO <span className="text-amber-400">1942</span>
                </h1>
              </div>
            </div>

            <p className="text-sm text-[#c4bfb0] leading-relaxed mb-6">
              Übernimm das Kommando über deinen eigenen Front-Stützpunkt. Steuere Echtzeit-Rohstoffproduktion,
              erforsche Panzerung, Geschütze und Funkaufklärung, stelle Panzer- und Luftwaffenverbände auf und
              führe taktische Operationen über fünf umkämpfte Front-Sektoren.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-black/40 border border-stone-700/60 rounded-lg p-3">
                <Shield className="w-4 h-4 text-amber-400 mb-1.5" />
                <div className="font-semibold text-[#ede6d6] mb-0.5">Echtzeit-Ökonomie</div>
                <div className="text-[#9e998b]">Stahl, Munition, Treibstoff &amp; Stromversorgung im Sekundentakt.</div>
              </div>
              <div className="bg-black/40 border border-stone-700/60 rounded-lg p-3">
                <Crosshair className="w-4 h-4 text-amber-400 mb-1.5" />
                <div className="font-semibold text-[#ede6d6] mb-0.5">6-Runden-Gefechte</div>
                <div className="text-[#9e998b]">Authentischer Kampfsimulator mit Rapidfire, Beute &amp; Kampfberichten.</div>
              </div>
              <div className="bg-black/40 border border-stone-700/60 rounded-lg p-3">
                <Zap className="w-4 h-4 text-amber-400 mb-1.5" />
                <div className="font-semibold text-[#ede6d6] mb-0.5">KI- &amp; Mehrspieler</div>
                <div className="text-[#9e998b]">5 Front-Sektoren mit dynamischen KI-Stellungen &amp; Highscore.</div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-700/60 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold mb-2">
                Fraktion wählen (für Schnellstart &amp; Registrierung)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FACTION_ORDER.map((fId) => {
                  const f = FACTIONS[fId];
                  const selected = faction === fId;
                  return (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => setFaction(fId)}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        selected
                          ? `${f.bgClass} ring-1 ring-amber-400/70`
                          : 'bg-black/45 border-stone-800 hover:border-stone-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-bold ${f.textClass}`}>{f.shortName}</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: f.color }}
                        />
                      </div>
                      <div className="text-[10px] text-stone-400 truncate mt-0.5">
                        {f.bonusSummary[0]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickstart}
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-[#12100b] font-bold tracking-wide text-sm uppercase shadow-lg shadow-amber-900/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              Sofort losspielen ({FACTIONS[faction].shortName})
            </button>
            <p className="text-[11px] text-[#9b9587] text-center">
              Startet sofort mit Heimatprovinz, Start-Rohstoffen, Spähwagen &amp; Infanterie-Verband.
            </p>
          </div>
        </div>

        {/* Right Login / Register Panel */}
        <div className="md:col-span-2 ops-panel rounded-xl p-6 flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-1.5 bg-black/50 p-1 rounded-lg border border-stone-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-amber-600/25 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-amber-600/25 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-400 mb-1.5">
                Kommandantenname
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z.B. Oberst_Keller"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0d100e] border border-stone-700 focus:border-amber-500 focus:outline-none text-sm text-[#efe8d8]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-400 mb-1.5">
                Passwort
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0d100e] border border-stone-700 focus:border-amber-500 focus:outline-none text-sm text-[#efe8d8]"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-700/60 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2a332b] hover:bg-[#354236] border border-amber-500/40 text-amber-200 font-semibold text-sm uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
            >
              {loading
                ? 'Verbindung wird hergestellt...'
                : mode === 'login'
                  ? 'Ins Hauptquartier einrücken'
                  : 'Neues Kommando gründen'}
            </button>
          </form>

          {/* Google Sign-In / Registration */}
          <div className="mt-5 pt-4 border-t border-stone-800 space-y-2.5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400 text-center">
              Oder mit Google-Konto
            </div>
            {googleClientId ? (
              <div ref={googleBtnRef} className="flex justify-center" />
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setShowGoogleHint((v) => !v)}
                  className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-stone-100 text-[#1f1f1f] font-semibold text-xs flex items-center justify-center gap-2.5 transition cursor-pointer shadow"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.28v3.1A12 12 0 0 0 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.1z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
                    />
                  </svg>
                  Mit Google anmelden / registrieren
                </button>
                {showGoogleHint && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-950/50 border border-amber-600/40 text-[11px] text-amber-200 leading-relaxed">
                    Google-Login ist bereit! Setze einfach die Umgebungsvariable{' '}
                    <code className="font-mono-num text-amber-100">GOOGLE_CLIENT_ID</code> (aus der
                    Google Cloud Console → OAuth 2.0 Web-Client) auf deinem Server oder in Render,
                    dann funktioniert der Button sofort automatisch.
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-stone-500 text-center leading-relaxed">
            Dein Fortschritt, Rohstoffe und laufende Operationen werden dauerhaft in der SQLite-Datenbank gespeichert.
          </p>
        </div>
      </div>
    </div>
  );
}
