import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchVoiceAnswer, normalizeVoiceTranscript } from '../lib/voice-answer.js';

describe('voice answer matching', () => {
  it('normalizes punctuation, case, accents, and whitespace', () => {
    assert.equal(normalizeVoiceTranscript('  Réponse:  B!!  '), 'reponse b');
  });

  it('maps A/B/C/D and option phrases', () => {
    assert.equal(matchVoiceAnswer('A').option, 'a');
    assert.equal(matchVoiceAnswer('Option B').option, 'b');
    assert.equal(matchVoiceAnswer('answer C').option, 'c');
    assert.equal(matchVoiceAnswer('choice D').option, 'd');
  });

  it('maps first second third fourth phrasing', () => {
    assert.equal(matchVoiceAnswer('the first option').option, 'a');
    assert.equal(matchVoiceAnswer('second').option, 'b');
    assert.equal(matchVoiceAnswer('third answer').option, 'c');
    assert.equal(matchVoiceAnswer('fourth').option, 'd');
  });

  it('maps practical Spanish and French equivalents', () => {
    assert.equal(matchVoiceAnswer('primera opción').option, 'a');
    assert.equal(matchVoiceAnswer('segunda').option, 'b');
    assert.equal(matchVoiceAnswer('troisième réponse').option, 'c');
    assert.equal(matchVoiceAnswer('quatrième').option, 'd');
  });

  it('matches exact or partial answer text', () => {
    const options = {
      a: 'Assessment before intervention',
      b: 'Immediate termination',
      c: 'Prescribe medication',
      d: 'Ignore the disclosure',
    };

    assert.equal(matchVoiceAnswer('assessment before intervention', options).option, 'a');
    assert.equal(matchVoiceAnswer('immediate termination', options).option, 'b');
  });

  it('does not auto-submit ambiguous answer text', () => {
    const result = matchVoiceAnswer('assessment', {
      a: 'Assessment before intervention',
      b: 'Assessment after termination',
      c: 'Referral only',
      d: 'Documentation only',
    });

    assert.equal(result.option, null);
    assert.equal(result.ambiguous, true);
    assert.equal(result.suggestedOption, 'a');
  });
});
