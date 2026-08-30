import {
  lineStatusBadgeStatus,
  splitLineStatusFragment,
} from '../splitLineStatusFragment';

describe('splitLineStatusFragment', () => {
  it('splits an em-dash late / not-started suffix', () => {
    expect(splitLineStatusFragment('L-Shape Sofa — LATE not started')).toEqual({
      text: 'L-Shape Sofa',
      fragment: 'LATE not started',
    });
  });

  it('treats a bare status string as the fragment', () => {
    expect(splitLineStatusFragment('LATE not started')).toEqual({
      text: '',
      fragment: 'LATE not started',
    });
    expect(splitLineStatusFragment('not started')).toEqual({
      text: '',
      fragment: 'not started',
    });
  });

  it('leaves ordinary product names alone', () => {
    expect(splitLineStatusFragment('L-Shape Sofa')).toEqual({
      text: 'L-Shape Sofa',
      fragment: null,
    });
  });

  it('maps late copy to LATE and not-started to NOT_STARTED', () => {
    expect(lineStatusBadgeStatus('LATE not started')).toBe('LATE');
    expect(lineStatusBadgeStatus('not started')).toBe('NOT_STARTED');
  });
});
