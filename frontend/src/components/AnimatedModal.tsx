import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AnimatedModal
 *
 * A standardized modal wrapper that provides consistent enter/exit animations
 * across the application. Uses framer-motion for smooth transitions and
 * respects prefers-reduced-motion for accessibility.
 *
 * Usage:
 * ```tsx
 * <AnimatedModal isOpen={showModal} onClose={() => setShowModal(false)}>
 *   <div className="p-6">Modal content</div>
 * </AnimatedModal>
 * ```
 *
 * Animation Pattern:
 * - Backdrop: fades in/out (opacity 0 → 1)
 * - Content: scales up from 95% with subtle Y translation (translateY(8px) → 0)
 * - Duration: 200ms enter, 150ms exit
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1) for natural feel
 *
 * Accessibility:
 * - Respects prefers-reduced-motion media query
 * - Traps focus within modal when open
 * - Closes on Escape key
 * - Closes on backdrop click (unless disableBackdropClose is set)
 */

interface AnimatedModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Additional CSS classes for the content container */
  className?: string;
  /** Disable closing on backdrop click */
  disableBackdropClose?: boolean;
  /** Maximum width of the modal content */
  maxWidth?: string;
  /** Whether the modal is in a loading/executing state (prevents close) */
  isProcessing?: boolean;
}

/**
 * Hook to detect prefers-reduced-motion preference
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = React.useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

/**
 * Animation variants for framer-motion
 */
function getAnimationVariants(prefersReduced: boolean) {
  if (prefersReduced) {
    return {
      backdrop: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      },
      content: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      },
    };
  }

  return {
    backdrop: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    },
    content: {
      initial: { opacity: 0, scale: 0.95, y: 8 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 8 },
      transition: {
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.05,
      },
    },
  };
}

export default function AnimatedModal({
  isOpen,
  onClose,
  children,
  className = '',
  disableBackdropClose = false,
  maxWidth = 'max-w-2xl',
  isProcessing = false,
}: AnimatedModalProps) {
  const prefersReduced = usePrefersReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isProcessing]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const variants = getAnimationVariants(prefersReduced);

  function handleBackdropClick() {
    if (!disableBackdropClose && !isProcessing) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={variants.backdrop.initial}
          animate={variants.backdrop.animate}
          exit={variants.backdrop.exit}
          transition={prefersReduced ? { duration: 0 } : variants.backdrop.transition}
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Content */}
          <motion.div
            ref={contentRef}
            className={`relative w-full ${maxWidth} bg-[var(--surface)] border border-[var(--border-hi)] rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col ${className}`}
            initial={variants.content.initial}
            animate={variants.content.animate}
            exit={variants.content.exit}
            transition={prefersReduced ? { duration: 0 } : variants.content.transition}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
