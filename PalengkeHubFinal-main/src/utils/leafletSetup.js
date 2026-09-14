// src/utils/leafletSetup.js
// Shared bootstrap for every web Leaflet map in the app (StallLocationMap.web.js,
// MarketMapView.web.js). Leaflet's CSS and default marker icons are pulled from
// unpkg at runtime rather than imported as local modules — Metro (Expo's web
// bundler) doesn't resolve npm-package CSS imports or PNG-as-URL the way
// webpack does, and this sidesteps that entirely. Kept in one place so the
// pinned Leaflet version can't drift between callers.
import L from 'leaflet';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_ASSETS_PATH = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/`;

let iconConfigured = false;
export function ensureDefaultIcon() {
  if (iconConfigured) return;
  iconConfigured = true;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: `${LEAFLET_ASSETS_PATH}marker-icon.png`,
    iconRetinaUrl: `${LEAFLET_ASSETS_PATH}marker-icon-2x.png`,
    shadowUrl: `${LEAFLET_ASSETS_PATH}marker-shadow.png`,
  });
}

export function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}
