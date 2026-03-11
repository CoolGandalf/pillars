'use client';

import { toPng } from 'html-to-image';

export async function exportShareCard(elementId = 'share-card'): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const el = document.getElementById(elementId);
  if (!el) return null;

  try {
    const dataUrl = await toPng(el, {
      quality: 0.95,
      pixelRatio: 2,
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to export share card:', err);
    return null;
  }
}

export async function downloadShareCard(filename = 'my-pillars.png'): Promise<boolean> {
  const dataUrl = await exportShareCard();
  if (!dataUrl) return false;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
  return true;
}

export async function shareOrDownload(text: string, title = 'My Pillars'): Promise<void> {
  const dataUrl = await exportShareCard();

  // Try native share (mobile)
  if (navigator.share && dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'pillars.png', { type: 'image/png' });
      await navigator.share({ title, text, files: [file] });
      return;
    } catch {
      // Fall through to download
    }
  }

  // Fall back to download
  if (dataUrl) {
    const link = document.createElement('a');
    link.download = 'my-pillars.png';
    link.href = dataUrl;
    link.click();
  }
}

export function buildShareText(value1Name: string, value2Name: string): string {
  return `My Pillars right now: ${value1Name} + ${value2Name}\n\nThe two values I protected most when tradeoffs got real.`;
}
