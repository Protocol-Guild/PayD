import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountdownTimer } from './CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when targetDate is null', () => {
    const { container } = render(<CountdownTimer targetDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts down the remaining time toward the target date', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(now);
    // Distinct day/hour/minute values, and a second offset well clear of any
    // of them, so a single tick can't make two fields collide on display.
    const target = new Date(now.getTime() + (1 * 24 * 60 * 60 + 5 * 60 * 60 + 9 * 60 + 30) * 1000);

    render(<CountdownTimer targetDate={target} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('1')).toBeInTheDocument(); // days
    expect(screen.getByText('05')).toBeInTheDocument(); // hours
    expect(screen.getByText('09')).toBeInTheDocument(); // minutes
  });

  it('shows all zeros once the target date has passed', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(now);
    const target = new Date(now.getTime() + 1000);

    render(<CountdownTimer targetDate={target} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByText('00').length).toBeGreaterThan(0);
  });
});
