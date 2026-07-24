UPDATE flashcards
SET back_en = btrim(regexp_replace(back_en, '\s*(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:).*$', '', 'i'))
WHERE back_en ~* '(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:)';

UPDATE flashcards
SET back_es = btrim(regexp_replace(back_es, '\s*(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:).*$', '', 'i'))
WHERE back_es ~* '(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:)';

UPDATE flashcards
SET back_fr = btrim(regexp_replace(back_fr, '\s*(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:).*$', '', 'i'))
WHERE back_fr ~* '(Rationale:|Best answer:|Other options[^.]*:|Blueprint linkage:|Topic/Subtopic:|Applied knowledge statement:|Difficulty:|Cognitive level:|Blueprint reference:)';
