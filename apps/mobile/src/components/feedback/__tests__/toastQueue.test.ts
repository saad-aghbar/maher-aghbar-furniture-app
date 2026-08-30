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

  it('never enqueues persist / dehydrate internals', () => {
    const q = enqueueToast([], {
      message:
        'A query that was dehydrated as pending ended up rejecting. [["catalog","list"]]',
      variant: 'error',
    });
    expect(q).toHaveLength(0);
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
