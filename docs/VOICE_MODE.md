# Voice Mode

Voice mode uses browser speech features where available. It is an accessibility and convenience feature, not a safety feature.

## Capabilities

- Reads MCQ stems and answer options with browser speech synthesis.
- Captures spoken A/B/C/D answers when speech recognition is available.
- Announces correct or incorrect feedback and rationale.
- Falls back to manual buttons when recognition is unavailable.

## Limitations

- Browser support varies by device and browser.
- Speech recognition may be unavailable even when speech synthesis works.
- Voice mode must not be positioned as safe for active driving.

## QA Checklist

- Enable voice mode in a browser with speech synthesis and recognition.
- Confirm question reading works.
- Speak `A`, `B`, `C`, or `D` and confirm the answer is selected.
- Test a browser without recognition and confirm manual fallback appears.
- Confirm language-specific reading uses English, Spanish, or French voice locale where available.
