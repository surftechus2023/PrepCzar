ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS applied_knowledge_statement text;

ALTER TABLE case_vignettes
  ADD COLUMN IF NOT EXISTS applied_knowledge_statement text;

UPDATE flashcards
SET applied_knowledge_statement = learning_objective
WHERE applied_knowledge_statement IS NULL
  AND learning_objective IS NOT NULL;

UPDATE case_vignettes
SET applied_knowledge_statement = learning_objective
WHERE applied_knowledge_statement IS NULL
  AND learning_objective IS NOT NULL;
