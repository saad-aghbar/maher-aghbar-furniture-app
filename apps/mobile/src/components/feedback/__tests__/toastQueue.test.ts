import {
  dismissToast,
  enqueueToast,
  peekToast,
} from '../toastQueue';

describe('toastQueue', () => {
  it('enqueues and peeks FIFO', () => {
    let q = enqueueToast([], { message: 'a', variant: 'info' });
    q = enqueueToast(q, { message: 'b', variant: 'error' });
    expect(peekToast(q)?.message).toBe('a');
    expect(q).toHaveLength(2);
  });

  it('dismisses by id', () => {
    let q = enqueueToast([], { message: 'a' });
    const id = q[0]!.id;
    q = enqueueToast(q, { message: 'b' });
    q = dismissToast(q, id);
    expect(peekToast(q)?.message).toBe('b');
    expect(q).toHaveLength(1);
  });
});
