import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Headphones,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  PhoneCall,
  ReceiptText,
  Settings,
  UsersRound,
} from "lucide-react";

import { Layout } from "./components/Layout";
import { fetchSystemStatus } from "./lib/api";
import { CallAttempts } from "./pages/CallAttempts";
import { CallQueue } from "./pages/CallQueue";
import { Campaigns } from "./pages/Campaigns";
import { Cases } from "./pages/Cases";
import { Dashboard } from "./pages/Dashboard";
import { HumanCallbacks } from "./pages/HumanCallbacks";
import { PromiseToPay } from "./pages/PromiseToPay";
import { SettingsPage } from "./pages/SettingsPage";
import type { ConnectionState, NavigationItem, PageKey, SystemStatus } from "./types";

const navigation: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "cases", label: "Cases", icon: ReceiptText },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "call-queue", label: "Call Queue", icon: ListChecks },
  { key: "call-attempts", label: "Mock Calls", icon: PhoneCall },
  { key: "promise-to-pay", label: "Promise To Pay", icon: CalendarCheck },
  { key: "human-callbacks", label: "Human Callbacks", icon: Headphones },
  { key: "settings", label: "Settings", icon: Settings },
];

const fallbackStatus: SystemStatus = {
  app_name: "CollectVoice AI",
  version: "0.1.0",
  voice_mode: "mock",
  telephony_provider: "mock",
};

function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [status, setStatus] = useState<SystemStatus>(fallbackStatus);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetchSystemStatus(controller.signal)
      .then((payload) => {
        setStatus(payload);
        setConnectionState("online");
      })
      .catch(() => {
        setStatus(fallbackStatus);
        setConnectionState("offline");
      });

    return () => controller.abort();
  }, []);

  const activeLabel = useMemo(
    () => navigation.find((item) => item.key === activePage)?.label ?? "Dashboard",
    [activePage],
  );

  const page = useMemo(() => {
    switch (activePage) {
      case "cases":
        return <Cases />;
      case "campaigns":
        return <Campaigns />;
      case "call-queue":
        return <CallQueue />;
      case "call-attempts":
        return <CallAttempts />;
      case "promise-to-pay":
        return <PromiseToPay />;
      case "human-callbacks":
        return <HumanCallbacks />;
      case "settings":
        return <SettingsPage status={status} connectionState={connectionState} />;
      case "dashboard":
      default:
        return <Dashboard status={status} connectionState={connectionState} onNavigate={setActivePage} />;
    }
  }, [activePage, connectionState, status]);

  return (
    <Layout
      activePage={activePage}
      connectionState={connectionState}
      navigation={navigation}
      onNavigate={setActivePage}
      pageTitle={activeLabel}
      status={status}
    >
      {page}
    </Layout>
  );
}

export default App;
