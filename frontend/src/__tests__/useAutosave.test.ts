import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../hooks/useAutosave';

describe('useAutosave', () => {
  const TEST_KEY = 'test:autosave:key';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves data to localStorage after the debounce delay', async () => {
    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, 'hello', 500));

    // Initially not saving
    expect(result.current.saving).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.saving).toBe(false);
    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('hello'));
    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });

  it('does not save before the debounce delay elapses', () => {
    renderHook(() => useAutosave<string>(TEST_KEY, 'pending', 500));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('re-saves when data changes', async () => {
    const { rerender } = renderHook(({ value }) => useAutosave<string>(TEST_KEY, value, 500), {
      initialProps: { value: 'first' },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('first'));

    rerender({ value: 'second' });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('second'));
  });

  it('handles localStorage write errors gracefully', async () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemMock = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    Storage.prototype.setItem = setItemMock;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, 'data', 500));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.lastSaved).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error autosaving data'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
    Storage.prototype.setItem = originalSetItem;
  });

  it('cancels the pending save when unmounted before the delay', () => {
    const { unmount } = renderHook(() => useAutosave<string>(TEST_KEY, 'gone', 500));

    act(() => {
      unmount();
      vi.advanceTimersByTime(1000);
    });

    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('loads saved data from localStorage via loadSavedData', () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ name: 'Alice' }));

    const { result } = renderHook(() => useAutosave<{ name: string }>(TEST_KEY, null as unknown as { name: string }));

    expect(result.current.loadSavedData()).toEqual({ name: 'Alice' });
  });

  it('returns null from loadSavedData when no saved data exists', () => {
    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, ''));

    expect(result.current.loadSavedData()).toBeNull();
  });

  it('returns null from loadSavedData on parse errors', () => {
    localStorage.setItem(TEST_KEY, '{invalid-json');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, ''));

    expect(result.current.loadSavedData()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error loading autosave data'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('clears saved data with clearSavedData', async () => {
    localStorage.setItem(TEST_KEY, JSON.stringify('value'));
    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, 'value', 500));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(TEST_KEY)).not.toBeNull();

    act(() => {
      result.current.clearSavedData();
    });

    expect(localStorage.getItem(TEST_KEY)).toBeNull();
    expect(result.current.lastSaved).toBeNull();
  });

  it('uses the default debounce delay of 1000ms', async () => {
    const { result } = renderHook(() => useAutosave<string>(TEST_KEY, 'default-delay'));

    expect(result.current.saving).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(localStorage.getItem(TEST_KEY)).toBe(JSON.stringify('default-delay'));
    expect(result.current.saving).toBe(false);
  });
});