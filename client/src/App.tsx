import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, GameStateResponse, MissionType, Resources } from '@shared/types';
import { api, getStoredToken, setStoredToken } from './api';
import { AuthScreen } from './components/AuthScreen';
import { Buildings } from './components/Buildings';
import { Diplomacy } from './components/Diplomacy';
import { FleetDispatch } from './components/FleetDispatch';
import { Highscore } from './components/Highscore';
import { Layout, type NavTab } from './components/Layout';
import { Messages } from './components/Messages';
import { Overview } from './components/Overview';
import { Production } from './components/Production';
import { Research } from './components/Research';
import { SectorMap } from './components/SectorMap';
import { TutorialBanner } from './components/TutorialBanner';
import { WorldMap } from './components/WorldMap';

export default function App() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [state, setState] = useState<GameStateResponse | null>(null);
  const [activeBaseId, setActiveBaseId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [syncedAtClientMs, setSyncedAtClientMs] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const [incomingChat, setIncomingChat] = useState<ChatMessage | null>(null);
  const [plannedMission, setPlannedMission] = useState<{
    sector: number;
    position: number;
    missionType: MissionType;
  } | null>(null);

  const syncingRef = useRef(false);

  const notify = useCallback((text: string, isError = false) => {
    setToast({ text, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchState = useCallback(
    async (baseIdOverride?: number) => {
      if (!getStoredToken() || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const data = await api.getState(baseIdOverride ?? activeBaseId);
        setState(data);
        setActiveBaseId(data.activeBase.id);
        setSyncedAtClientMs(Date.now());
        setNowMs(Date.now());
      } catch (err) {
        if (!getStoredToken()) {
          setToken(null);
          setState(null);
        } else if (err instanceof Error) {
          notify(err.message, true);
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [activeBaseId, notify]
  );

  // Initial load when token changes
  useEffect(() => {
    if (token) {
      fetchState();
    } else {
      setState(null);
    }
  }, [token, fetchState]);

  // Live Multiplayer SSE connection
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    es.addEventListener('chat', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as ChatMessage;
        setIncomingChat(msg);
      } catch {
        // ignore
      }
    });

    es.addEventListener('online', (e) => {
      try {
        const { onlineCount } = JSON.parse((e as MessageEvent).data) as { onlineCount: number };
        setState((prev) => (prev ? { ...prev, onlineCount } : prev));
      } catch {
        // ignore
      }
    });

    es.addEventListener('message', (e) => {
      try {
        const { title } = JSON.parse((e as MessageEvent).data) as { title: string };
        notify(`Neuer Funkspruch: ${title}`);
        fetchState();
      } catch {
        // ignore
      }
    });

    es.addEventListener('incoming', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          from: string;
          targetSector: number;
          targetPosition: number;
        };
        notify(
          `ALARM: ${data.from} entsendet Verband auf [${data.targetSector}:${data.targetPosition}]!`,
          true
        );
        fetchState();
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, [token, fetchState, notify]);

  // 1-second live tick + periodic server sync every 8 seconds
  useEffect(() => {
    if (!token) return;
    const tick = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const poll = setInterval(() => {
      fetchState();
    }, 8000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [token, fetchState]);

  // Trigger an immediate server sync when any timer reaches 0
  useEffect(() => {
    if (!state) return;
    const serverOffset = state.serverTime - syncedAtClientMs;
    const estimatedServerNow = nowMs + serverOffset;

    const dueBuild = state.activeBase.buildQueue && state.activeBase.buildQueue.endsAt <= estimatedServerNow;
    const dueResearch = state.researchQueue && state.researchQueue.endsAt <= estimatedServerNow;
    const dueUnit =
      state.activeBase.unitQueue.length > 0 &&
      state.activeBase.unitQueue[0].nextEndsAt <= estimatedServerNow;
    const dueMission = state.activeMissions.some((m) => {
      const ts = m.status === 'outbound' ? m.arrivesAt : m.returnsAt || m.arrivesAt;
      return ts <= estimatedServerNow;
    });

    if (dueBuild || dueResearch || dueUnit || dueMission) {
      fetchState();
    }
  }, [nowMs, state, syncedAtClientMs, fetchState]);

  // Smooth per-second interpolated resources
  const liveResources: Resources = useMemo(() => {
    if (!state) return { steel: 0, munition: 0, fuel: 0 };
    const dtSec = Math.max(0, (nowMs - syncedAtClientMs) / 1000);
    const b = state.activeBase;
    const add = (cur: number, ratePerHour: number, cap: number) =>
      cur >= cap ? cur : Math.min(cap, cur + (ratePerHour / 3600) * dtSec);

    return {
      steel: add(b.resources.steel, b.productionPerHour.steel, b.storage.steel),
      munition: add(b.resources.munition, b.productionPerHour.munition, b.storage.munition),
      fuel: add(b.resources.fuel, b.productionPerHour.fuel, b.storage.fuel),
    };
  }, [state, nowMs, syncedAtClientMs]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setToken(null);
    setState(null);
  };

  const handlePlanMission = (sector: number, position: number, missionType: MissionType) => {
    setPlannedMission({ sector, position, missionType });
    setActiveTab('fleet');
  };

  if (!token) {
    return (
      <AuthScreen
        onAuthenticated={() => {
          setToken(getStoredToken());
        }}
      />
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0a0c0b] flex items-center justify-center text-amber-300 text-sm font-display tracking-widest">
        VERBINDUNG ZUM HAUPTQUARTIER WIRD HERGESTELLT...
      </div>
    );
  }

  // Adjust nowMs to server clock for accurate countdowns
  const effectiveNow = nowMs + (state.serverTime - syncedAtClientMs);

  return (
    <>
      <Layout
        state={state}
        liveResources={liveResources}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSelectBase={(id) => {
          setActiveBaseId(id);
          fetchState(id);
        }}
        onLogout={handleLogout}
      >
        <TutorialBanner
          state={state}
          onNavigate={setActiveTab}
          onRefresh={() => fetchState()}
          onNotify={notify}
        />
        {activeTab === 'overview' && (
          <Overview
            state={state}
            nowMs={effectiveNow}
            onRefresh={() => fetchState()}
            onNavigate={setActiveTab}
            onNotify={notify}
          />
        )}
        {activeTab === 'world' && (
          <WorldMap
            state={state}
            onRefresh={() => fetchState()}
            onSelectBase={(id) => {
              setActiveBaseId(id);
              fetchState(id);
              setActiveTab('buildings');
            }}
            onNotify={notify}
            onPlanMission={handlePlanMission}
          />
        )}
        {activeTab === 'buildings' && (
          <Buildings
            state={state}
            liveResources={liveResources}
            nowMs={effectiveNow}
            onRefresh={() => fetchState()}
            onNotify={notify}
          />
        )}
        {activeTab === 'research' && (
          <Research
            state={state}
            liveResources={liveResources}
            nowMs={effectiveNow}
            onRefresh={() => fetchState()}
            onNotify={notify}
          />
        )}
        {activeTab === 'units' && (
          <Production
            mode="unit"
            state={state}
            liveResources={liveResources}
            nowMs={effectiveNow}
            onRefresh={() => fetchState()}
            onNotify={notify}
          />
        )}
        {activeTab === 'defense' && (
          <Production
            mode="defense"
            state={state}
            liveResources={liveResources}
            nowMs={effectiveNow}
            onRefresh={() => fetchState()}
            onNotify={notify}
          />
        )}
        {activeTab === 'sectors' && (
          <SectorMap
            state={state}
            onRefresh={() => fetchState()}
            onNotify={notify}
            onPlanMission={handlePlanMission}
          />
        )}
        {activeTab === 'fleet' && (
          <FleetDispatch
            state={state}
            liveResources={liveResources}
            initialTarget={plannedMission}
            onRefresh={() => fetchState()}
            onNotify={notify}
            onDispatched={() => setActiveTab('overview')}
          />
        )}
        {activeTab === 'diplomacy' && (
          <Diplomacy
            state={state}
            incomingChat={incomingChat}
            onRefreshState={() => fetchState()}
            onNotify={notify}
          />
        )}
        {activeTab === 'messages' && (
          <Messages
            onRefreshState={() => fetchState()}
            onPlanMission={handlePlanMission}
          />
        )}
        {activeTab === 'highscore' && <Highscore currentUserId={state.user.id} />}
      </Layout>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-lg border shadow-2xl text-xs font-medium backdrop-blur-md ${
            toast.isError
              ? 'bg-red-950/90 border-red-600/70 text-red-100'
              : 'bg-[#172119]/95 border-amber-500/60 text-amber-100'
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
