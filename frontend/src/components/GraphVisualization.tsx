import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { GraphData, GraphNode, GraphLink, Paper } from '@/types';

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

const GraphVisualization = ({ data, onNodeClick, width, height }: GraphVisualizationProps) => {
  const fgRef = useRef<ForceGraphMethods>();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Find the most cited paper node
  const mostCitedPaperId = useMemo(() => {
    let maxCitations = -1;
    let mostCitedId: string | null = null;

    for (const node of data.nodes) {
      if (node.type === 'paper') {
        const citations = (node.data as Paper).citations || 0;
        if (citations > maxCitations) {
          maxCitations = citations;
          mostCitedId = node.id;
        }
      }
    }
    return mostCitedId;
  }, [data.nodes]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-200);
      fgRef.current.d3Force('link')?.distance(100);
    }
  }, []);

  const nodeColor = useCallback((node: NodeObject) => {
    const graphNode = node as GraphNode;
    if (graphNode.type === 'researcher') {
      return hoveredNode === graphNode.id ? '#93c5fd' : '#e0f2fe';
    }
    return hoveredNode === graphNode.id ? '#f9a8d4' : '#fce7f3';
  }, [hoveredNode]);

  const nodeBorderColor = useCallback((node: NodeObject) => {
    const graphNode = node as GraphNode;
    if (graphNode.type === 'researcher') {
      return '#7dd3fc';
    }
    return '#f9a8d4';
  }, []);

  // Check if this is a researcher-only graph (no papers)
  const isResearcherOnlyGraph = useMemo(() => {
    return data.nodes.every(n => n.type === 'researcher');
  }, [data.nodes]);

  const nodeCanvasObject = useCallback((node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const nodeSize = Math.max(3, (graphNode.val || 5) * 0.6);
    const x = node.x || 0;
    const y = node.y || 0;

    // Draw node
    ctx.beginPath();
    ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor(node);
    ctx.fill();
    ctx.strokeStyle = nodeBorderColor(node);
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();

    const isHovered = hoveredNode === graphNode.id;

    // For researcher-only graphs, show researcher labels
    if (isResearcherOnlyGraph && graphNode.type === 'researcher') {
      // Show label if zoomed in enough or hovered
      const zoomThreshold = 0.6;
      const shouldShowLabel = globalScale >= zoomThreshold || isHovered;

      if (shouldShowLabel) {
        const label = graphNode.name.length > 20
          ? graphNode.name.substring(0, 20) + '...'
          : graphNode.name;

        const fontSize = Math.min(10, 8 / globalScale);

        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isHovered ? '#1f2937' : '#374151';
        ctx.fillText(label, x, y + nodeSize + 2);
      }
    }
    // For mixed graphs, only show paper labels
    else if (graphNode.type === 'paper') {
      const isMostCited = graphNode.id === mostCitedPaperId;

      // Show label if: zoomed in enough, OR it's the most cited paper, OR it's hovered
      const zoomThreshold = 0.8;
      const shouldShowLabel = globalScale >= zoomThreshold || isMostCited || isHovered;

      if (shouldShowLabel) {
        const label = graphNode.name.length > 25
          ? graphNode.name.substring(0, 25) + '...'
          : graphNode.name;

        // Smaller font size
        const baseFontSize = isMostCited ? 8 : 6;
        const fontSize = Math.min(baseFontSize, baseFontSize / globalScale);

        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isMostCited ? '#1f2937' : '#6b7280';
        ctx.fillText(label, x, y + nodeSize + 2);
      }
    }
  }, [nodeColor, nodeBorderColor, hoveredNode, mostCitedPaperId, isResearcherOnlyGraph]);

  const handleNodeClick = useCallback((node: NodeObject) => {
    onNodeClick(node as GraphNode);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: NodeObject | null) => {
    setHoveredNode(node ? (node as GraphNode).id : null);
    document.body.style.cursor = node ? 'pointer' : 'default';
  }, []);

  // Link styling based on type
  const getLinkColor = useCallback((link: LinkObject) => {
    const graphLink = link as unknown as GraphLink;
    if (graphLink.type === 'coauthorship') {
      return '#3b82f6'; // Blue for co-authorship
    }
    if (graphLink.type === 'citation') {
      return '#f97316'; // Orange for citations
    }
    return '#e5e5e5'; // Light gray for authorship (researcher -> paper)
  }, []);

  const getLinkWidth = useCallback((link: LinkObject) => {
    const graphLink = link as unknown as GraphLink;
    if (graphLink.type === 'coauthorship') {
      // Thicker line based on number of co-authored papers
      return Math.min(4, 1 + (graphLink.weight || 1) * 0.5);
    }
    if (graphLink.type === 'citation') {
      return 1;
    }
    return 0.3; // Thin for authorship links
  }, []);

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={data}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={(node, color, ctx) => {
        const graphNode = node as GraphNode;
        const nodeSize = Math.max(3, (graphNode.val || 5) * 0.6);
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, nodeSize + 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      onZoom={({ k }) => setCurrentZoom(k)}
      linkColor={getLinkColor}
      linkWidth={getLinkWidth}
      backgroundColor="#ffffff"
      cooldownTicks={100}
      onEngineStop={() => fgRef.current?.zoomToFit(400, 50)}
    />
  );
};

export default GraphVisualization;
