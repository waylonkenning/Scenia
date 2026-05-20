import { toJpeg, toPng } from 'html-to-image';
import jsPDF from 'jspdf';

const EXPORT_LIMITS = {
  maxWidth: 16384,
  maxHeight: 16384,
  maxPixels: 50_000_000,
};

const assertSafeExportSize = (
  width: number,
  height: number,
  pixelRatio: number,
  exportType: 'PDF' | 'PNG'
) => {
  const safeWidth = Math.floor(width);
  const safeHeight = Math.floor(height);
  const effectivePixels = safeWidth * safeHeight * pixelRatio * pixelRatio;

  if (
    safeWidth <= 0 ||
    safeHeight <= 0 ||
    safeWidth > EXPORT_LIMITS.maxWidth ||
    safeHeight > EXPORT_LIMITS.maxHeight ||
    effectivePixels > EXPORT_LIMITS.maxPixels
  ) {
    throw new Error(
      `${exportType} export is too large for safe image generation. Reduce timeline range or row count and try again.`
    );
  }
};

/**
 * Exports the timeline element as a PDF file download.
 *
 * Captures at 1.5× pixel ratio using high-quality JPEG (0.92) — sharp
 * enough to be indistinguishable from lossless at normal zoom, while
 * keeping the file to a reasonable size (typically 3–6 MB).
 *
 * The original quality-0.8 setting caused visible blocking/ringing on
 * text edges; 0.92 eliminates those artefacts in practice.
 */
export const exportToPDF = async (elementId: string, filename: string = 'roadmap.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  const scrollableArea = (element.querySelector('.overflow-auto') as HTMLElement) || element;

  // The legend lives outside the scrollable area (sibling div). Ensure it is
  // expanded, then clone it into the scrollable content so it appears at the
  // bottom-right corner of the captured image.
  const legendEl = element.querySelector('[data-testid="timeline-legend"]') as HTMLElement | null;
  const legendToggle = legendEl?.querySelector('[data-testid="legend-toggle"]') as HTMLButtonElement | null;
  const legendWasCollapsed = !!legendEl && !legendEl.querySelector('[data-testid="legend-content"]');

  if (legendWasCollapsed && legendToggle) {
    legendToggle.click();
    await new Promise(resolve => setTimeout(resolve, 150)); // wait for React re-render
  }

  // Clone the (now-expanded) legend into the scrollable content for capture.
  let legendClone: HTMLElement | null = null;
  if (legendEl) {
    legendClone = legendEl.cloneNode(true) as HTMLElement;
    legendClone.style.position = 'absolute';
    legendClone.style.bottom = '12px';
    legendClone.style.right = '12px';
    legendClone.style.zIndex = '40';
    legendClone.style.maxWidth = '220px';
    const contentDiv = (scrollableArea.querySelector(':scope > div') as HTMLElement) || scrollableArea;
    contentDiv.appendChild(legendClone);
  }

  const width = scrollableArea.scrollWidth;
  const height = scrollableArea.scrollHeight;
  assertSafeExportSize(width, height, 1.5, 'PDF');

  const dataUrl = await toJpeg(scrollableArea, {
    quality: 0.92,
    pixelRatio: 1.5,
    backgroundColor: '#ffffff',
    width,
    height,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
      width: width + 'px',
      height: height + 'px',
      overflow: 'visible',
    },
  });

  // Remove the legend clone now that capture is done.
  if (legendClone && legendClone.parentNode) {
    legendClone.parentNode.removeChild(legendClone);
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a2',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => { img.onload = resolve; });

  let finalWidth = pdfWidth;
  let finalHeight = (img.height * pdfWidth) / img.width;

  if (finalHeight > pdfHeight) {
    finalHeight = pdfHeight;
    finalWidth = (img.width * pdfHeight) / img.height;
  }

  const x = (pdfWidth - finalWidth) / 2;

  pdf.addImage(dataUrl, 'JPEG', x, 0, finalWidth, finalHeight, undefined, 'FAST');
  pdf.save(filename);

  // Restore legend to collapsed state if we expanded it
  if (legendWasCollapsed && legendToggle) {
    legendToggle.click();
  }
};

/**
 * Exports the timeline element as a PNG file download.
 * Starts at 1× pixel ratio and steps down by 0.25 until the file is ≤ 2MB.
 */
export const exportToPNG = async (elementId: string, filename: string = 'roadmap.png') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  const scrollableArea = (element.querySelector('.overflow-auto') as HTMLElement) || element;
  const MAX_BYTES = 2 * 1024 * 1024;
  const width = scrollableArea.scrollWidth;
  const height = scrollableArea.scrollHeight;

  let dataUrl = '';
  for (let pixelRatio = 1.0; pixelRatio > 0; pixelRatio -= 0.25) {
    assertSafeExportSize(width, height, pixelRatio, 'PNG');

    dataUrl = await toPng(scrollableArea, {
      backgroundColor: '#ffffff',
      pixelRatio,
      width,
      height,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
        width: width + 'px',
        height: height + 'px',
        overflow: 'visible',
      },
    });
    if (atob(dataUrl.split(',')[1]).length <= MAX_BYTES) break;
  }

  // Convert data URL to blob URL — Chrome blocks large data URL downloads.
  const bstr = atob(dataUrl.split(',')[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  const blob = new Blob([u8arr], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};
