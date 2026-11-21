import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Handshake,
  LogOut,
  Mail,
  Radio,
  Search,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { FACTIONS } from '@shared/worldMap';
import type {
  AllianceInfo,
  ChatMessage,
  DiplomaticPact,
  GameStateResponse,
  PactType,
  PlayerListItem,
  ResourceType,
  TradeOffer,
} from '@shared/types';
import { api, fmtNum, fmtTime } from '../api';

interface DiplomacyProps {
  state: GameStateResponse;
  incomingChat: ChatMessage | null;
  onRefreshState: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

const RES_LABEL: Record<ResourceType, string> = {
  steel: 'Stahl',
  munition: 'Munition',
  fuel: 'Treibstoff',
};

export function Diplomacy({
  state,
  incomingChat,
  onRefreshState,
  onNotify,
}: DiplomacyProps) {
  const [subTab, setSubTab] = useState<'chat_players' | 'trade' | 'pacts'>('chat_players');

  // Chat state
  const [channel, setChannel] = useState<'global' | 'alliance'>('global');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Players, Alliances, Pacts, Trades
  const [players, setPlayers] = useState<PlayerListItem[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [alliances, setAlliances] = useState<AllianceInfo[]>([]);
  const [myAllianceId, setMyAllianceId] = useState<number | null>(state.user.allianceId);
  const [pacts, setPacts] = useState<DiplomaticPact[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);

  // Alliance create form
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Direct message modal/composer
  const [dmRecipient, setDmRecipient] = useState('');
  const [dmSubject, setDmSubject] = useState('');
  const [dmBody, setDmBody] = useState('');

  // Trade create form
  const [offerResource, setOfferResource] = useState<ResourceType>('steel');
  const [offerAmount, setOfferAmount] = useState('1000');
  const [wantResource, setWantResource] = useState<ResourceType>('fuel');
  const [wantAmount, setWantAmount] = useState('600');

  const loadChat = (ch: 'global' | 'alliance') => {
    api
      .getChat(ch)
      .then((res) => setChatMessages(res.messages))
      .catch(() => {});
  };

  const loadPlayersAndPacts = () => {
    api.getPlayers().then((r) => setPlayers(r.players)).catch(() => {});
    api.getPacts().then((r) => setPacts(r.pacts)).catch(() => {});
  };

  const loadAlliances = () => {
    api
      .getAlliances()
      .then((res) => {
        setAlliances(res.alliances);
        setMyAllianceId(res.myAllianceId);
      })
      .catch(() => {});
  };

  const loadTrades = () => {
    api.getTrades().then((r) => setTrades(r.offers)).catch(() => {});
  };

  useEffect(() => {
    loadChat(channel);
  }, [channel, myAllianceId]);

  useEffect(() => {
    loadPlayersAndPacts();
    loadAlliances();
    loadTrades();
  }, [state.user.allianceId, state.onlineCount]);

  useEffect(() => {
    if (!incomingChat || incomingChat.channel !== channel) return;
    setChatMessages((prev) =>
      prev.some((m) => m.id === incomingChat.id) ? prev : [...prev, incomingChat]
    );
  }, [incomingChat, channel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const res = await api.sendChat(channel, chatInput.trim());
      setChatInput('');
      setChatMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Funkspruch fehlgeschlagen.', true);
    }
  };

  const handleProposePact = async (targetUserId: number, pactType: PactType, username: string) => {
    try {
      await api.proposePact(targetUserId, pactType);
      onNotify(
        `${pactType === 'military_alliance' ? 'Militärbündnis' : 'Nichtangriffspakt'} an ${username} vorgeschlagen!`
      );
      loadPlayersAndPacts();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Vertragsangebot fehlgeschlagen.', true);
    }
  };

  const handleAcceptPact = async (pactId: number) => {
    try {
      await api.acceptPact(pactId);
      onNotify('Vertrag unterzeichnet! Gegenseitige Angriffe sind nun gesperrt.');
      loadPlayersAndPacts();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Annahme fehlgeschlagen.', true);
    }
  };

  const handleCancelPact = async (pactId: number) => {
    try {
      await api.cancelPact(pactId);
      onNotify('Vertrag / Angebot aufgehoben.');
      loadPlayersAndPacts();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Aufhebung fehlgeschlagen.', true);
    }
  };

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTrade({
        baseId: state.activeBase.id,
        offerResource,
        offerAmount: Number(offerAmount),
        wantResource,
        wantAmount: Number(wantAmount),
      });
      onNotify('Handelsangebot auf dem Kriegsmarkt eingestellt!');
      loadTrades();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Handelsangebot fehlgeschlagen.', true);
    }
  };

  const handleAcceptTrade = async (offerId: number) => {
    try {
      await api.acceptTrade(offerId, state.activeBase.id);
      onNotify('Handel erfolgreich abgeschlossen! Rohstoffe wurden getauscht.');
      loadTrades();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Handel fehlgeschlagen.', true);
    }
  };

  const handleCancelTrade = async (offerId: number) => {
    try {
      await api.cancelTrade(offerId);
      onNotify('Handelsangebot storniert. Rohstoffe wurden erstattet.');
      loadTrades();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Stornierung fehlgeschlagen.', true);
    }
  };

  const handleCreateAlliance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAlliance(tag, name, description);
      setTag('');
      setName('');
      setDescription('');
      onNotify('Allianz gegründet!');
      loadAlliances();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gründung fehlgeschlagen.', true);
    }
  };

  const handleJoinAlliance = async (id: number) => {
    try {
      await api.joinAlliance(id);
      onNotify('Allianz beigetreten!');
      loadAlliances();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Beitritt fehlgeschlagen.', true);
    }
  };

  const handleLeaveAlliance = async () => {
    try {
      await api.leaveAlliance();
      setChannel('global');
      onNotify('Allianz verlassen.');
      loadAlliances();
      onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Fehler beim Verlassen.', true);
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.sendDirectMessage(dmRecipient, dmSubject, dmBody);
      onNotify(`Direkt-Funkspruch an ${dmRecipient} übermittelt.`);
      setDmRecipient('');
      setDmSubject('');
      setDmBody('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Senden fehlgeschlagen.', true);
    }
  };

  const myAlliance = alliances.find((a) => a.id === myAllianceId) || null;
  const pendingIncomingPacts = pacts.filter(
    (p) => p.status === 'pending' && p.targetId === state.user.id
  );
  const filteredPlayers = players.filter((p) =>
    p.username.toLowerCase().includes(playerSearch.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Bar */}
      <div className="ops-panel rounded-xl p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('chat_players')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
            subTab === 'chat_players'
              ? 'bg-amber-600/25 border-amber-500 text-amber-200'
              : 'bg-black/30 border-stone-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          Live-Chat &amp; Spielerliste ({players.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('trade');
            loadTrades();
          }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
            subTab === 'trade'
              ? 'bg-amber-600/25 border-amber-500 text-amber-200'
              : 'bg-black/30 border-stone-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Kriegshandel / Marktplatz ({trades.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubTab('pacts');
            loadPlayersAndPacts();
            loadAlliances();
          }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
            subTab === 'pacts'
              ? 'bg-amber-600/25 border-amber-500 text-amber-200'
              : 'bg-black/30 border-stone-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          <Handshake className="w-4 h-4" />
          Bündnisse &amp; Allianzen
          {pendingIncomingPacts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-bold">
              {pendingIncomingPacts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LIVE CHAT + SPIELERLISTE */}
      {subTab === 'chat_players' && (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Left 3 cols: Live Front-Funk Chat */}
          <div className="lg:col-span-3 ops-panel rounded-xl p-4 flex flex-col h-[620px]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800">
              <div>
                <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400" />
                  Live Front-Funk
                </h2>
                <p className="text-[11px] text-stone-400">
                  Echtzeit-Chat •{' '}
                  <span className="text-emerald-400 font-semibold">
                    {state.onlineCount} Kommandant(en) online
                  </span>
                </p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setChannel('global')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    channel === 'global'
                      ? 'bg-amber-600/25 border-amber-500 text-amber-200'
                      : 'bg-black/40 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Globaler Funk
                </button>
                <button
                  type="button"
                  disabled={!myAllianceId}
                  onClick={() => setChannel('alliance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    channel === 'alliance'
                      ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200'
                      : 'bg-black/40 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Allianz {state.user.allianceTag ? `[${state.user.allianceTag}]` : ''}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {chatMessages.length === 0 ? (
                <div className="text-center text-xs text-stone-500 py-10">
                  Noch keine Funksprüche auf diesem Kanal. Sende die erste Nachricht!
                </div>
              ) : (
                chatMessages.map((m) => {
                  const isSelf = m.userId === state.user.id;
                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-lg border text-xs ${
                        isSelf
                          ? 'bg-amber-950/25 border-amber-600/35 ml-6'
                          : 'bg-black/45 border-stone-800 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-amber-300">
                          {m.allianceTag && (
                            <span className="text-emerald-400 mr-1">[{m.allianceTag}]</span>
                          )}
                          {m.username}
                        </span>
                        <span className="font-mono-num text-[10px] text-stone-500">
                          {fmtTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-stone-200 break-words leading-relaxed">{m.body}</p>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="pt-3 border-t border-stone-800 flex gap-2">
              <input
                type="text"
                maxLength={400}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  channel === 'global'
                    ? 'Nachricht an alle Kommandanten senden...'
                    : 'Verschlüsselter Allianz-Chat...'
                }
                className="flex-1 px-3 py-2 rounded-lg bg-[#0c0f0d] border border-stone-700 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Senden
              </button>
            </form>
          </div>

          {/* Right 2 cols: Live Spielerliste */}
          <div className="lg:col-span-2 ops-panel rounded-xl p-4 flex flex-col h-[620px]">
            <div className="pb-3 border-b border-stone-800 space-y-2.5">
              <h3 className="font-display text-base font-bold text-[#f3ebd8] flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Spielerliste ({players.length} Kommandanten)
              </h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Kommandant suchen..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0c0f0d] border border-stone-700 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1">
              {filteredPlayers.map((p) => {
                const isSelf = p.userId === state.user.id;
                const fac = FACTIONS[p.faction] || FACTIONS.mitteleuropa;
                return (
                  <div
                    key={p.userId}
                    className={`p-2.5 rounded-lg border text-xs space-y-2 ${
                      isSelf
                        ? 'bg-amber-950/25 border-amber-600/40'
                        : 'bg-black/45 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              p.isOnline ? 'bg-emerald-400' : 'bg-stone-600'
                            }`}
                            title={p.isOnline ? 'Online' : 'Offline'}
                          />
                          {p.allianceTag && (
                            <span className="text-emerald-400 font-semibold">[{p.allianceTag}]</span>
                          )}
                          <span className="font-semibold text-[#f2ead8] truncate">{p.username}</span>
                          {isSelf && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">
                              Du
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
                          <span style={{ color: fac.color }}>{fac.shortName}</span>
                          <span>•</span>
                          <span className="font-mono-num">{fmtNum(p.points)} Pkt</span>
                          <span>•</span>
                          <span>{p.basesCount} Prov.</span>
                        </div>
                      </div>

                      {p.pactStatus === 'active' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/50 text-[10px] text-emerald-200 shrink-0">
                          {p.pactType === 'military_alliance' ? 'Bündnis' : 'NAP'}
                        </span>
                      )}
                    </div>

                    {!isSelf && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-stone-800/70">
                        <button
                          type="button"
                          onClick={() => {
                            setDmRecipient(p.username);
                            setSubTab('pacts');
                          }}
                          className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Mail className="w-3 h-3" /> PN
                        </button>
                        {p.pactStatus === 'none' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleProposePact(p.userId, 'nap', p.username)}
                              className="px-2 py-1 rounded bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/50 text-[10px] text-sky-200 cursor-pointer"
                            >
                              NAP anbieten
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleProposePact(p.userId, 'military_alliance', p.username)
                              }
                              className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/50 text-[10px] text-emerald-200 cursor-pointer"
                            >
                              Bündnis anbieten
                            </button>
                          </>
                        )}
                        {p.pactStatus === 'pending_in' && p.pactId && (
                          <button
                            type="button"
                            onClick={() => handleAcceptPact(p.pactId!)}
                            className="px-2 py-1 rounded bg-emerald-600 text-black font-bold text-[10px] cursor-pointer"
                          >
                            Vertrag annehmen
                          </button>
                        )}
                        {p.pactStatus === 'pending_out' && (
                          <span className="text-[10px] text-amber-300/80 py-1">
                            Anfrage ausstehend...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KRIEGSHANDEL / MARKTPLATZ */}
      {subTab === 'trade' && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Create Trade Offer */}
          <div className="ops-panel rounded-xl p-4 space-y-3">
            <h3 className="font-display text-base font-bold text-[#f3ebd8] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
              Neues Handelsangebot
            </h3>
            <p className="text-xs text-stone-400">
              Angebotene Rohstoffe werden sicher reserviert und bei Stornierung 100% erstattet.
            </p>
            <form onSubmit={handleCreateTrade} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-black/45 border border-stone-800 space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                  Ich biete (aus {state.activeBase.name})
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={offerResource}
                    onChange={(e) => setOfferResource(e.target.value as ResourceType)}
                    className="px-2.5 py-2 rounded bg-[#0c0f0d] border border-stone-700 text-white"
                  >
                    <option value="steel">Stahl</option>
                    <option value="munition">Munition</option>
                    <option value="fuel">Treibstoff</option>
                  </select>
                  <input
                    type="number"
                    min={100}
                    max={500000}
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="px-2.5 py-2 rounded bg-[#0c0f0d] border border-stone-700 font-mono-num text-white"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/45 border border-stone-800 space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                  Ich suche dafür
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={wantResource}
                    onChange={(e) => setWantResource(e.target.value as ResourceType)}
                    className="px-2.5 py-2 rounded bg-[#0c0f0d] border border-stone-700 text-white"
                  >
                    <option value="steel">Stahl</option>
                    <option value="munition">Munition</option>
                    <option value="fuel">Treibstoff</option>
                  </select>
                  <input
                    type="number"
                    min={100}
                    max={500000}
                    value={wantAmount}
                    onChange={(e) => setWantAmount(e.target.value)}
                    className="px-2.5 py-2 rounded bg-[#0c0f0d] border border-stone-700 font-mono-num text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 font-semibold uppercase tracking-wider cursor-pointer"
              >
                Angebot auf Marktplatz stellen
              </button>
            </form>
          </div>

          {/* Open Market Offers */}
          <div className="lg:col-span-2 ops-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#f3ebd8]">
                Offene Handelsangebote ({trades.length})
              </h3>
              <button
                type="button"
                onClick={loadTrades}
                className="text-xs text-amber-300 hover:underline cursor-pointer"
              >
                Aktualisieren
              </button>
            </div>

            {trades.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                Derzeit keine offenen Angebote auf dem Kriegsmarkt. Stelle das erste Angebot ein!
              </div>
            ) : (
              <div className="space-y-2.5">
                {trades.map((o) => {
                  const isOwn = o.sellerUserId === state.user.id;
                  return (
                    <div
                      key={o.id}
                      className="p-3 rounded-lg bg-black/45 border border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#f3ebd8]">
                          {o.sellerAllianceTag && (
                            <span className="text-emerald-400 mr-1">[{o.sellerAllianceTag}]</span>
                          )}
                          {o.sellerName}
                          <span className="text-[10px] text-stone-500 ml-2 font-mono-num">
                            {fmtTime(o.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono-num">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-700/40 text-emerald-200">
                            Bietet: {fmtNum(o.offerAmount)} {RES_LABEL[o.offerResource]}
                          </span>
                          <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
                          <span className="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-700/40 text-amber-200">
                            Verlangt: {fmtNum(o.wantAmount)} {RES_LABEL[o.wantResource]}
                          </span>
                        </div>
                      </div>

                      {isOwn ? (
                        <button
                          type="button"
                          onClick={() => handleCancelTrade(o.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-700/50 text-red-200 text-xs font-semibold cursor-pointer"
                        >
                          Stornieren
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAcceptTrade(o.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/60 text-emerald-100 text-xs font-bold cursor-pointer"
                        >
                          Handel annehmen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BÜNDNISSE, VERTRÄGE, ALLIANZ & PN */}
      {subTab === 'pacts' && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Bilateral Pacts (NAP & Military Alliance) */}
          <div className="ops-panel rounded-xl p-4 space-y-3">
            <h3 className="font-display text-base font-bold text-[#f3ebd8] flex items-center gap-2">
              <Handshake className="w-4 h-4 text-emerald-400" />
              Bündnisse &amp; Nichtangriffspakte
            </h3>
            <p className="text-xs text-stone-400">
              Aktive Verträge schützen beide Seiten vor versehentlichen Angriffen und Eroberungen.
            </p>
            {pacts.length === 0 ? (
              <div className="text-xs text-stone-500 py-4">
                Noch keine Verträge aktiv. Schlage über die Spielerliste einen NAP oder ein Bündnis
                vor!
              </div>
            ) : (
              <div className="space-y-2">
                {pacts.map((p) => {
                  const otherName =
                    p.requesterId === state.user.id ? p.targetName : p.requesterName;
                  const isIncoming = p.status === 'pending' && p.targetId === state.user.id;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-black/45 border border-stone-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#f3ebd8]">{otherName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'active'
                              ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
                              : 'bg-amber-900/50 text-amber-200 border border-amber-500/40'
                          }`}
                        >
                          {p.pactType === 'military_alliance' ? 'Militärbündnis' : 'NAP'} •{' '}
                          {p.status === 'active' ? 'Aktiv' : 'Offen'}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {isIncoming && (
                          <button
                            type="button"
                            onClick={() => handleAcceptPact(p.id)}
                            className="flex-1 py-1.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-100 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Annehmen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCancelPact(p.id)}
                          className="flex-1 py-1.5 rounded bg-red-950/60 hover:bg-red-900/70 border border-red-700/50 text-red-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />{' '}
                          {p.status === 'active' ? 'Kündigen' : 'Ablehnen'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alliance Management */}
          <div className="ops-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#f3ebd8] flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Allianz-Kommando
              </h3>
              {myAlliance && (
                <button
                  type="button"
                  onClick={handleLeaveAlliance}
                  className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/70 border border-red-700/50 text-[11px] text-red-200 flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" /> Verlassen
                </button>
              )}
            </div>

            {myAlliance ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-600/40">
                  <div className="font-bold text-sm text-emerald-200">
                    [{myAlliance.tag}] {myAlliance.name}
                  </div>
                  {myAlliance.description && (
                    <p className="text-xs text-stone-300 mt-1">{myAlliance.description}</p>
                  )}
                  <div className="text-[11px] font-mono-num text-stone-400 mt-2">
                    {myAlliance.memberCount} Mitglied(er) • {fmtNum(myAlliance.totalPoints)} Pkt
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {myAlliance.members?.map((m) => (
                    <div
                      key={m.userId}
                      className="px-2.5 py-1.5 rounded bg-black/40 border border-stone-800 flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            m.isOnline ? 'bg-emerald-400' : 'bg-stone-600'
                          }`}
                        />
                        <span className="text-stone-200">{m.username}</span>
                      </span>
                      <span className="font-mono-num text-amber-300">{fmtNum(m.points)} Pkt</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <form onSubmit={handleCreateAlliance} className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={5}
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toUpperCase())}
                      placeholder="TAG"
                      className="px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs font-mono-num uppercase text-white"
                    />
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={28}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Allianzname"
                      className="col-span-2 px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={240}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Kurzbeschreibung (optional)"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/50 text-amber-200 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Neue Allianz gründen
                  </button>
                </form>

                {alliances.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-800 max-h-40 overflow-y-auto">
                    {alliances.map((a) => (
                      <div
                        key={a.id}
                        className="p-2 rounded bg-black/40 border border-stone-800 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#efe8d8] truncate">
                            [{a.tag}] {a.name}
                          </div>
                          <div className="text-[10px] font-mono-num text-stone-400">
                            {a.memberCount} Mitgl. • {fmtNum(a.totalPoints)} Pkt
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinAlliance(a.id)}
                          className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-600/50 text-emerald-200 text-[11px] font-semibold cursor-pointer shrink-0"
                        >
                          Beitreten
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Direct Message Composer */}
          <div className="ops-panel rounded-xl p-4 space-y-2.5">
            <h3 className="font-display text-base font-bold text-[#f3ebd8] flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              Direkt-Funkspruch (PN)
            </h3>
            <form onSubmit={handleSendDm} className="space-y-2">
              <input
                type="text"
                required
                value={dmRecipient}
                onChange={(e) => setDmRecipient(e.target.value)}
                placeholder="Empfänger (Kommandantenname)"
                className="w-full px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white"
              />
              <input
                type="text"
                maxLength={60}
                value={dmSubject}
                onChange={(e) => setDmSubject(e.target.value)}
                placeholder="Betreff"
                className="w-full px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white"
              />
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={dmBody}
                onChange={(e) => setDmBody(e.target.value)}
                placeholder="Private Nachricht an einen Kommandanten..."
                className="w-full px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white resize-none"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-[#232b24] hover:bg-[#2f3b30] border border-stone-600 text-[#f0e9d8] text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                Funkspruch übermitteln
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
