// Share a product via native share sheet (phone) or Web Share API /
// clipboard (browser). Lets families send products to each other via
// Messenger, Facebook, etc.
import { Platform, Share as RNShare } from 'react-native';

export const shareProduct = async ({ name, price, unit, stallName, stallNumber, onCopied }) => {
  const unitText = unit ? `/${unit}` : '';
  const stallText = stallName
    ? `sa ${stallName}${stallNumber ? ` (#${stallNumber})` : ''}`
    : stallNumber
      ? `sa Stall #${stallNumber}`
      : '';
  const message = `${name} — ₱${price}${unitText} ${stallText} | PalengkeHub — Lipa City Public Market`;

  if (Platform.OS === 'web') {
    // Web Share API (works on mobile browsers and localhost)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'PalengkeHub', text: message });
        return { ok: true, method: 'native' };
      } catch (e) {
        // user cancelled — fall through to clipboard
        if (e && e.name === 'AbortError') return { ok: false, method: 'cancelled' };
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        if (onCopied) onCopied();
        return { ok: true, method: 'clipboard' };
      } catch (e) {
        return { ok: false, method: 'error' };
      }
    }
    return { ok: false, method: 'unsupported' };
  }

  try {
    await RNShare.share({ message, title: 'PalengkeHub' });
    return { ok: true, method: 'native' };
  } catch (e) {
    return { ok: false, method: 'cancelled' };
  }
};
