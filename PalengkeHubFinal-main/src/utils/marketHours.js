// src/utils/marketHours.js
// Matches the market's posted hours ("Open 5:00 AM to 7:00 PM") shown
// elsewhere in the app — a pickup slot outside this window means the
// stall isn't even open. Previously defined independently in
// CheckoutContent.js only; CheckoutScreen.js (a separate, near-duplicate
// checkout implementation) had no equivalent check at all, so a pickup
// time picked there could land at 2 AM with only a "must be 15+ min from
// now" check applied.
export const MARKET_OPEN_HOUR = 5;
export const MARKET_CLOSE_HOUR = 19; // 7:00 PM, exclusive

// Nudges a candidate pickup date/time so it always lands inside market
// hours and, if it's today, no earlier than a few minutes from now. The
// native date/time pickers have no concept of "business hours" or "not in
// the past" — @react-native-community/datetimepicker's minimumDate only
// constrains the date picker, not the time picker — so that has to be
// enforced here instead of trusted from the picker.
export const clampPickupTime = (candidate) => {
  const now = new Date();
  const result = new Date(candidate);
  result.setSeconds(0, 0);

  if (result.toDateString() === now.toDateString()) {
    const earliest = new Date(now.getTime() + 15 * 60 * 1000); // 15-min prep buffer
    if (result < earliest) result.setTime(earliest.getTime());
  }

  if (result.getHours() < MARKET_OPEN_HOUR) {
    result.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  } else if (result.getHours() >= MARKET_CLOSE_HOUR) {
    // Past closing (or bumped past it by the "not in the past" nudge
    // above) — roll to opening time the next day rather than accepting
    // a pickup slot the market won't be open for.
    result.setDate(result.getDate() + 1);
    result.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  }

  return result;
};

export const isOutsideMarketHours = (date) =>
  date.getHours() < MARKET_OPEN_HOUR || date.getHours() >= MARKET_CLOSE_HOUR;
