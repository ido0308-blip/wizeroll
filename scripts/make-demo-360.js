// Draws the marked demo frames for the 360 view: the WIZEROLL stool, turning.
// The drawing follows the real stool: a round black cushioned seat, a lever under the seat,
// a chrome gas cylinder, a black hub, five curved chrome legs and black casters.
// Run from the project root: node scripts/make-demo-360.js
// Delete images/360/ and update js/media-config.js when the real photo series is ready.

import { mkdirSync, writeFileSync } from 'node:fs';

const FRAMES = 24;
const SIZE = 800;
const CX = SIZE / 2;
const TILT = 0.3; // How flat circles look: the camera is a little above the stool.
const ACCENT = '#FF3D1A';
const MUTED = '#6B7280';

const SEAT_Y = 300; // Centre of the seat top.
const SEAT_R = 190;
const SEAT_DEPTH = 62; // Height of the cushion side.
const HUB_Y = 585;
const LEG_R = 270;
const TIP_Y = 596; // Leg tips sit a little lower than the hub, then bend down to the casters.

const r = (value) => Math.round(value * 10) / 10;

const DEFS = `<defs>
<linearGradient id="chrome" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#8A8F96"/><stop offset="0.25" stop-color="#F4F6F8"/>
  <stop offset="0.45" stop-color="#B9BEC4"/><stop offset="0.7" stop-color="#FFFFFF"/>
  <stop offset="1" stop-color="#7C8188"/>
</linearGradient>
<linearGradient id="chrome-leg" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.3" stop-color="#D9DDE1"/>
  <stop offset="0.55" stop-color="#8E949B"/><stop offset="0.8" stop-color="#E6E9EC"/>
  <stop offset="1" stop-color="#5B6067"/>
</linearGradient>
<linearGradient id="seat-side" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#15181C"/><stop offset="0.35" stop-color="#3A4049"/>
  <stop offset="0.6" stop-color="#262B32"/><stop offset="1" stop-color="#121417"/>
</linearGradient>
<radialGradient id="seat-top" cx="0.42" cy="0.35" r="0.75">
  <stop offset="0" stop-color="#4A515B"/><stop offset="0.6" stop-color="#2A2F36"/>
  <stop offset="1" stop-color="#1B1E23"/>
</radialGradient>
<radialGradient id="floor-shadow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#000000" stop-opacity="0.22"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
</radialGradient>
</defs>`;

// One leg: a curved chrome arm from the hub to its tip, bending down into a caster.
function leg(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const near = (sin + 1) / 2; // 0 at the back, 1 at the front.
  const scale = 0.8 + near * 0.3;
  const tipX = CX + cos * LEG_R;
  const tipY = TIP_Y + sin * LEG_R * TILT;
  const midX = CX + cos * LEG_R * 0.55;
  const midY = HUB_Y + sin * LEG_R * 0.55 * TILT - 26;
  const width = 20 * scale;
  const drop = 38 * scale;
  const wheelR = 21 * scale;
  const wheelY = tipY + drop + wheelR - 4;
  const d = `M${CX} ${HUB_Y} Q${r(midX)} ${r(midY)} ${r(tipX)} ${r(tipY)} c${r(cos * 14)} 2 ${r(cos * 14)} ${r(drop * 0.3)} ${r(cos * 6)} ${r(drop * 0.6)}`;
  const arm = `<path d="${d}" fill="none" stroke="#4A4F55" stroke-width="${r(width + 3)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#chrome-leg)" stroke-width="${r(width)}" stroke-linecap="round"/>`;
  const edge = `<path d="M${CX} ${HUB_Y} Q${r(midX)} ${r(midY)} ${r(tipX)} ${r(tipY)}" fill="none" stroke="#5E636A" stroke-opacity="0.35" stroke-width="2" transform="translate(0 ${r(width / 2 - 1)})"/>`;
  const bracket = `<rect x="${r(tipX + cos * 6 - 11 * scale)}" y="${r(tipY + drop * 0.45)}" width="${r(22 * scale)}" height="${r(drop * 0.75)}" rx="4" fill="#16181B"/>`;
  const wheel = [
    `<ellipse cx="${r(tipX + cos * 6)}" cy="${r(wheelY)}" rx="${r(wheelR * (0.55 + 0.45 * Math.abs(sin)))}" ry="${r(wheelR)}" fill="#1A1C1F"/>`,
    `<ellipse cx="${r(tipX + cos * 6)}" cy="${r(wheelY)}" rx="${r(wheelR * 0.35 * (0.55 + 0.45 * Math.abs(sin)))}" ry="${r(wheelR * 0.35)}" fill="#55595F"/>`,
  ].join('');
  return { depth: sin, svg: `<g>${bracket}${wheel}${arm}${edge}</g>` };
}

function frame(index) {
  const turn = ((index - 1) / FRAMES) * Math.PI * 2;
  const legs = [0, 1, 2, 3, 4].map((n) => leg(turn + (n * Math.PI * 2) / 5)).sort((a, b) => a.depth - b.depth);
  const back = legs.filter((item) => item.depth < 0).map((item) => item.svg).join('');
  const front = legs.filter((item) => item.depth >= 0).map((item) => item.svg).join('');

  // The lever under the seat turns with the stool; it starts on the left, as in the photo.
  const leverAngle = turn + Math.PI * 0.82;
  const leverX = CX + Math.cos(leverAngle) * 120;
  const leverY = SEAT_Y + SEAT_DEPTH + 18 + Math.sin(leverAngle) * 120 * TILT;
  const leverEndX = CX + Math.cos(leverAngle) * 175;
  const leverEndY = leverY + 22;
  const lever = `<path d="M${r(CX + Math.cos(leverAngle) * 40)} ${r(SEAT_Y + SEAT_DEPTH + 16)} L${r(leverX)} ${r(leverY)} L${r(leverEndX)} ${r(leverEndY)}" fill="none" stroke="#1A1C20" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`;
  const leverInFront = Math.sin(leverAngle) > 0;

  const seatBottom = SEAT_Y + SEAT_DEPTH;
  const cylinder = [
    // Thin top piston, then the wider chrome sleeve down to the hub.
    `<rect x="${CX - 13}" y="${seatBottom}" width="26" height="45" fill="url(#chrome)"/>`,
    `<rect x="${CX - 22}" y="${seatBottom + 38}" width="44" height="12" rx="3" fill="#2A2D31"/>`,
    `<rect x="${CX - 21}" y="${seatBottom + 48}" width="42" height="${HUB_Y - seatBottom - 60}" fill="url(#chrome)"/>`,
  ].join('');
  const hub = `<ellipse cx="${CX}" cy="${HUB_Y + 4}" rx="56" ry="30" fill="#17191C"/><ellipse cx="${CX}" cy="${HUB_Y - 6}" rx="40" ry="16" fill="#2B2F34"/>`;

  const seat = [
    `<path d="M${CX - SEAT_R} ${SEAT_Y} L${CX - SEAT_R} ${seatBottom} A${SEAT_R} ${SEAT_R * TILT} 0 0 0 ${CX + SEAT_R} ${seatBottom} L${CX + SEAT_R} ${SEAT_Y} Z" fill="url(#seat-side)"/>`,
    `<path d="M${CX - SEAT_R + 2} ${SEAT_Y + 14} A${SEAT_R - 2} ${(SEAT_R - 2) * TILT} 0 0 0 ${CX + SEAT_R - 2} ${SEAT_Y + 14}" fill="none" stroke="#0E1013" stroke-width="2"/>`,
    `<ellipse cx="${CX}" cy="${SEAT_Y}" rx="${SEAT_R}" ry="${r(SEAT_R * TILT)}" fill="url(#seat-top)"/>`,
    `<ellipse cx="${CX}" cy="${SEAT_Y}" rx="${SEAT_R - 3}" ry="${r((SEAT_R - 3) * TILT)}" fill="none" stroke="#101215" stroke-width="2"/>`,
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
${DEFS}
<rect width="${SIZE}" height="${SIZE}" fill="#F3F4F6"/>
<text x="${CX}" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${ACCENT}" letter-spacing="4">DEMO 360 VIEW</text>
<text x="${CX}" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="${MUTED}">Placeholder frame ${index} of ${FRAMES}</text>
<ellipse cx="${CX}" cy="${TIP_Y + 75}" rx="330" ry="110" fill="url(#floor-shadow)"/>
${back}
${leverInFront ? '' : lever}
${cylinder}
${hub}
${front}
${leverInFront ? lever : ''}
${seat}
</svg>
`;
}

mkdirSync('images/360', { recursive: true });
for (let index = 1; index <= FRAMES; index += 1) {
  writeFileSync(`images/360/frame-${index}.svg`, frame(index));
}
console.log(`Wrote ${FRAMES} demo frames to images/360/`);
