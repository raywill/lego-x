export interface ShareDetails {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled';

function copyWithFallback(text: string, errorMessage: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error(errorMessage);
}

export async function copyShareLink(url: string, errorMessage = 'Unable to copy link'): Promise<void> {
  const absoluteUrl = new URL(url, window.location.origin).toString();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(absoluteUrl);
    return;
  }
  copyWithFallback(absoluteUrl, errorMessage);
}

export async function shareLink(details: ShareDetails, copyErrorMessage = 'Unable to copy link'): Promise<ShareResult> {
  const payload = { ...details, url: new URL(details.url, window.location.origin).toString() };
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  await copyShareLink(payload.url, copyErrorMessage);
  return 'copied';
}
