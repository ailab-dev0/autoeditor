/**
 * Export service — generates various export formats from edit packages.
 */

import type { EditPackageV3, Segment, ExportFormat } from '../types/index.js';
import { toCSV, toEDL, toFCPXML, toPremiereXML, toJSON } from '../utils/export-formats.js';

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  contentType: string;
  data: string;
}

/**
 * Generate an export in the requested format.
 */
export function generateExport(
  editPackage: EditPackageV3,
  format: ExportFormat,
  fps: number = 24
): ExportResult {
  const projectName = editPackage.project_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const allSegments = editPackage.videos.flatMap((v) => v.segments);
  const metadata = {
    projectName: editPackage.project_name,
    fps,
    sessionId: editPackage.pipeline_session_id,
  };

  switch (format) {
    case 'csv': {
      return {
        format: 'csv',
        filename: `${projectName}_segments.csv`,
        contentType: 'text/csv',
        data: toCSV(allSegments),
      };
    }
    case 'edl': {
      return {
        format: 'edl',
        filename: `${projectName}.edl`,
        contentType: 'text/plain',
        data: toEDL(allSegments, fps),
      };
    }
    case 'fcpxml': {
      return {
        format: 'fcpxml',
        filename: `${projectName}.fcpxml`,
        contentType: 'application/xml',
        data: toFCPXML(allSegments, metadata),
      };
    }
    case 'premiere_xml': {
      return {
        format: 'premiere_xml',
        filename: `${projectName}_premiere.xml`,
        contentType: 'application/xml',
        data: toPremiereXML(allSegments, metadata),
      };
    }
    case 'json': {
      return {
        format: 'json',
        filename: `${projectName}_edit_package.json`,
        contentType: 'application/json',
        data: toJSON(editPackage),
      };
    }
    default: {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
