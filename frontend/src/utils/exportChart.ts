/**
 * exportChart.ts
 *
 * Utility functions for exporting charts and pages to print/PDF format.
 * Provides consistent print styling using design tokens and respects
 * the application's theme system.
 *
 * This module demonstrates:
 * - Print stylesheet integration using design tokens
 * - Chart export functionality for recharts-based components
 * - Theme-aware print output (light mode for print)
 * - Responsive print layouts
 *
 * Usage:
 * ```typescript
 * import { printPage, exportChartToImage } from '../utils/exportChart';
 *
 * // Print current page
 * printPage();
 *
 * // Export a chart element to image
 * const chartElement = document.getElementById('my-chart');
 * if (chartElement) {
 *   exportChartToImage(chartElement, 'payroll-chart.png');
 * }
 * ```
 *
 * Print Stylesheet Pattern:
 * - Uses CSS @media print rules
 * - Forces light theme for print output
 * - Hides interactive elements (buttons, modals, etc.)
 * - Optimizes typography for print readability
 * - Maintains design token consistency
 */

/**
 * Design tokens for print/export styles
 * These mirror the CSS custom properties but are used in JavaScript
 * for dynamic styling during export operations.
 */
export const printTokens = {
  /* Colors - forced light theme for print */
  colors: {
    background: '#ffffff',
    surface: '#f6f8fa',
    surfaceHi: '#f0f2f5',
    border: 'rgba(0, 0, 0, 0.08)',
    borderHi: 'rgba(0, 0, 0, 0.15)',
    text: '#1f2328',
    muted: '#656d76',
    accent: '#0d9668',
    accent2: '#6c5ce7',
    danger: '#d1242f',
    success: '#1a7f37',
  },

  /* Typography */
  typography: {
    fontFamily: {
      head: "'Syne', sans-serif",
      body: "'Inter', sans-serif",
      mono: "'DM Mono', monospace",
    },
    fontSize: {
      xs: '10px',
      sm: '12px',
      base: '14px',
      md: '16px',
      lg: '18px',
      xl: '22px',
      '2xl': '28px',
      '3xl': '36px',
    },
  },

  /* Spacing */
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },

  /* Border Radius */
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '16px',
  },
} as const;

/**
 * Inject print stylesheet into the document
 * This adds CSS rules for print media that:
 * - Force light theme
 * - Hide interactive elements
 * - Optimize layout for print
 */
export function injectPrintStyles(): void {
  const styleId = 'payd-print-styles';

  // Don't inject if already present
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @media print {
      /* Force light theme for print */
      :root, [data-theme="dark"], [data-theme="light"] {
        --bg: ${printTokens.colors.background};
        --surface: ${printTokens.colors.surface};
        --surface-hi: ${printTokens.colors.surfaceHi};
        --border: ${printTokens.colors.border};
        --border-hi: ${printTokens.colors.borderHi};
        --text: ${printTokens.colors.text};
        --muted: ${printTokens.colors.muted};
        --accent: ${printTokens.colors.accent};
        --accent2: ${printTokens.colors.accent2};
        --danger: ${printTokens.colors.danger};
        --success: ${printTokens.colors.success};
        color-scheme: light;
      }

      /* Page setup */
      @page {
        margin: 1cm;
        size: A4;
      }

      /* Hide interactive elements */
      button,
      a[href],
      input,
      select,
      textarea,
      [role="button"],
      .no-print,
      nav,
      header:not(.print-header),
      footer,
      .modal,
      [data-modal],
      .toast,
      [role="alert"],
      .sidebar,
      .topbar {
        display: none !important;
      }

      /* Show print-only elements */
      .print-only {
        display: block !important;
      }

      /* Typography adjustments for print */
      body {
        font-size: 12pt;
        line-height: 1.5;
        color: ${printTokens.colors.text};
        background: ${printTokens.colors.background};
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: ${printTokens.typography.fontFamily.head};
        page-break-after: avoid;
        margin-top: 1em;
        margin-bottom: 0.5em;
      }

      h1 { font-size: 24pt; }
      h2 { font-size: 20pt; }
      h3 { font-size: 16pt; }
      h4 { font-size: 14pt; }

      /* Code blocks */
      code, pre {
        font-family: ${printTokens.typography.fontFamily.mono};
        font-size: 10pt;
        background: ${printTokens.colors.surface};
        border: 1px solid ${printTokens.colors.border};
        border-radius: 4px;
        padding: 2px 4px;
      }

      pre {
        padding: 12px;
        overflow: visible;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      /* Tables */
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 12pt 0;
        font-size: 10pt;
      }

      th, td {
        border: 1px solid ${printTokens.colors.border};
        padding: 6px 12px;
        text-align: left;
      }

      th {
        background: ${printTokens.colors.surface};
        font-weight: 600;
      }

      /* Links */
      a {
        color: ${printTokens.colors.accent};
        text-decoration: underline;
      }

      a[href^="http"]::after {
        content: " (" attr(href) ")";
        font-size: 9pt;
        color: ${printTokens.colors.muted};
      }

      /* Images and charts */
      img, svg {
        max-width: 100%;
        height: auto;
      }

      /* Page breaks */
      .page-break {
        page-break-before: always;
      }

      .no-break {
        page-break-inside: avoid;
      }

      /* Card styling for print */
      .card, [class*="Card"] {
        border: 1px solid ${printTokens.colors.border};
        border-radius: ${printTokens.radius.md};
        padding: 12px;
        margin-bottom: 12px;
        background: ${printTokens.colors.background};
      }

      /* Remove shadows and transforms */
      * {
        box-shadow: none !important;
        transform: none !important;
        text-shadow: none !important;
      }

      /* Ensure proper contrast */
      .text-accent { color: ${printTokens.colors.accent} !important; }
      .text-accent2 { color: ${printTokens.colors.accent2} !important; }
      .text-danger { color: ${printTokens.colors.danger} !important; }
      .text-success { color: ${printTokens.colors.success} !important; }
      .text-muted { color: ${printTokens.colors.muted} !important; }

      /* Background colors for print */
      .bg-accent\/10,
      .bg-accent\/20 {
        background: rgba(13, 150, 104, 0.1) !important;
      }

      /* Status indicators */
      [class*="status"] {
        border: 1px solid currentColor;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9pt;
        text-transform: uppercase;
      }
    }

    /* Print-only header */
    .print-header {
      display: none;
    }

    @media print {
      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        margin-bottom: 24px;
        border-bottom: 2px solid ${printTokens.colors.border};
      }

      .print-header h1 {
        font-size: 18pt;
        margin: 0;
      }

      .print-header .print-date {
        font-size: 10pt;
        color: ${printTokens.colors.muted};
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Remove print stylesheet from the document
 */
export function removePrintStyles(): void {
  const style = document.getElementById('payd-print-styles');
  if (style) {
    style.remove();
  }
}

/**
 * Print the current page
 * Injects print styles, triggers print dialog, then removes styles
 */
export function printPage(): void {
  injectPrintStyles();

  // Small delay to ensure styles are applied
  setTimeout(() => {
    window.print();

    // Remove styles after print dialog closes
    setTimeout(() => {
      removePrintStyles();
    }, 1000);
  }, 100);
}

/**
 * Export a chart element to an image
 * Uses html2canvas to capture the chart and download as PNG
 *
 * @param element - The DOM element containing the chart
 * @param filename - The filename for the downloaded image
 */
export async function exportChartToImage(
  element: HTMLElement,
  filename: string = 'chart.png'
): Promise<void> {
  try {
    // Dynamic import for html2canvas (optional dependency)
    const html2canvas = (await import('html2canvas')).default;

    const canvas = await html2canvas(element, {
      backgroundColor: printTokens.colors.background,
      scale: 2, // High resolution for print
      useCORS: true,
      logging: false,
    });

    // Create download link
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Failed to export chart:', error);
    throw new Error('Chart export failed. Please try again.');
  }
}

/**
 * Export a chart element to PDF
 * Uses html2canvas + jspdf to create a PDF document
 *
 * @param element - The DOM element containing the chart
 * @param filename - The filename for the downloaded PDF
 * @param options - Optional configuration for PDF export
 */
export async function exportChartToPDF(
  element: HTMLElement,
  filename: string = 'chart.pdf',
  options: {
    title?: string;
    orientation?: 'portrait' | 'landscape';
    format?: 'a4' | 'letter';
  } = {}
): Promise<void> {
  try {
    // Dynamic imports for optional dependencies
    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas').then((mod) => mod.default),
      import('jspdf').then((mod) => mod),
    ]);

    const canvas = await html2canvas(element, {
      backgroundColor: printTokens.colors.background,
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Calculate PDF dimensions
    const pdf = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'px',
      format: options.format || [imgWidth, imgHeight],
    });

    // Add title if provided
    if (options.title) {
      pdf.setFontSize(16);
      pdf.text(options.title, 20, 30);
    }

    // Add image
    const yOffset = options.title ? 50 : 0;
    pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);

    // Save PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('PDF export failed. Please try again.');
  }
}

/**
 * Generate a print-friendly HTML string from content
 * Useful for server-side generation or email templates
 *
 * @param content - The HTML content to format
 * @param options - Optional configuration
 * @returns Formatted HTML string ready for print
 */
export function generatePrintHTML(
  content: string,
  options: {
    title?: string;
    includeStyles?: boolean;
    customStyles?: string;
  } = {}
): string {
  const styles = options.includeStyles !== false ? `
    <style>
      body {
        font-family: ${printTokens.typography.fontFamily.body};
        color: ${printTokens.colors.text};
        background: ${printTokens.colors.background};
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: ${printTokens.typography.fontFamily.head};
        color: ${printTokens.colors.text};
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      h1 { font-size: 28px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 20px 0;
      }
      th, td {
        border: 1px solid ${printTokens.colors.border};
        padding: 10px 14px;
        text-align: left;
      }
      th {
        background: ${printTokens.colors.surface};
        font-weight: 600;
      }
      .text-accent { color: ${printTokens.colors.accent}; }
      .text-muted { color: ${printTokens.colors.muted}; }
      @media print {
        body { padding: 0; }
        @page { margin: 1cm; }
      }
    </style>
    ${options.customStyles || ''}
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${options.title || 'PayD Export'}</title>
      ${styles}
    </head>
    <body>
      ${options.title ? `<h1>${options.title}</h1>` : ''}
      ${content}
    </body>
    </html>
  `;
}
