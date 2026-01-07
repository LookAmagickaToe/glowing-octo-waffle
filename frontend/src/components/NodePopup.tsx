import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, TrendingUp, User, FileText, ExternalLink, UserPlus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraphNode, Researcher, Paper, MarketViability } from '@/types';
import { useState, useMemo } from 'react';
import { useResearchers } from '@/contexts/ResearchersContext';
import { enrichResearcher } from '@/services/researcherEnrichmentService';

interface NodePopupProps {
  node: GraphNode | null;
  onClose: () => void;
}

const StarRating = ({ rating, label }: { rating: number; label: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-foreground text-foreground' : 'text-border'
          }`}
        />
      ))}
    </div>
  </div>
);

const NodePopup = ({ node, onClose }: NodePopupProps) => {
  const [showViability, setShowViability] = useState(false);
  const [viabilityLoading, setViabilityLoading] = useState(false);
  const [viability, setViability] = useState<MarketViability | null>(null);
  const { state: researchersState, addResearchers } = useResearchers();

  const handleMarketViability = async () => {
    setViabilityLoading(true);
    // Simulate AI call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setViability({
      novelty: Math.floor(Math.random() * 3) + 3,
      marketSize: Math.floor(Math.random() * 3) + 2,
      feasibility: Math.floor(Math.random() * 3) + 3,
      timing: Math.floor(Math.random() * 3) + 2,
    });
    setViabilityLoading(false);
    setShowViability(true);
  };

  const isResearcher = node?.type === 'researcher';
  const data = node?.data;

  // Check if researcher is already in the people database
  const isResearcherSaved = useMemo(() => {
    if (!isResearcher || !data) return false;
    const researcher = data as Researcher;
    return researchersState.researchers.some(
      r => r.name.toLowerCase() === researcher.name.toLowerCase()
    );
  }, [isResearcher, data, researchersState.researchers]);

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState('');

  const handleAddToPeople = async () => {
    if (isResearcher && data) {
      setIsEnriching(true);
      setEnrichmentStatus('Starting enrichment...');

      try {
        const { researcher: enrichedResearcher, sources } = await enrichResearcher(
          data as Researcher,
          (message) => setEnrichmentStatus(message)
        );

        addResearchers([enrichedResearcher]);
        setEnrichmentStatus(`Added with data from ${sources.join(', ')}`);
      } catch (error) {
        console.error('Enrichment failed:', error);
        // Still add the basic researcher if enrichment fails
        addResearchers([data as Researcher]);
        setEnrichmentStatus('Added (enrichment failed)');
      } finally {
        setIsEnriching(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          {/* Popup Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className={`px-5 py-4 flex items-start justify-between ${
                isResearcher ? 'bg-node-researcher' : 'bg-node-paper'
              }`}>
                <div className="flex items-center gap-3">
                  {isResearcher ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                  <div>
                    <h3 className="font-semibold text-sm">
                      {isResearcher ? 'Researcher' : 'Paper'}
                    </h3>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <h2 className="text-lg font-semibold leading-tight">
                  {isResearcher ? (data as Researcher).name : (data as Paper).title}
                </h2>

                {isResearcher ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {(data as Researcher).affiliation}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary p-3 rounded">
                        <p className="text-xs text-muted-foreground">h-index</p>
                        <p className="text-xl font-semibold">{(data as Researcher).hIndex ?? '-'}</p>
                      </div>
                      <div className="bg-secondary p-3 rounded">
                        <p className="text-xs text-muted-foreground">Citations</p>
                        <p className="text-xl font-semibold">
                          {((data as Researcher).citations || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(data as Researcher).papers.length} papers in database
                    </p>

                    {/* Add to People Button */}
                    <div className="pt-3 border-t border-border space-y-2">
                      <Button
                        onClick={handleAddToPeople}
                        disabled={isResearcherSaved || isEnriching}
                        variant={isResearcherSaved ? "secondary" : "default"}
                        className="w-full"
                      >
                        {isEnriching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enriching...
                          </>
                        ) : isResearcherSaved ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Saved to People
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add to People
                          </>
                        )}
                      </Button>
                      {enrichmentStatus && (
                        <p className="text-xs text-muted-foreground text-center">
                          {enrichmentStatus}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {(data as Paper).authors.join(', ')} • {(data as Paper).year}
                    </p>
                    <p className="text-sm leading-relaxed line-clamp-3">
                      {(data as Paper).abstract}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Source: {(data as Paper).source}
                      </span>
                      {(data as Paper).citations && (
                        <span className="text-muted-foreground">
                          {(data as Paper).citations?.toLocaleString()} citations
                        </span>
                      )}
                    </div>
                    
                    {(data as Paper).doi && (
                      <a
                        href={`https://doi.org/${(data as Paper).doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
                      >
                        View on DOI <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Market Viability Section */}
                    <div className="pt-3 border-t border-border">
                      {!showViability ? (
                        <Button
                          onClick={handleMarketViability}
                          disabled={viabilityLoading}
                          variant="outline"
                          className="w-full"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          {viabilityLoading ? 'Analyzing...' : 'Market Viability'}
                        </Button>
                      ) : viability && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-2"
                        >
                          <h4 className="text-sm font-medium mb-3">Market Viability Score</h4>
                          <StarRating rating={viability.novelty} label="Novelty" />
                          <StarRating rating={viability.marketSize} label="Market Size" />
                          <StarRating rating={viability.feasibility} label="Feasibility" />
                          <StarRating rating={viability.timing} label="Timing" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NodePopup;
