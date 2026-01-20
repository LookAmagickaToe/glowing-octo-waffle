import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Graph from "./pages/Graph";
import SearchPapers from "./pages/SearchPapers";
import Researchers from "./pages/Researchers";
import NotFound from "./pages/NotFound";
import { SearchProvider } from "./contexts/SearchContext";
import { QueryProvider } from "./contexts/QueryContext";
import { GraphProvider } from "./contexts/GraphContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ResearchersProvider } from "./contexts/ResearchersContext";

const queryClient = new QueryClient();

const App = () => {
  const lockPassword = useMemo(
    () => import.meta.env.VITE_LockScreenPassword || import.meta.env.LockScreenPassword || '',
    []
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!lockPassword);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lockPassword) return;
    const unlocked = sessionStorage.getItem('lockscreen_unlocked') === 'true';
    if (unlocked) {
      setIsUnlocked(true);
    }
  }, [lockPassword]);

  const handleUnlock = () => {
    if (!lockPassword) return;
    if (passwordInput === lockPassword) {
      sessionStorage.setItem('lockscreen_unlocked', 'true');
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password.');
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm border border-border rounded-lg p-6 bg-card shadow-sm space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Enter Password</h1>
            <p className="text-sm text-muted-foreground">Access is restricted.</p>
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUnlock();
                }
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button className="w-full" onClick={handleUnlock}>
            Unlock
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SettingsProvider>
            <SearchProvider>
              <QueryProvider>
                <GraphProvider>
                  <ResearchersProvider>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/search" element={<SearchPapers />} />
                        <Route path="/researchers" element={<Researchers />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/graph" element={<Graph />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </ResearchersProvider>
                </GraphProvider>
              </QueryProvider>
            </SearchProvider>
          </SettingsProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
