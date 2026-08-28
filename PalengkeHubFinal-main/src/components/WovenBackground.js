// src/components/WovenBackground.js
// The faint basket-weave crosshatch behind the paper background, pulled
// straight from the reference design system's page background:
//   repeating-linear-gradient(45deg,  ink 0.03  0px 2px, transparent 2px 9px),
//   repeating-linear-gradient(-45deg, ink 0.027 0px 2px, transparent 2px 9px)
// React Native has no repeating-linear-gradient, so this is the same two
// diagonal stripe layers redrawn as SVG line patterns instead. Built with
// plain diagonal <Path>s rather than patternTransform="rotate(...)" —
// react-native-svg's web renderer silently drops patternTransform, so a
// rotated pattern never painted anything there even though the DOM looked
// correct.

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';

const TILE = 9;
const HALF = TILE / 2;
const STROKE = 2;

export const WovenBackground = ({ isDark = false }) => {
  const inkA = isDark ? 'rgba(245, 231, 213, 0.05)' : 'rgba(38, 16, 6, 0.03)';
  const inkB = isDark ? 'rgba(245, 231, 213, 0.045)' : 'rgba(38, 16, 6, 0.027)';

  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Defs>
        {/* "/" direction — main diagonal plus the two corner fragments a
            tiled pattern needs so the line doesn't break at tile edges. */}
        <Pattern id="weaveSlash" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          <Path
            d={`M0,${TILE} L${TILE},0 M${-HALF},${HALF} L${HALF},${-HALF} M${HALF},${TILE + HALF} L${TILE + HALF},${HALF}`}
            stroke={inkA}
            strokeWidth={STROKE}
          />
        </Pattern>
        {/* "\" direction */}
        <Pattern id="weaveBackslash" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          <Path
            d={`M0,0 L${TILE},${TILE} M${-HALF},${-HALF} L${HALF},${HALF} M${HALF},${HALF} L${TILE + HALF},${TILE + HALF}`}
            stroke={inkB}
            strokeWidth={STROKE}
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#weaveSlash)" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#weaveBackslash)" />
    </Svg>
  );
};

export default WovenBackground;
