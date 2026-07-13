# Content Import

PrepCzar supports admin-only content import for MCQs, flashcards, and case vignettes. Imported items are stored as inactive drafts and are not visible to students until reviewed and published.

## Supported Inputs

- PDF
- DOCX
- TXT
- CSV
- Pasted text

Files are parsed server-side. Uploaded material is not exposed publicly. The current implementation parses directly from the request and stores only the original extracted text on imported draft rows for audit.

## Workflow

1. Open `Admin > Content Import`.
2. Select exam category, exam track, topic/domain, optional subtopic, and optional Social Work applied knowledge statement.
3. Select content type: MCQs, flashcards, or case vignettes.
4. Upload a file or paste text.
5. Select cleanup mode.
6. Parse preview.
7. Edit extracted fields and include/exclude items.
8. Import selected items.
9. Optionally run integrity review for imported MCQs.
10. Review and publish through the normal admin review flow.

## File Safety

The import API validates:

- File extension
- MIME type
- Empty files
- Maximum size, currently 8 MB
- Executable extensions
- Basic PDF/DOCX structure

Rejected extensions include executable and script-like files such as `.exe`, `.dll`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.js`, `.msi`, `.com`, and `.scr`.

## Source Formats

MCQ text:

```text
Question: A client asks...
A. Option one
B. Option two
C. Option three
D. Option four
Answer: B
Rationale: Explanation...
```

Flashcard text:

```text
Front: Key concept?
Back: Complete answer.
```

Case vignette text:

```text
Case: Scenario...
Prompt: What should the clinician do?
Ideal answer: Expected response...
Coaching feedback: Feedback...
```

CSV imports should use clear headers such as `question`, `option_a`, `option_b`, `option_c`, `option_d`, `answer`, `rationale`, `front`, `back`, `case`, `prompt`, `ideal_answer`, and `coaching_feedback`.

## Defaults

Imported content defaults to:

- `reviewed = false`
- `active = false`
- `integrity_status = pending` for MCQs
- `generated_by_ai = false`
- `import_batch_id`, `source_filename`, and `original_import_text` stored when available

## Test With TXT First

Before testing PDF parsing, create a small `.txt` file with one MCQ in the format above. Import it, verify parsed fields in preview, import selected, then confirm the draft appears in admin review.
