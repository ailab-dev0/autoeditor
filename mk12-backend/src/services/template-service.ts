/**
 * Template service for auto-populating animation props from knowledge graph.
 *
 * Maps concepts, chapters, and project-level data into Remotion
 * template props for the Phase 7 animation templates.
 */

import { getGraph, getTopConcepts, getCommunityClusters } from './knowledge-service.js';
import { listSegments } from './segment-service.js';
import type { KnowledgeNode, KnowledgeEdge } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// Types matching Remotion template props
// ──────────────────────────────────────────────────────────────────

export interface KnowledgeGraphAnimProps {
  nodes: { id: string; label: string; pageRank: number; community: number }[];
  edges: { source: string; target: string; type: string }[];
  title: string;
  duration: number;
}

export interface DataDashboardProps {
  stats: { label: string; value: number; color: string }[];
  pedagogyScore: number;
  title: string;
}

export interface ProcessFlowProps {
  steps: { label: string; description: string; icon?: string }[];
  title: string;
  direction: 'horizontal' | 'vertical';
}

export interface GeneratedTemplate {
  id: string;
  template_id: string;
  composition_id: string;
  props: KnowledgeGraphAnimProps | DataDashboardProps | ProcessFlowProps;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Community color palette
// ──────────────────────────────────────────────────────────────────

const COMMUNITY_COLORS = [
  '#0B84F3', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
];

function communityColor(community: number): string {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

// ──────────────────────────────────────────────────────────────────
// In-memory job store
// ──────────────────────────────────────────────────────────────────

interface GenerationJob {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  templates: GeneratedTemplate[];
  started_at: string;
  completed_at?: string;
  error?: string;
}

const jobStore = new Map<string, GenerationJob>();

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class TemplateService {
  /**
   * Generate animation props from a concept in the knowledge graph.
   * Routes to the best template based on the concept's relationships.
   */
  async generatePropsFromConcept(
    projectId: string,
    conceptId: string,
    templateId: string,
  ): Promise<GeneratedTemplate> {
    const graph = await getGraph(projectId);
    const node = graph.nodes.find((n) => n.id === conceptId);

    if (!node) {
      throw new Error(`Concept not found: ${conceptId}`);
    }

    // Find edges connected to this concept
    const relatedEdges = graph.edges.filter(
      (e) => e.source === conceptId || e.target === conceptId,
    );
    const relatedNodeIds = new Set(
      relatedEdges.flatMap((e) => [e.source, e.target]),
    );
    relatedNodeIds.delete(conceptId);

    const relatedNodes = graph.nodes.filter((n) => relatedNodeIds.has(n.id));

    let props: KnowledgeGraphAnimProps | DataDashboardProps | ProcessFlowProps;
    let compositionId: string;

    switch (templateId) {
      case 'KnowledgeGraphAnim': {
        compositionId = 'KnowledgeGraphAnim';
        props = {
          nodes: [node, ...relatedNodes].map((n) => ({
            id: n.id,
            label: n.label,
            pageRank: n.importance,
            community: n.community ?? 0,
          })),
          edges: relatedEdges.map((e) => ({
            source: e.source,
            target: e.target,
            type: e.relationship,
          })),
          title: node.label,
          duration: 210,
        } satisfies KnowledgeGraphAnimProps;
        break;
      }

      case 'ProcessFlow': {
        compositionId = 'ProcessFlow';
        // Build a process flow from prerequisite chain
        const prereqEdges = relatedEdges.filter(
          (e) => e.relationship === 'PREREQUISITE_OF' || e.relationship === 'BUILDS_UPON',
        );
        const steps = prereqEdges.map((e) => {
          const target = graph.nodes.find((n) => n.id === e.target);
          return {
            label: target?.label ?? e.target,
            description: `${e.relationship.replace(/_/g, ' ').toLowerCase()}`,
            icon: target?.type === 'skill' ? 'tool' : 'lightbulb',
          };
        });
        // Add the concept itself as the final step
        steps.push({
          label: node.label,
          description: 'Target concept',
          icon: 'star',
        });
        props = {
          steps,
          title: `Path to ${node.label}`,
          direction: steps.length > 5 ? 'vertical' : 'horizontal',
        } satisfies ProcessFlowProps;
        break;
      }

      default: {
        // Default to knowledge graph subgraph
        compositionId = 'KnowledgeGraphAnim';
        props = {
          nodes: [node, ...relatedNodes.slice(0, 8)].map((n) => ({
            id: n.id,
            label: n.label,
            pageRank: n.importance,
            community: n.community ?? 0,
          })),
          edges: relatedEdges.slice(0, 12).map((e) => ({
            source: e.source,
            target: e.target,
            type: e.relationship,
          })),
          title: node.label,
          duration: 180,
        } satisfies KnowledgeGraphAnimProps;
        break;
      }
    }

    return {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: templateId,
      composition_id: compositionId,
      props,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate a chapter title animation from chapter data.
   */
  async generateChapterAnimation(
    projectId: string,
    chapterId: string,
  ): Promise<GeneratedTemplate> {
    const segments = await listSegments(projectId);
    const chapterSegments = segments.filter((s) => s.chapter === chapterId);

    const chapterName = chapterId;
    const duration = chapterSegments.reduce(
      (sum, s) => sum + (s.end - s.start),
      0,
    );
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);

    // Count the unique chapters to get total
    const allChapters = new Set(segments.map((s) => s.chapter).filter(Boolean));
    const chapterList = Array.from(allChapters);
    const chapterIndex = chapterList.indexOf(chapterId);

    return {
      id: `tpl-ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: 'ChapterTitle',
      composition_id: 'ChapterTitle',
      props: {
        steps: [
          {
            label: chapterName,
            description: `${chapterSegments.length} segments, ${minutes}:${String(seconds).padStart(2, '0')}`,
          },
        ],
        title: chapterName,
        direction: 'horizontal' as const,
      } satisfies ProcessFlowProps,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate a knowledge graph animation for the entire project.
   * Shows the full concept map with communities and relationships.
   */
  async generateKnowledgeGraphAnimation(
    projectId: string,
  ): Promise<GeneratedTemplate> {
    const graph = await getGraph(projectId);

    // Take top 30 nodes by importance to keep the animation readable
    const topNodes = [...graph.nodes]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 30);

    const topNodeIds = new Set(topNodes.map((n) => n.id));

    // Only include edges between visible nodes
    const visibleEdges = graph.edges.filter(
      (e) => topNodeIds.has(e.source) && topNodeIds.has(e.target),
    );

    const props: KnowledgeGraphAnimProps = {
      nodes: topNodes.map((n) => ({
        id: n.id,
        label: n.label,
        pageRank: n.importance,
        community: n.community ?? 0,
      })),
      edges: visibleEdges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.relationship,
      })),
      title: 'Knowledge Graph',
      duration: 300, // 10s at 30fps
    };

    return {
      id: `tpl-kg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: 'KnowledgeGraphAnim',
      composition_id: 'KnowledgeGraphAnim',
      props,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate a data dashboard animation with project statistics.
   */
  async generateStatsAnimation(projectId: string): Promise<GeneratedTemplate> {
    const segments = await listSegments(projectId);
    const graph = await getGraph(projectId);

    const total = segments.length;
    const kept = segments.filter((s) => s.suggestion === 'keep').length;
    const cut = segments.filter((s) => s.suggestion === 'cut').length;
    const trimmed = segments.filter(
      (s) => s.suggestion === 'trim_start' || s.suggestion === 'trim_end' || s.suggestion === 'trim_both',
    ).length;
    const reviewed = segments.filter((s) => s.suggestion === 'review').length;
    const approved = segments.filter((s) => s.approved).length;
    const withMarks = segments.filter((s) => s.content_mark != null).length;

    // Compute an approximate pedagogy score from graph density
    const nodeCount = graph.nodes.length || 1;
    const edgeCount = graph.edges.length;
    const density = Math.min(edgeCount / (nodeCount * (nodeCount - 1) / 2 || 1), 1);
    const avgImportance = graph.nodes.reduce((s, n) => s + n.importance, 0) / nodeCount;
    const pedagogyScore = Math.round((density * 40 + avgImportance * 60) * 100) / 100;

    const props: DataDashboardProps = {
      stats: [
        { label: 'Total Segments', value: total, color: '#0B84F3' },
        { label: 'Kept', value: kept, color: '#27AE60' },
        { label: 'Cut', value: cut, color: '#E74C3C' },
        { label: 'Trimmed', value: trimmed, color: '#F1C40F' },
        { label: 'Review', value: reviewed, color: '#E67E22' },
        { label: 'Approved', value: approved, color: '#10b981' },
        { label: 'Content Marks', value: withMarks, color: '#6366f1' },
        { label: 'Concepts', value: graph.nodes.length, color: '#8b5cf6' },
      ],
      pedagogyScore: Math.min(pedagogyScore, 100),
      title: 'Project Analytics',
    };

    return {
      id: `tpl-stats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: 'DataDashboard',
      composition_id: 'DataDashboard',
      props,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate all templates for a project in one batch.
   * Creates a knowledge graph animation, stats dashboard, and
   * process flows for top concepts.
   */
  async generateAllForProject(projectId: string): Promise<GenerationJob> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: GenerationJob = {
      id: jobId,
      project_id: projectId,
      status: 'running',
      templates: [],
      started_at: new Date().toISOString(),
    };
    jobStore.set(jobId, job);

    try {
      // Generate knowledge graph animation
      const kgAnim = await this.generateKnowledgeGraphAnimation(projectId);
      job.templates.push(kgAnim);

      // Generate stats dashboard
      const statsAnim = await this.generateStatsAnimation(projectId);
      job.templates.push(statsAnim);

      // Generate process flows for top 5 concepts
      const topConcepts = await getTopConcepts(projectId, 5);
      for (const concept of topConcepts) {
        try {
          const processFlow = await this.generatePropsFromConcept(
            projectId,
            concept.id,
            'ProcessFlow',
          );
          job.templates.push(processFlow);
        } catch (err) {
          console.warn(
            `[template-service] Skipping concept ${concept.id}:`,
            (err as Error).message,
          );
        }
      }

      job.status = 'completed';
      job.completed_at = new Date().toISOString();
    } catch (err) {
      job.status = 'error';
      job.error = (err as Error).message;
      job.completed_at = new Date().toISOString();
    }

    return job;
  }

  /**
   * Get the status of a generation job.
   */
  getJob(jobId: string): GenerationJob | undefined {
    return jobStore.get(jobId);
  }

  /**
   * Get the latest job for a project.
   */
  getLatestJob(projectId: string): GenerationJob | undefined {
    let latest: GenerationJob | undefined;
    for (const job of jobStore.values()) {
      if (job.project_id === projectId) {
        if (!latest || job.started_at > latest.started_at) {
          latest = job;
        }
      }
    }
    return latest;
  }
}

// Singleton
let instance: TemplateService | null = null;

export function getTemplateService(): TemplateService {
  if (!instance) {
    instance = new TemplateService();
  }
  return instance;
}
