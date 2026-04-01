# Animation Engine Rules

## Tech Stack
Remotion 4.0.440, Express, TypeScript, OpenAI/OpenRouter for prompt-to-props

## Templates (9 total)
| Template | Purpose | Key Props |
|----------|---------|-----------|
| InfoGraphic | Data visualization (flow/bars/cards) | title, items[], layout |
| TextOverlay | Title cards, lower thirds, quotes | text, subtitle, variant |
| StockFootagePlaceholder | Placeholder for stock footage | query, source, duration |
| ArticleReference | News/article citation card | headline, source, date |
| ConceptExplainer | Animated concept with bullets | title, points[], progress |
| ChapterTitle | Chapter intro animation | chapterNumber, title, duration |
| KnowledgeGraphAnim | Animated force-directed graph | nodes[], edges[], title |
| DataDashboard | Stats counters + charts | stats[], pedagogyScore |
| ProcessFlow | Step-by-step workflow | steps[], direction |

## Content Mark Routing
`content-mark-router.ts` maps `asset_type` + `search_query` keywords to templates:
- workflow/process/steps → ProcessFlow
- data/chart/statistics → DataDashboard
- knowledge/graph/network → KnowledgeGraphAnim
- animation (generic) → InfoGraphic or ConceptExplainer
- stock_video → StockFootagePlaceholder
- article → ArticleReference
- speaking_only → TextOverlay

## Prompt-to-Props
LLM converts search_query to structured props with Zod schema validation.
Falls back to rule-based prop generation when LLM unavailable.

## Render Queue
Singleton with configurable concurrency (default: 2 simultaneous).
Jobs tracked by ID with status: queued → rendering → completed/failed.

## API
- POST /api/generate — content mark → template props
- POST /api/render — queue render job
- GET /api/status/:id — job status + download URL
- GET /api/jobs — list all jobs
- GET /api/health — health check
