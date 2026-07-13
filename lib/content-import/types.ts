export type ImportedContentType = 'mcq' | 'flashcards' | 'vignettes';
export type ImportCleanupMode = 'parse_only' | 'parse_structure' | 'structure_improve' | 'structure_improve_review';

export interface ParsedImportItem {
  id: string;
  contentType: ImportedContentType;
  originalText: string;
  confidence: number;
  include: boolean;
  validationErrors: string[];
  missingFields: string[];
  fields: Record<string, any>;
}

export interface ImportParseResult {
  text: string;
  warnings: string[];
}

export interface ImportBlueprintMapping {
  examTrackId: string;
  topicId: string;
  subtopicId?: string | null;
  socialWorkBlueprintItemId?: string | null;
  blueprintContentArea?: string | null;
  blueprintCompetencySection?: string | null;
  appliedKnowledgeStatement?: string | null;
  questionWritingGuideline?: string | null;
  blueprintReferenceText?: string | null;
  learningObjective?: string | null;
  difficulty?: 'medium' | 'hard';
  cognitiveLevel?: string | null;
}
