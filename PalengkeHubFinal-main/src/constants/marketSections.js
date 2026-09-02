// src/constants/marketSections.js
// The one canonical list of market stall sections. Previously hardcoded
// independently in SignUpScreen.js (10 entries) and duplicated in both
// CheckoutScreen.js and OrdersScreen.js as a map-coordinate lookup that only
// covered 6 of the 10 — a stall in "Rice Section", "Condiments Section",
// "Frozen Goods" or "Beverages Section" fell through to a {lat:0,lng:0}
// offset, clustering it with every other unlisted section on the map
// instead of its own area.
export const STALL_SECTIONS = [
  'Meat Section',
  'Vegetable Section',
  'Fish Section',
  'Fruit Section',
  'Dry Goods',
  'Poultry Section',
  'Rice Section',
  'Condiments Section',
  'Frozen Goods',
  'Beverages Section',
];

// Offsets (in degrees) from the market's base coordinate, one per section,
// used to spread each section's stalls into a distinct area on the map.
export const SECTION_MAP_OFFSETS = {
  'Meat Section': { lat: 0.0008, lng: -0.0012 },
  'Vegetable Section': { lat: 0.0002, lng: -0.0008 },
  'Fish Section': { lat: -0.0003, lng: 0.0005 },
  'Fruit Section': { lat: 0.0005, lng: 0.0002 },
  'Dry Goods': { lat: -0.0001, lng: -0.0015 },
  'Poultry Section': { lat: 0.0010, lng: -0.0005 },
  'Rice Section': { lat: -0.0006, lng: 0.0010 },
  'Condiments Section': { lat: 0.0003, lng: 0.0012 },
  'Frozen Goods': { lat: -0.0008, lng: -0.0006 },
  'Beverages Section': { lat: 0.0007, lng: 0.0008 },
};

// A handful of existing stalls were seeded directly in the database with
// section names missing the " Section" suffix ("Condiments", "Beverages")
// instead of matching the signup dropdown's canonical values — this lets
// the coordinate lookup still resolve those instead of silently defaulting
// to {lat:0,lng:0}. New stalls should always go through STALL_SECTIONS.
export const getSectionMapOffset = (section) => {
  if (!section) return { lat: 0, lng: 0 };
  if (SECTION_MAP_OFFSETS[section]) return SECTION_MAP_OFFSETS[section];
  const withSuffix = `${section} Section`;
  if (SECTION_MAP_OFFSETS[withSuffix]) return SECTION_MAP_OFFSETS[withSuffix];
  const withoutSuffix = section.replace(/ Section$/i, '');
  const matchKey = Object.keys(SECTION_MAP_OFFSETS).find(
    (key) => key.replace(/ Section$/i, '').toLowerCase() === withoutSuffix.toLowerCase()
  );
  return matchKey ? SECTION_MAP_OFFSETS[matchKey] : { lat: 0, lng: 0 };
};
