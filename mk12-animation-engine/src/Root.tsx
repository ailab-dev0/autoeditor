import React from "react";
import { Composition } from "remotion";
import { MK12_VIDEO } from "./styles/theme";

import { InfoGraphic, type InfoGraphicProps } from "./templates/InfoGraphic";
import { TextOverlay, type TextOverlayProps } from "./templates/TextOverlay";
import {
  StockFootagePlaceholder,
  type StockFootagePlaceholderProps,
} from "./templates/StockFootagePlaceholder";
import {
  ArticleReference,
  type ArticleReferenceProps,
} from "./templates/ArticleReference";
import {
  ConceptExplainer,
  type ConceptExplainerProps,
} from "./templates/ConceptExplainer";
import { ChapterTitle, type ChapterTitleProps } from "./templates/ChapterTitle";
import {
  KnowledgeGraphAnim,
  type KnowledgeGraphAnimProps,
} from "./templates/KnowledgeGraphAnim";
import {
  DataDashboard,
  type DataDashboardProps,
} from "./templates/DataDashboard";
import {
  ProcessFlow,
  type ProcessFlowProps,
} from "./templates/ProcessFlow";

// ─── Default Props ──────────────────────────────────────────────────────────

const defaultInfoGraphicProps: InfoGraphicProps = {
  title: "VAT Workflow",
  subtitle: "How Value Added Tax flows through the supply chain",
  steps: [
    {
      label: "Input Tax",
      icon: "currency",
      description: "Tax paid on purchases from suppliers",
      value: 20,
    },
    {
      label: "Value Added",
      icon: "chart",
      description: "Business adds value through processing",
    },
    {
      label: "Output Tax",
      icon: "document",
      description: "Tax charged on sales to customers",
      value: 20,
    },
    {
      label: "Net Payment",
      icon: "checkmark",
      description: "Difference paid to/refunded by HMRC",
      value: 0,
    },
  ],
  layout: "flow",
};

const defaultTextOverlayProps: TextOverlayProps = {
  text: "Dr. Sarah Chen",
  secondaryText: "Senior Tax Consultant",
  tertiaryText: "KPMG London",
  variant: "lower_third",
};

const defaultStockFootageProps: StockFootagePlaceholderProps = {
  searchQuery: "professional meeting stock footage",
  scenario: "Colleague asking for help in office setting",
  description:
    "Two professionals discussing work at a desk, modern office environment",
  sources: ["Getty Images", "Pexels", "Shutterstock"],
  targetDuration: 8,
};

const defaultArticleReferenceProps: ArticleReferenceProps = {
  headline: "KPMG Announces Major Global Expansion Strategy for 2020",
  source: "Financial Times",
  date: "March 2020",
  section: "Business & Finance",
  author: "James Henderson",
  summary:
    "KPMG revealed plans to expand into 15 new markets, with a focus on emerging economies in Southeast Asia and Africa.",
};

const defaultConceptExplainerProps: ConceptExplainerProps = {
  title: "Artificial Intelligence",
  intro:
    "AI is transforming how we work, communicate, and solve problems across every industry.",
  points: [
    {
      text: "Machine Learning",
      icon: "code",
      detail: "Systems that learn patterns from data without explicit programming",
    },
    {
      text: "Natural Language Processing",
      icon: "chat",
      detail: "Understanding and generating human language",
    },
    {
      text: "Computer Vision",
      icon: "cloud",
      detail: "Interpreting and analyzing visual information from images and video",
    },
    {
      text: "Automation",
      icon: "workflow",
      detail: "Replacing repetitive tasks with intelligent systems",
    },
  ],
  conclusion:
    "AI augments human capability rather than replacing it, enabling us to focus on creative and strategic work.",
};

const defaultChapterTitleProps: ChapterTitleProps = {
  chapterNumber: 1,
  title: "Getting Started",
  subtitle: "An introduction to the fundamentals",
  duration: "4:32",
  totalChapters: 8,
};

const defaultKnowledgeGraphAnimProps: KnowledgeGraphAnimProps = {
  nodes: [
    { id: "vat", label: "VAT", pageRank: 0.9, community: 0 },
    { id: "input-tax", label: "Input Tax", pageRank: 0.7, community: 0 },
    { id: "output-tax", label: "Output Tax", pageRank: 0.7, community: 0 },
    { id: "hmrc", label: "HMRC", pageRank: 0.6, community: 1 },
    { id: "compliance", label: "Compliance", pageRank: 0.5, community: 1 },
    { id: "supply-chain", label: "Supply Chain", pageRank: 0.4, community: 2 },
    { id: "invoicing", label: "Invoicing", pageRank: 0.35, community: 2 },
    { id: "threshold", label: "VAT Threshold", pageRank: 0.3, community: 1 },
  ],
  edges: [
    { source: "vat", target: "input-tax", type: "INCLUDES" },
    { source: "vat", target: "output-tax", type: "INCLUDES" },
    { source: "vat", target: "hmrc", type: "REGULATED_BY" },
    { source: "hmrc", target: "compliance", type: "REQUIRES" },
    { source: "supply-chain", target: "input-tax", type: "GENERATES" },
    { source: "invoicing", target: "output-tax", type: "DOCUMENTS" },
    { source: "compliance", target: "threshold", type: "DEPENDS_ON" },
  ],
  title: "VAT Knowledge Graph",
  duration: 210,
};

const defaultDataDashboardProps: DataDashboardProps = {
  stats: [
    { label: "Total Segments", value: 128, color: "#0B84F3" },
    { label: "Kept", value: 47, color: "#27AE60" },
    { label: "Cut", value: 52, color: "#E74C3C" },
    { label: "Trimmed", value: 18, color: "#F1C40F" },
    { label: "Review", value: 11, color: "#E67E22" },
    { label: "Approved", value: 42, color: "#10b981" },
    { label: "Content Marks", value: 23, color: "#6366f1" },
    { label: "Concepts", value: 34, color: "#8b5cf6" },
  ],
  pedagogyScore: 78,
  title: "Project Analytics",
};

const defaultProcessFlowProps: ProcessFlowProps = {
  steps: [
    { label: "Register for VAT", description: "Apply to HMRC when turnover exceeds threshold", icon: "document" },
    { label: "Charge Output Tax", description: "Add VAT to invoices for taxable supplies", icon: "currency" },
    { label: "Reclaim Input Tax", description: "Deduct VAT paid on business purchases", icon: "chart" },
    { label: "File VAT Return", description: "Submit quarterly return to HMRC", icon: "checkmark" },
    { label: "Pay or Reclaim", description: "Settle the net amount with HMRC", icon: "workflow" },
  ],
  title: "VAT Compliance Workflow",
  direction: "horizontal",
};

// ─── Root Composition ───────────────────────────────────────────────────────

export const RemotionRoot: React.FC = () => {
  const { width, height, fps } = MK12_VIDEO;

  return (
    <>
      <Composition
        id="InfoGraphic"
        component={InfoGraphic}
        durationInFrames={210}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultInfoGraphicProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="TextOverlay"
        component={TextOverlay}
        durationInFrames={120}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultTextOverlayProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="StockFootagePlaceholder"
        component={StockFootagePlaceholder}
        durationInFrames={150}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultStockFootageProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="ArticleReference"
        component={ArticleReference}
        durationInFrames={180}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultArticleReferenceProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="ConceptExplainer"
        component={ConceptExplainer}
        durationInFrames={240}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultConceptExplainerProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="ChapterTitle"
        component={ChapterTitle}
        durationInFrames={120}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultChapterTitleProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />
      <Composition
        id="KnowledgeGraphAnim"
        component={KnowledgeGraphAnim}
        durationInFrames={210}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultKnowledgeGraphAnimProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: (props.duration as number | undefined) ?? props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="DataDashboard"
        component={DataDashboard}
        durationInFrames={240}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultDataDashboardProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />

      <Composition
        id="ProcessFlow"
        component={ProcessFlow}
        durationInFrames={300}
        fps={fps}
        width={width}
        height={height}
        defaultProps={defaultProcessFlowProps}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: props.durationInFrames as number | undefined,
        })}
      />
    </>
  );
};
