#!/usr/bin/env node
/**
 * generate-icons.js
 * Generates SVG icon files for the zombie survival game UI.
 * All icons: 48x48 viewBox, clean vectors, currentColor for CSS theming.
 * Output: assets/icons/
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');

function svg(inner, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"${extra}>\n${inner}\n</svg>\n`;
}

function s(strokeColor = 'currentColor', strokeWidth = 2.5) {
  return `stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
}

const icons = {
  // ───────────────────── GAME UI ICONS ─────────────────────

  'trophy.svg': svg(
    `  <path d="M16 8h16v4c0 6-3.5 11-8 13-4.5-2-8-7-8-13V8z" ${s()} fill="none"/>
  <path d="M16 12h-4c-2 0-4 2-4 4s2 5 5 5h1" ${s()}/>
  <path d="M32 12h4c2 0 4 2 4 4s-2 5-5 5h-1" ${s()}/>
  <path d="M20 25c-1 2-1 4 0 5h8c1-1 1-3 0-5" ${s()}/>
  <path d="M18 30h12v3c0 1-1 2-2 2H20c-1 0-2-1-2-2v-3z" ${s()}/>
  <line x1="15" y1="38" x2="33" y2="38" ${s()}/>
  <line x1="24" y1="35" x2="24" y2="38" ${s()}/>`
  ),

  'target.svg': svg(
    `  <circle cx="24" cy="24" r="16" ${s()}/>
  <circle cx="24" cy="24" r="10" ${s()}/>
  <circle cx="24" cy="24" r="4" ${s()}/>
  <line x1="24" y1="4" x2="24" y2="12" ${s()}/>
  <line x1="24" y1="36" x2="24" y2="44" ${s()}/>
  <line x1="4" y1="24" x2="12" y2="24" ${s()}/>
  <line x1="36" y1="24" x2="44" y2="24" ${s()}/>`
  ),

  'chart.svg': svg(
    `  <rect x="6" y="28" width="7" height="14" rx="1" ${s()}/>
  <rect x="16" y="20" width="7" height="22" rx="1" ${s()}/>
  <rect x="26" y="12" width="7" height="30" rx="1" ${s()}/>
  <rect x="36" y="6" width="7" height="36" rx="1" ${s()}/>
  <line x1="4" y1="44" x2="45" y2="44" ${s()}/>`
  ),

  'unlock.svg': svg(
    `  <rect x="12" y="22" width="24" height="20" rx="3" ${s()}/>
  <circle cx="24" cy="33" r="3" ${s()}/>
  <line x1="24" y1="36" x2="24" y2="39" ${s()}/>
  <path d="M18 22v-8a6 6 0 0 1 12 0" ${s()}/>`
  ),

  'lock.svg': svg(
    `  <rect x="12" y="22" width="24" height="20" rx="3" ${s()}/>
  <circle cx="24" cy="33" r="3" ${s()}/>
  <line x1="24" y1="36" x2="24" y2="39" ${s()}/>
  <path d="M18 22v-8a6 6 0 0 1 12 0v8" ${s()}/>`
  ),

  'lightning.svg': svg(
    `  <polygon points="26,4 12,26 22,26 18,44 36,20 26,20" ${s()} fill="currentColor" opacity="0.15"/>
  <polygon points="26,4 12,26 22,26 18,44 36,20 26,20" ${s()}/>`
  ),

  'stats.svg': svg(
    `  <polyline points="4,40 14,28 22,32 30,16 38,10 44,6" ${s()}/>
  <polyline points="34,6 44,6 44,16" ${s()}/>
  <line x1="4" y1="44" x2="44" y2="44" ${s()}/>
  <line x1="4" y1="4" x2="4" y2="44" ${s()}/>`
  ),

  'gem.svg': svg(
    `  <polygon points="24,42 6,18 14,6 34,6 42,18" ${s()}/>
  <polyline points="6,18 24,42 42,18" ${s()}/>
  <line x1="14" y1="6" x2="24" y2="18" ${s()}/>
  <line x1="34" y1="6" x2="24" y2="18" ${s()}/>
  <line x1="6" y1="18" x2="42" y2="18" ${s()}/>`
  ),

  'dna.svg': svg(
    `  <path d="M16 4c0 8 16 12 16 20s-16 12-16 20" ${s()}/>
  <path d="M32 4c0 8-16 12-16 20s16 12 16 20" ${s()}/>
  <line x1="14" y1="14" x2="34" y2="14" ${s()} opacity="0.6"/>
  <line x1="14" y1="24" x2="34" y2="24" ${s()} opacity="0.6"/>
  <line x1="14" y1="34" x2="34" y2="34" ${s()} opacity="0.6"/>`
  ),

  'coin.svg': svg(
    `  <circle cx="24" cy="24" r="18" stroke="#FFD700" stroke-width="2.5" fill="none"/>
  <circle cx="24" cy="24" r="14" stroke="#FFD700" stroke-width="1.5" fill="none"/>
  <text x="24" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#FFD700">$</text>`
  ),

  'gamepad.svg': svg(
    `  <rect x="6" y="14" width="36" height="22" rx="8" ${s()}/>
  <line x1="16" y1="21" x2="16" y2="29" ${s()}/>
  <line x1="12" y1="25" x2="20" y2="25" ${s()}/>
  <circle cx="30" cy="22" r="2" fill="currentColor"/>
  <circle cx="36" cy="26" r="2" fill="currentColor"/>
  <circle cx="30" cy="30" r="2" fill="currentColor"/>`
  ),

  'arrow-up.svg': svg(
    `  <polyline points="12,28 24,12 36,28" ${s()}/>
  <line x1="24" y1="12" x2="24" y2="42" ${s()}/>`
  ),

  'shield.svg': svg(
    `  <path d="M24 4L8 12v12c0 10 7 17 16 20 9-3 16-10 16-20V12L24 4z" ${s()}/>
  <polyline points="18,24 22,30 32,18" ${s()}/>`
  ),

  'palette.svg': svg(
    `  <path d="M24 6C13 6 4 14 4 24c0 5 2.5 9 7 9 3 0 4-3 7-3s4 6 8 6c10 0 18-8 18-18C44 10 35 6 24 6z" ${s()}/>
  <circle cx="16" cy="16" r="3" fill="#FF6B6B" stroke="none"/>
  <circle cx="26" cy="12" r="3" fill="#4ECDC4" stroke="none"/>
  <circle cx="34" cy="18" r="3" fill="#FFE66D" stroke="none"/>
  <circle cx="34" cy="28" r="3" fill="#A78BFA" stroke="none"/>`
  ),

  'package.svg': svg(
    `  <path d="M6 16l18-10 18 10v18L24 44 6 34V16z" ${s()}/>
  <line x1="24" y1="24" x2="24" y2="44" ${s()}/>
  <polyline points="6,16 24,26 42,16" ${s()}/>
  <polyline points="15,10 33,20" ${s()} opacity="0.4"/>`
  ),

  'checkmark.svg': svg(
    `  <circle cx="24" cy="24" r="18" ${s()}/>
  <polyline points="14,24 21,32 34,17" ${s()}/>`
  ),

  // ───────────────────── WEAPON ICONS ─────────────────────

  'pistol.svg': svg(
    `  <path d="M8 18h22l4-4h6v8h-6l-2 2v8h-6v-8l-2-2H8v-4z" ${s()}/>
  <rect x="24" y="24" width="6" height="10" rx="1" ${s()}/>
  <line x1="14" y1="18" x2="14" y2="22" ${s()} opacity="0.4"/>`
  ),

  'shotgun.svg': svg(
    `  <rect x="4" y="21" width="36" height="6" rx="2" ${s()}/>
  <path d="M30 21l6-6h4v6" ${s()}/>
  <rect x="10" y="27" width="8" height="8" rx="1" ${s()}/>
  <line x1="40" y1="23" x2="44" y2="23" ${s()}/>
  <line x1="40" y1="25" x2="44" y2="25" ${s()}/>`
  ),

  'rifle.svg': svg(
    `  <rect x="4" y="21" width="40" height="5" rx="1.5" ${s()}/>
  <rect x="14" y="26" width="6" height="10" rx="1" ${s()}/>
  <path d="M20 26l10-1v-4" ${s()}/>
  <rect x="6" y="18" width="8" height="3" rx="1" ${s()} opacity="0.5"/>
  <line x1="38" y1="16" x2="44" y2="12" ${s()}/>
  <line x1="40" y1="18" x2="44" y2="16" ${s()}/>`
  ),

  'smg.svg': svg(
    `  <rect x="8" y="20" width="30" height="5" rx="1.5" ${s()}/>
  <rect x="18" y="25" width="5" height="12" rx="1" ${s()}/>
  <path d="M34 20h4l4-4v8h-4" ${s()}/>
  <rect x="10" y="17" width="10" height="3" rx="1" ${s()} opacity="0.5"/>
  <line x1="10" y1="25" x2="14" y2="30" ${s()}/>`
  ),

  'sniper.svg': svg(
    `  <rect x="2" y="22" width="44" height="4" rx="1" ${s()}/>
  <circle cx="8" cy="17" r="5" ${s()}/>
  <line x1="8" y1="22" x2="8" y2="12" ${s()}/>
  <rect x="24" y="26" width="5" height="10" rx="1" ${s()}/>
  <line x1="38" y1="18" x2="44" y2="14" ${s()}/>
  <line x1="20" y1="22" x2="20" y2="18" ${s()} opacity="0.5"/>
  <line x1="32" y1="22" x2="32" y2="18" ${s()} opacity="0.5"/>`
  ),

  'rocket.svg': svg(
    `  <rect x="10" y="20" width="24" height="8" rx="3" ${s()}/>
  <path d="M34 20l6-4v16l-6-4" ${s()}/>
  <rect x="4" y="22" width="6" height="4" rx="1" ${s()}/>
  <line x1="18" y1="28" x2="16" y2="36" ${s()}/>
  <line x1="26" y1="28" x2="28" y2="36" ${s()}/>
  <rect x="14" y="34" width="6" height="4" rx="1" ${s()} opacity="0.5"/>`
  ),

  'laser.svg': svg(
    `  <rect x="6" y="20" width="22" height="8" rx="2" ${s()}/>
  <path d="M28 22h4l2-2v8l-2-2h-4" ${s()}/>
  <line x1="6" y1="24" x2="2" y2="24" stroke="#FF4444" stroke-width="2" stroke-linecap="round"/>
  <line x1="2" y1="24" x2="-2" y2="24" stroke="#FF4444" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  <circle cx="8" cy="24" r="2" fill="#FF4444" opacity="0.5"/>
  <line x1="34" y1="24" x2="46" y2="24" stroke="#FF4444" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/>
  <circle cx="46" cy="24" r="2" fill="#FF4444" opacity="0.8"/>`
  ),

  'minigun.svg': svg(
    `  <rect x="8" y="18" width="26" height="12" rx="2" ${s()}/>
  <line x1="34" y1="20" x2="44" y2="20" ${s()}/>
  <line x1="34" y1="24" x2="44" y2="24" ${s()}/>
  <line x1="34" y1="28" x2="44" y2="28" ${s()}/>
  <circle cx="44" cy="24" r="6" ${s()} opacity="0.5"/>
  <line x1="16" y1="30" x2="14" y2="38" ${s()}/>
  <line x1="22" y1="30" x2="20" y2="38" ${s()}/>
  <rect x="12" y="36" width="10" height="4" rx="1" ${s()} opacity="0.5"/>`
  ),

  'flamethrower.svg': svg(
    `  <rect x="6" y="20" width="20" height="8" rx="2" ${s()}/>
  <rect x="22" y="22" width="6" height="4" rx="1" ${s()}/>
  <path d="M28 24c4-8 10-10 14-6s-2 10-6 10c-2 0-4-2-3-5s4-4 6-2" stroke="#FF6B35" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M30 22c2-4 6-5 8-2" stroke="#FFD700" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.8"/>
  <line x1="12" y1="28" x2="10" y2="36" ${s()}/>`
  ),

  // ───────────────────── COMBAT / EFFECT ICONS ─────────────────────

  'explosion.svg': svg(
    `  <polygon points="24,2 28,16 42,10 32,22 46,28 32,30 38,44 24,34 10,44 16,30 2,28 16,22 6,10 20,16" ${s()}/>
  <circle cx="24" cy="24" r="6" ${s()} opacity="0.5"/>`
  ),

  'skull.svg': svg(
    `  <path d="M12 24c0-8 5-16 12-16s12 8 12 16c0 4-2 7-4 9h-4v5h-2v-5h-4v5h-2v-5h-4c-2-2-4-5-4-9z" ${s()}/>
  <circle cx="19" cy="22" r="4" ${s()}/>
  <circle cx="29" cy="22" r="4" ${s()}/>
  <path d="M20 32v-2h2v2h4v-2h2v2" ${s()}/>`
  ),

  'crown.svg': svg(
    `  <path d="M6 36V16l10 8 8-14 8 14 10-8v20H6z" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <line x1="6" y1="36" x2="42" y2="36" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="6" cy="16" r="2" fill="#FFD700"/>
  <circle cx="24" cy="10" r="2" fill="#FFD700"/>
  <circle cx="42" cy="16" r="2" fill="#FFD700"/>`
  ),

  'star.svg': svg(
    `  <polygon points="24,4 29,18 44,18 32,28 36,42 24,33 12,42 16,28 4,18 19,18" ${s()}/>`
  ),

  'bomb.svg': svg(
    `  <circle cx="24" cy="28" r="14" ${s()}/>
  <path d="M30 14l4-6" ${s()}/>
  <path d="M32 10c1-2 4-2 5 0" stroke="#FF6B35" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M34 8c1-2 3-1 3 1" stroke="#FFD700" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <line x1="28" y1="16" x2="30" y2="14" ${s()}/>`
  ),

  'rocket-projectile.svg': svg(
    `  <path d="M38 6c4 4 4 16-4 24l-6-6-6-6C30 10 34 2 38 6z" ${s()}/>
  <path d="M22 28l-6 6 4 4" ${s()}/>
  <path d="M20 18l-6 6 4 4" ${s()}/>
  <circle cx="32" cy="16" r="2" fill="currentColor"/>
  <path d="M8 40l6-4 2 2-4 6" ${s()} opacity="0.6"/>
  <line x1="6" y1="36" x2="12" y2="30" ${s()} opacity="0.4"/>
  <line x1="18" y1="42" x2="12" y2="36" ${s()} opacity="0.4"/>`
  ),

  'vampire.svg': svg(
    `  <path d="M10 12c0-4 4-8 8-6 2 1 4 3 6 3s4-2 6-3c4-2 8 2 8 6 0 6-4 12-14 18C14 24 10 18 10 12z" ${s()}/>
  <path d="M18 22l-2 8 4-4" ${s()}/>
  <path d="M30 22l2 8-4-4" ${s()}/>
  <circle cx="19" cy="16" r="1.5" fill="currentColor"/>
  <circle cx="29" cy="16" r="1.5" fill="currentColor"/>`
  ),

  'heart-green.svg': svg(
    `  <path d="M24 40L8 24c-4-4-4-12 2-14s10 2 14 6c4-4 8-8 14-6s6 10 2 14L24 40z" stroke="#4ADE80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M18 22l4 4 6-8" stroke="#4ADE80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  ),

  'storm.svg': svg(
    `  <path d="M12 22c-2 0-4-2-4-5s3-7 8-7c1-4 5-6 9-6s7 3 8 6c4 0 7 3 7 6s-2 6-5 6" ${s()}/>
  <polyline points="18,26 14,34 20,34 16,42" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <polyline points="30,26 26,34 32,34 28,42" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>`
  ),

  'wind.svg': svg(
    `  <path d="M6 16h22c4 0 4-6 0-6" ${s()}/>
  <path d="M6 24h30c4 0 4-6 0-6" ${s()}/>
  <path d="M10 32h20c4 0 4-6 0-6" ${s()}/>`
  ),

  'fist.svg': svg(
    `  <path d="M14 30v-8c0-2 1.5-3 3-3s3 1 3 3v-4c0-2 1.5-3 3-3s3 1 3 3v-2c0-2 1.5-3 3-3s3 1 3 3v2c1.5-1 3-0.5 3 1.5v12c0 6-4 10-10 10h-2c-6 0-9-4-9-10z" ${s()}/>
  <line x1="17" y1="24" x2="17" y2="30" ${s()} opacity="0.4"/>
  <line x1="23" y1="22" x2="23" y2="30" ${s()} opacity="0.4"/>
  <line x1="29" y1="20" x2="29" y2="30" ${s()} opacity="0.4"/>`
  ),

  'castle.svg': svg(
    `  <rect x="10" y="20" width="28" height="24" ${s()}/>
  <rect x="6" y="8" width="8" height="16" ${s()}/>
  <rect x="34" y="8" width="8" height="16" ${s()}/>
  <path d="M6 8v-4h3v4h2v-4h3v4" ${s()}/>
  <path d="M34 8v-4h3v4h2v-4h3v4" ${s()}/>
  <path d="M10 20v-4h4v4h4v-4h4v4h4v-4h4v4h4v-4h4v4" ${s()} opacity="0.5"/>
  <path d="M20 44v-10a4 4 0 0 1 8 0v10" ${s()}/>`
  ),

  'magic.svg': svg(
    `  <circle cx="24" cy="24" r="14" ${s()}/>
  <ellipse cx="24" cy="38" rx="10" ry="2" ${s()} opacity="0.3"/>
  <path d="M18 20c2-2 4-2 6 0" stroke="#A78BFA" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M24 20c2-2 4-2 6 0" stroke="#A78BFA" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="20" cy="18" r="1" fill="#A78BFA" opacity="0.6"/>
  <circle cx="28" cy="16" r="1.5" fill="#A78BFA" opacity="0.4"/>
  <circle cx="24" cy="28" r="1" fill="#A78BFA" opacity="0.5"/>
  <path d="M16 26c4 4 8 4 12 2" stroke="#A78BFA" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>`
  ),

  'fire.svg': svg(
    `  <path d="M24 4c-4 8 4 12 0 18-2 3-6 4-8 2 2 6 6 12 12 14 8-2 14-8 14-16C42 12 32 6 24 4z" stroke="#FF6B35" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M22 28c-1 4 2 8 6 8 2-1 4-4 4-8-2 2-6 4-8-4" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.8"/>`
  ),

  'poison.svg': svg(
    `  <path d="M24 6c-6 8-14 16-10 26 2 4 6 8 10 8s8-4 10-8c4-10-4-18-10-26z" stroke="#4ADE80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="18" cy="32" r="2.5" stroke="#4ADE80" stroke-width="1.5" fill="none"/>
  <circle cx="28" cy="28" r="3" stroke="#4ADE80" stroke-width="1.5" fill="none"/>
  <circle cx="22" cy="22" r="2" stroke="#4ADE80" stroke-width="1.5" fill="none" opacity="0.6"/>`
  ),

  'ice.svg': svg(
    `  <line x1="24" y1="4" x2="24" y2="44" stroke="#67E8F9" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="6" y1="14" x2="42" y2="34" stroke="#67E8F9" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="6" y1="34" x2="42" y2="14" stroke="#67E8F9" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="24" y1="10" x2="20" y2="6" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="10" x2="28" y2="6" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="38" x2="20" y2="42" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="38" x2="28" y2="42" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="18" x2="8" y2="18" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="18" x2="12" y2="14" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36" y1="30" x2="40" y2="30" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36" y1="30" x2="36" y2="34" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="30" x2="8" y2="30" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="30" x2="12" y2="34" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36" y1="18" x2="40" y2="18" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="36" y1="18" x2="36" y2="14" stroke="#67E8F9" stroke-width="1.5" stroke-linecap="round"/>`
  ),

  'health.svg': svg(
    `  <rect x="16" y="8" width="16" height="32" rx="2" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="8" y="16" width="32" height="16" rx="2" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  ),

  // ───────────────────── ZOMBIE TYPE ICONS ─────────────────────

  'zombie-normal.svg': svg(
    `  <path d="M14 10c0-4 4-6 10-6s10 2 10 6v14c0 4-4 8-10 8s-10-4-10-8V10z" stroke="#4ADE80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="19" cy="16" r="2.5" fill="#4ADE80"/>
  <circle cx="29" cy="16" r="2.5" fill="#4ADE80"/>
  <path d="M18 24h12" stroke="#4ADE80" stroke-width="2" stroke-linecap="round"/>
  <line x1="20" y1="24" x2="20" y2="27" stroke="#4ADE80" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="24" x2="24" y2="27" stroke="#4ADE80" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="28" y1="24" x2="28" y2="27" stroke="#4ADE80" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M16 32v8M24 30v10M32 32v8" stroke="#4ADE80" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`
  ),

  'zombie-fast.svg': svg(
    `  <path d="M18 10c0-4 3-6 8-6s8 2 8 6v12c0 4-3 7-8 7s-8-3-8-7V10z" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="23" cy="15" r="2" fill="#FACC15"/>
  <circle cx="31" cy="15" r="2" fill="#FACC15"/>
  <path d="M22 22h10" stroke="#FACC15" stroke-width="2" stroke-linecap="round"/>
  <line x1="6" y1="12" x2="16" y2="12" stroke="#FACC15" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  <line x1="4" y1="17" x2="16" y2="17" stroke="#FACC15" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <line x1="8" y1="22" x2="16" y2="22" stroke="#FACC15" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
  <path d="M22 30v8M30 28v10" stroke="#FACC15" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`
  ),

  'zombie-tank.svg': svg(
    `  <path d="M10 8c0-2 4-4 14-4s14 2 14 4v18c0 6-6 10-14 10S10 32 10 26V8z" stroke="#FB923C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M10 8c2 2 8 4 14 4s12-2 14-4" stroke="#FB923C" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="18" cy="18" r="3" fill="#FB923C"/>
  <circle cx="30" cy="18" r="3" fill="#FB923C"/>
  <path d="M16 26h16" stroke="#FB923C" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="8" y1="16" x2="10" y2="16" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/>
  <line x1="38" y1="16" x2="40" y2="16" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/>
  <path d="M14 34v6M24 32v8M34 34v6" stroke="#FB923C" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`
  ),

  'zombie-boss.svg': svg(
    `  <path d="M12 14c0-4 5-8 12-8s12 4 12 8v14c0 6-5 10-12 10S12 34 12 28V14z" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M14 8l4-4 4 3 6-5 6 5 4-3 4 4" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="20" cy="20" r="3" fill="#EF4444"/>
  <circle cx="28" cy="20" r="3" fill="#EF4444"/>
  <path d="M18 30h12" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="20" y1="30" x2="19" y2="34" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="24" y1="30" x2="24" y2="35" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="28" y1="30" x2="29" y2="34" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M14 38v4M24 36v6M34 38v4" stroke="#EF4444" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`
  )
};

// ───────────────────── WRITE FILES ─────────────────────

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let count = 0;
for (const [filename, content] of Object.entries(icons)) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  count++;
}

console.log(`Generated ${count} SVG icons in ${OUTPUT_DIR}`);
console.log('Icons:');
Object.keys(icons).forEach((name, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${name}`);
});
