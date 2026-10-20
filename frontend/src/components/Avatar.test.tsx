import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders a gravatar image derived from the email when no imageUrl is given', () => {
    render(<Avatar email="Jane.Doe@Example.com" name="Jane Doe" />);
    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toHaveAttribute('src', expect.stringContaining('gravatar.com/avatar/'));
  });

  it('prefers an explicit imageUrl over the gravatar fallback', () => {
    render(
      <Avatar
        email="jane@example.com"
        name="Jane Doe"
        imageUrl="https://cdn.example.com/jane.png"
      />
    );
    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/jane.png');
  });

  it('uses the name as the title/tooltip for accessibility', () => {
    const { container } = render(<Avatar email="jane@example.com" name="Jane Doe" />);
    expect(container.querySelector('[title="Jane Doe"]')).not.toBeNull();
  });

  it('defaults the name to "User" when none is provided', () => {
    render(<Avatar email="jane@example.com" />);
    expect(screen.getByRole('img', { name: 'User' })).toBeInTheDocument();
  });
});
