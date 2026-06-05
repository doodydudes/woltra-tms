// Robust clipboard copy with a fallback for contexts where the async
// Clipboard API is unavailable or blocked (some mobile/in-app browsers,
// non-secure contexts, etc.). Returns true on success.
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;

  // Preferred: async Clipboard API (needs a secure context + permission)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy method
  }

  // Fallback: hidden textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
