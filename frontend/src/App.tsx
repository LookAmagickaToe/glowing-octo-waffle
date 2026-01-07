import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const App = () => (
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

export default App;
