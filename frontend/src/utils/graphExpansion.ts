import { Paper, GraphData, GraphNode, GraphLink, Researcher } from '@/types';
import { extendedMockPapers, buildAuthorPaperIndex } from '@/data/mockData';

const MAX_PAPERS = 50;
const MAX_DEGREES = 3;

interface ExpansionResult {
  papers: Paper[];
  graphData: GraphData;
  degrees: number;
  truncated: boolean;
}

/**
 * Expands from seed papers to neighbors via author relationships
 * Uses BFS to traverse up to MAX_DEGREES, stopping at MAX_PAPERS
 */
export const expandPapersToGraph = (seedPapers: Paper[]): ExpansionResult => {
  const index = buildAuthorPaperIndex(extendedMockPapers);

  // Track visited papers and their degree from seeds
  const visited = new Map<string, number>(); // paperId -> degree
  const resultPapers: Paper[] = [];

  // Initialize BFS queue with seed papers at degree 0
  const queue: { paperId: string; degree: number }[] = [];

  seedPapers.forEach(paper => {
    if (!visited.has(paper.id)) {
      visited.set(paper.id, 0);
      resultPapers.push(paper);
      queue.push({ paperId: paper.id, degree: 0 });
    }
  });

  // BFS expansion
  let truncated = false;
  let maxDegreeReached = 0;

  while (queue.length > 0 && resultPapers.length < MAX_PAPERS) {
    const { paperId, degree } = queue.shift()!;

    if (degree >= MAX_DEGREES) continue;

    // Get the paper's authors
    const paper = index.paperIndex.get(paperId);
    if (!paper) continue;

    // For each author, find their other papers
    for (const author of paper.authors) {
      const authorPapers = index.authorToPapers.get(author) || [];

      for (const neighborPaperId of authorPapers) {
        if (resultPapers.length >= MAX_PAPERS) {
          truncated = true;
          break;
        }

        if (!visited.has(neighborPaperId)) {
          const neighborPaper = index.paperIndex.get(neighborPaperId);
          if (neighborPaper) {
            const newDegree = degree + 1;
            visited.set(neighborPaperId, newDegree);
            resultPapers.push(neighborPaper);
            maxDegreeReached = Math.max(maxDegreeReached, newDegree);

            if (newDegree < MAX_DEGREES) {
              queue.push({ paperId: neighborPaperId, degree: newDegree });
            }
          }
        }
      }

      if (resultPapers.length >= MAX_PAPERS) break;
    }
  }

  // Convert to graph data
  const graphData = convertToGraphData(resultPapers, index);

  return {
    papers: resultPapers,
    graphData,
    degrees: maxDegreeReached,
    truncated,
  };
};

/**
 * Converts papers to GraphData format with researcher nodes and co-authorship links
 */
const convertToGraphData = (
  papers: Paper[],
  index: ReturnType<typeof buildAuthorPaperIndex>
): GraphData => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const addedResearchers = new Set<string>();

  // Track co-authorship relationships: "researcherA-researcherB" -> count
  const coAuthorships = new Map<string, number>();

  // Add paper nodes
  papers.forEach(paper => {
    nodes.push({
      id: paper.id,
      name: paper.title,
      type: 'paper',
      val: 10,
      data: paper,
    });

    // Collect researcher IDs for this paper to build co-authorship links
    const paperResearcherIds: string[] = [];

    // Add researcher nodes and links
    paper.authors.forEach(authorName => {
      const researcherId = `researcher-${authorName.replace(/\s+/g, '-').toLowerCase()}`;
      paperResearcherIds.push(researcherId);

      if (!addedResearchers.has(researcherId)) {
        addedResearchers.add(researcherId);
        const authorPapers = index.authorToPapers.get(authorName) || [];
        const researcher: Researcher = {
          id: researcherId,
          name: authorName,
          affiliation: 'Unknown',
          papers: authorPapers,
          // Estimate citations based on number of papers
          citations: authorPapers.length * 50,
          hIndex: Math.min(authorPapers.length, 20),
        };
        nodes.push({
          id: researcherId,
          name: authorName,
          type: 'researcher',
          val: Math.max(8, Math.min(25, authorPapers.length * 3)), // Size by paper count
          data: researcher,
        });
      }

      // Link researcher to paper
      links.push({
        source: researcherId,
        target: paper.id,
        type: 'authorship',
      });
    });

    // Build co-authorship links between all authors of this paper
    for (let i = 0; i < paperResearcherIds.length; i++) {
      for (let j = i + 1; j < paperResearcherIds.length; j++) {
        const id1 = paperResearcherIds[i];
        const id2 = paperResearcherIds[j];
        // Create a consistent key (alphabetically sorted)
        const key = id1 < id2 ? `${id1}||${id2}` : `${id2}||${id1}`;
        coAuthorships.set(key, (coAuthorships.get(key) || 0) + 1);
      }
    }
  });

  // Add co-authorship links between researchers
  coAuthorships.forEach((count, key) => {
    const [source, target] = key.split('||');
    links.push({
      source,
      target,
      type: 'coauthorship',
      weight: count, // Number of papers co-authored
    });
  });

  return { nodes, links };
};
