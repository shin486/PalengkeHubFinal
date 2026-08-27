// src/theme/customerTheme.js
// Canonical design-tokens for the Customer module.
//
// Every export except `customerGradients` was a private copy of
// colors/spacing/radius/typography now owned by tokens.js and consumed via
// ThemeContext's useColors(). The only live consumer of this file,
// ModernButton.js, is itself imported by nothing in src/ — kept alive here
// so nothing regresses, not deleted or fixed in this phase.
//
// Usage:
//   import { customerGradients } from '../theme/customerTheme';

import { COLORS } from './tokens';

// ============================================================
// Gradient pairs (theme-aware primary)
// ============================================================
export const customerGradients = {
  primary: [COLORS.light.primary, COLORS.light.primaryLight],
  success: [COLORS.light.success, COLORS.light.successFill],
  warning: [COLORS.light.warning, COLORS.light.warningFill],
  info: [COLORS.light.info, COLORS.light.infoFill],
  danger: [COLORS.light.errorFill, COLORS.light.error],
  // Not a brand color — matches the Google Maps route-green convention,
  // same reasoning as why `gcash` doesn't change.
  map: ['#4CAF50', '#45A049'],
};
