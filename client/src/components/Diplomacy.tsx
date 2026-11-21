import { useEffect, useRef, useState } from 'react';
import { LogOut, Mail, Radio, Send, Shield, Users } from 'lucide-react';
import type { AllianceInfo, ChatMessage, GameStateResponse } from '@shared/types';
import { api, fmtNum, fmtTime } from '../api';

interface DiplomacyProps {
  state: GameStateResponse;
  incomingChat: ChatMessage | null;
  onRefreshState: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export function Diplomacy({
  state,
  incomingChat,
  onRefreshState,
  onNotify,
}: DiplomacyProps) {
  const [channel, setChannel] = useState<'global' | 'alliance'>('global');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [alliances, setAlliances] = useState<AllianceInfo[]>([]);
  const [myAllianceId, setMyAllianceId] = useState<number | null>(state.user.allianceId);

  // Create alliance form
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Direct message form
  const [dmRecipient, setDmRecipient] = useState('');
  const [dmSubject, setDmSubject] = useState('');
  const [dmBody, setDmBody] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadChat = (ch: 'global' | 'alliance') => {
    api
      .getChat(ch)
      .then((res) => setChatMessages(res.messages))
      .catch(() => {});
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

  useEffect(() => {
    loadChat(channel);
  }, [channel, myAllianceId]);

  useEffect(() => {
    loadAlliances();
  }, [state.user.allianceId]);

  // Append real-time SSE chat message immediately
  useEffect(() => {
    if (!incomingChat) return;
    if (incomingChat.channel !== channel) return;
    setChatMessages((prev) => {
      if (prev.some((m) => m.id === incomingChat.id)) return prev;
      return [...prev, incomingChat];
    });
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

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      {/* Left 3 cols: Live Front-Funk Chat */}
      <div className="lg:col-span-3 ops-panel rounded-xl p-4 flex flex-col h-[640px]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800">
          <div>
            <h2 className="font-display text-lg font-bold text-[#f3ebd8] flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400" />
              Live Front-Funk
            </h2>
            <p className="text-[11px] text-stone-400">
              Echtzeit-Mehrspieler-Kanal •{' '}
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
              Allianz-Funk {state.user.allianceTag ? `[${state.user.allianceTag}]` : ''}
            </button>
          </div>
        </div>

        {/* Messages Feed */}
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

        {/* Input */}
        <form onSubmit={handleSendChat} className="pt-3 border-t border-stone-800 flex gap-2">
          <input
            type="text"
            maxLength={400}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={
              channel === 'global'
                ? 'Funkspruch an alle Kommandanten senden...'
                : 'Verschlüsselter Allianz-Funk...'
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

      {/* Right 2 cols: Alliance Management + Direct Message */}
      <div className="lg:col-span-2 space-y-5">
        {/* Alliance Panel */}
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

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <div className="text-[10px] uppercase tracking-wider text-stone-400 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Mitgliederliste
                </div>
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
                      {m.isLeader && (
                        <span className="text-[9px] uppercase px-1 rounded bg-amber-500/20 text-amber-300">
                          Gründer
                        </span>
                      )}
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
                  placeholder="Kurzbeschreibung / Motto (optional)"
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
                  <div className="text-[10px] uppercase tracking-wider text-stone-400">
                    Bestehende Allianzen
                  </div>
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

        {/* Direct Message (PN) Composer */}
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
              placeholder="Betreff (z.B. Waffenstillstand)"
              className="w-full px-2.5 py-1.5 rounded bg-[#0c0f0d] border border-stone-700 text-xs text-white"
            />
            <textarea
              required
              rows={3}
              maxLength={1000}
              value={dmBody}
              onChange={(e) => setDmBody(e.target.value)}
              placeholder="Nachricht an anderen Spieler..."
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
    </div>
  );
}
