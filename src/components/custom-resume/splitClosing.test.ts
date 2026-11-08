import { describe, it, expect } from 'vitest';
import { splitClosing } from './splitClosing';

describe('splitClosing', () => {
  it('splits a sign-off and name glued onto the last sentence', () => {
    expect(
      splitClosing('Ik vertel graag in een gesprek meer over hoe ik dit voor DHD kan oppakken. Groet, Noor Bakker', 'Noor Bakker'),
    ).toEqual({ text: 'Ik vertel graag in een gesprek meer over hoe ik dit voor DHD kan oppakken.', signOff: 'Groet,' });
  });

  it('handles a multi-word sign-off on a new line', () => {
    expect(splitClosing('I would welcome a conversation.\nKind regards,', 'Noor Bakker')).toEqual({
      text: 'I would welcome a conversation.',
      signOff: 'Kind regards,',
    });
  });

  it('prefers the longest Dutch phrase', () => {
    expect(splitClosing('Graag tot ziens. Met vriendelijke groet, Noor Bakker', 'Noor Bakker').signOff).toBe(
      'Met vriendelijke groet,',
    );
  });

  it('leaves a normal closing alone', () => {
    expect(splitClosing('I look forward to hearing from you.', 'Noor Bakker')).toEqual({
      text: 'I look forward to hearing from you.',
      signOff: null,
    });
  });

  it('does not cut "regards" from inside a sentence', () => {
    const s = 'My manager regards this as my best work.';
    expect(splitClosing(s, 'Noor').text).toBe(s);
  });

  it('copes with empty input', () => {
    expect(splitClosing(undefined, 'X')).toEqual({ text: '', signOff: null });
  });
});
