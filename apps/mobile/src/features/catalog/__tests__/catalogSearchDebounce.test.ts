import { CATALOG_SEARCH_DEBOUNCE_MS } from '../catalogSearchDebounce';

describe('catalog search debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses a 300ms debounce window', () => {
    expect(CATALOG_SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('settles after 300ms and resets when input changes', () => {
    let settled = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    const push = (next: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        settled = next;
      }, CATALOG_SEARCH_DEBOUNCE_MS);
    };

    push('sofa');
    jest.advanceTimersByTime(CATALOG_SEARCH_DEBOUNCE_MS - 1);
    expect(settled).toBe('');

    jest.advanceTimersByTime(1);
    expect(settled).toBe('sofa');

    push('sofabed');
    jest.advanceTimersByTime(200);
    push('sofabeds');
    jest.advanceTimersByTime(200);
    expect(settled).toBe('sofa');
    jest.advanceTimersByTime(100);
    expect(settled).toBe('sofabeds');
  });
});
