/**
 * AI image generation service.
 *
 * Integrates with Fal.ai to generate images from content mark prompts.
 * Supports Flux, Flux Pro, and Stable Diffusion models.
 *
 * REQUIRES FAL_API_KEY — throws if not configured.
 */

import { fal } from '@fal-ai/client';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { listSegments } from './segment-service.js';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type ImageModel = 'flux' | 'flux-pro' | 'stable-diffusion';
export type AspectRatio = '16:9' | '4:3' | '1:1';

export interface GenerateImageOptions {
  model?: ImageModel;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
  model: string;
  created_at: string;
  segment_id?: string;
  project_id: string;
}

export interface GenerationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  image?: GeneratedImage;
  error?: string;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Model mapping — Fal.ai endpoint IDs
// ──────────────────────────────────────────────────────────────────

const MODEL_ENDPOINTS: Record<ImageModel, string> = {
  'flux': 'fal-ai/flux/dev',
  'flux-pro': 'fal-ai/flux-pro',
  'stable-diffusion': 'fal-ai/stable-diffusion-v35-large',
};

// ──────────────────────────────────────────────────────────────────
// Aspect ratio to pixel dimensions
// ──────────────────────────────────────────────────────────────────

const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
  '1:1': { width: 1024, height: 1024 },
};

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class ImageGenerationService {
  // In-memory stores (per-project)
  private images = new Map<string, GeneratedImage[]>(); // projectId -> images
  private jobs = new Map<string, GenerationJob>(); // jobId -> job

  constructor() {
    if (!config.falApiKey) {
      console.warn('[image-gen] FAL_API_KEY not set — image generation will fail until configured');
    }
  }

  /**
   * Ensure the Fal.ai client is configured. Throws if no API key.
   */
  private ensureConfigured(): void {
    if (!config.falApiKey) {
      throw new Error(
        'FAL_API_KEY is not configured. Set it in your .env file to enable AI image generation.',
      );
    }
    fal.config({ credentials: config.falApiKey });
  }

  /**
   * Generate an image from a text prompt.
   */
  async generateImage(
    projectId: string,
    prompt: string,
    options?: GenerateImageOptions,
  ): Promise<GeneratedImage> {
    this.ensureConfigured();

    const model: ImageModel = options?.model ?? 'flux';
    const endpoint = MODEL_ENDPOINTS[model];

    // Resolve dimensions from aspect ratio or explicit values
    let width = options?.width;
    let height = options?.height;
    if (!width || !height) {
      const aspect = options?.aspectRatio ?? '16:9';
      const dims = ASPECT_DIMENSIONS[aspect];
      width = width ?? dims.width;
      height = height ?? dims.height;
    }

    // Create a job to track this generation
    const jobId = uuid();
    const job: GenerationJob = {
      id: jobId,
      status: 'running',
      created_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);

    try {
      console.log(`[image-gen] Generating image: model=${model}, prompt="${prompt.slice(0, 80)}..."`);

      const result = await fal.subscribe(endpoint, {
        input: {
          prompt,
          image_size: { width, height },
        },
      });

      // Extract the image URL from the result
      const data = result.data as Record<string, unknown>;
      const images = data.images as Array<{ url: string; width?: number; height?: number }>;

      if (!images || images.length === 0) {
        throw new Error('Fal.ai returned no images');
      }

      const generatedImage: GeneratedImage = {
        id: uuid(),
        prompt,
        imageUrl: images[0].url,
        width: images[0].width ?? width,
        height: images[0].height ?? height,
        model,
        created_at: new Date().toISOString(),
        project_id: projectId,
      };

      // Store the generated image
      if (!this.images.has(projectId)) {
        this.images.set(projectId, []);
      }
      this.images.get(projectId)!.push(generatedImage);

      // Update job
      job.status = 'completed';
      job.image = generatedImage;

      console.log(`[image-gen] Image generated: ${generatedImage.imageUrl}`);
      return generatedImage;
    } catch (err) {
      job.status = 'failed';
      job.error = (err as Error).message;
      console.error('[image-gen] Generation failed:', (err as Error).message);
      throw err;
    }
  }

  /**
   * Generate an image for a specific segment's content mark.
   * Uses the segment's content_mark.search_query as the prompt.
   */
  async generateForContentMark(
    projectId: string,
    segmentId: string,
    options?: GenerateImageOptions,
  ): Promise<GeneratedImage> {
    // Find the segment and its content mark
    const segments = await listSegments(projectId);
    const segment = segments.find((s) => s.id === segmentId);

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found in project ${projectId}`);
    }

    if (!segment.content_mark) {
      throw new Error(`Segment ${segmentId} has no content mark`);
    }

    const prompt = segment.content_mark.search_query ?? segment.content_mark.asset_type;
    if (!prompt) {
      throw new Error(`Segment ${segmentId} content mark has no search_query or asset_type`);
    }

    // Enhance the prompt with transcript context if available
    let enhancedPrompt = prompt;
    if (segment.transcript) {
      const contextSnippet = segment.transcript.slice(0, 200).trim();
      enhancedPrompt = `${prompt}. Context: ${contextSnippet}`;
    }

    const image = await this.generateImage(projectId, enhancedPrompt, options);
    image.segment_id = segmentId;
    return image;
  }

  /**
   * Get a generation job status.
   */
  getStatus(jobId: string): GenerationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List all generated images for a project.
   */
  listGenerated(projectId: string): GeneratedImage[] {
    return this.images.get(projectId) ?? [];
  }

  /**
   * Get a single generated image by ID.
   */
  getImage(projectId: string, imageId: string): GeneratedImage | undefined {
    const projectImages = this.images.get(projectId) ?? [];
    return projectImages.find((img) => img.id === imageId);
  }
}

// ──────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────

let instance: ImageGenerationService | null = null;

export function getImageGenerationService(): ImageGenerationService {
  if (!instance) {
    instance = new ImageGenerationService();
  }
  return instance;
}
