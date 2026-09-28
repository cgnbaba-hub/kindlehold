// Project-authored speaker portraits for mission dialogue (original drawings, inline SVG).
// Static strings only — never built from runtime data.

const P = (id, body, bg) => `<svg viewBox="0 0 64 64" width="100%" height="100%">
<defs><radialGradient id="pg-${id}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs>
<rect width="64" height="64" fill="url(#pg-${id})"/>${body}</svg>`;

const FACE = (skin, shade) => `<path d="M22 27c0-8 4.5-12 10-12s10 4 10 12c0 8-4.5 14-10 14s-10-6-10-14z" fill="${skin}"/>
<path d="M32 41c-5 0-9-5-9.8-11 2 4 5.5 7 9.8 7s7.8-3 9.8-7c-.8 6-4.8 11-9.8 11z" fill="${shade}" opacity=".5"/>`;
const EYES = (c = '#2a2018') => `<ellipse cx="27.5" cy="28" rx="1.4" ry="1.1" fill="${c}"/><ellipse cx="36.5" cy="28" rx="1.4" ry="1.1" fill="${c}"/>`;

export const PORTRAITS = {
  // Maren Ashgrove, Lantern Warden: deep teal hood, warm lantern glow from below
  maren: P('maren', `<path d="M8 64c2-14 10-20 24-20s22 6 24 20z" fill="#1f4450"/>
<path d="M16 36c-2-16 6-26 16-26s18 10 16 26l-4 12H20z" fill="#24505e"/>
${FACE('#e2c3a0', '#b48a68')}${EYES()}
<path d="M26 25l4-1M34 24l4 1" stroke="#5a3a24" stroke-width="1.1" stroke-linecap="round"/>
<path d="M29 35c2 1 4 1 6 0" stroke="#8a4a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="M22 22c2-6 6-8 10-8s8 2 10 8c-3-2-6-3-10-3s-7 1-10 3z" fill="#6b3a26"/>
<path d="M16 36c-1-14 6-24 16-24s17 10 16 24c-2-8-8-18-16-18s-14 10-16 18z" fill="#2c5f6f"/>
<path d="M50 30v30" stroke="#3a3228" stroke-width="2.2"/>
<circle cx="50" cy="44" r="6" fill="#ffcf6a" opacity=".35"/><rect x="47" y="40" width="6" height="8" rx="1.5" fill="#ffd98a" stroke="#4a3a24" stroke-width="1.2"/>
<path d="M20 48l6-4 6 3 6-3 6 4" stroke="#c9a15a" stroke-width="1.2" fill="none"/>`, ['#4a5a58', '#161c1e']),

  // Osric Tallow, Reeve of Kindlehold: grey beard, brown cap, chain of office
  osric: P('osric', `<path d="M8 64c2-14 10-19 24-19s22 5 24 19z" fill="#6e3a2a"/>
${FACE('#e0bf9a', '#a8805e')}${EYES()}
<path d="M25 25.5l4-.6M35 24.9l4 .6" stroke="#8a8680" stroke-width="1.6" stroke-linecap="round"/>
<path d="M23 32c1 9 4 14 9 14s8-5 9-14c-2 3-5 4-9 4s-7-1-9-4z" fill="#c9c4bc"/>
<path d="M28 34.5c2.5-1.2 5.5-1.2 8 0" stroke="#9a948c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M20 22c0-7 5-10 12-10s12 3 12 10c-4-1.5-8-2-12-2s-8 .5-12 2z" fill="#5a4030"/>
<path d="M19 22h26" stroke="#3a2a1e" stroke-width="2"/>
<path d="M18 52c4 5 9 7 14 7s10-2 14-7" stroke="#d9b45a" stroke-width="2" fill="none" stroke-dasharray="2 1.5"/>
<circle cx="32" cy="59" r="2.6" fill="#e3c26b" stroke="#6a4a1a"/>`, ['#6a5a44', '#1e1914']),

  // Wren Fenmore, Scout: green hood, auburn fringe, bow over the shoulder
  wren: P('wren', `<path d="M8 64c2-14 10-19 24-19s22 5 24 19z" fill="#3e5a32"/>
<path d="M12 12c10 10 18 30 30 50" stroke="#6a4a2a" stroke-width="2" fill="none"/>
<path d="M17 36c-1-15 6-24 15-24s16 9 15 24l-3 9H20z" fill="#4c6e3a"/>
${FACE('#e8c8a4', '#b48c6a')}${EYES('#3a2a1a')}
<path d="M23 24c2-5 5-7 9-7s7 2 9 6c-3-1-5-1-7 0-3-2-7-1-11 1z" fill="#a0522d"/>
<path d="M29 35.5c2 .8 4 .8 6 0" stroke="#9a5040" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<circle cx="26" cy="32" r="1.8" fill="#e09a80" opacity=".35"/><circle cx="38" cy="32" r="1.8" fill="#e09a80" opacity=".35"/>
<path d="M17 36c-1-13 6-22 15-22s16 9 15 22c-2-8-7-16-15-16s-13 8-15 16z" fill="#5a8044"/>`, ['#51604a', '#161a14']),

  // Vharek the Tollbreaker: rust-iron helm with fang crest, red beard, scar
  vharek: P('vharek', `<path d="M6 64c2-15 11-21 26-21s24 6 26 21z" fill="#4a2a22"/>
<path d="M8 58l8-10 6 6M56 58l-8-10-6 6" stroke="#7a4a30" stroke-width="3" fill="none"/>
${FACE('#c99a78', '#8a5a40')}${EYES('#1a0e0a')}
<path d="M25 25l5 1.5M39 25l-5 1.5" stroke="#2a1a12" stroke-width="2" stroke-linecap="round"/>
<path d="M22 31c0 10 4 16 10 16s10-6 10-16c-2 4-6 6-10 6s-8-2-10-6z" fill="#8c3b1f"/>
<path d="M28 35c2.5-1 5.5-1 8 0" stroke="#2a1410" stroke-width="1.6" fill="none"/>
<path d="M37 22l3 11" stroke="#8a4a3a" stroke-width="1.2"/>
<path d="M19 26c0-10 6-15 13-15s13 5 13 15l-4-3H23z" fill="#7a5040" stroke="#3a2418" stroke-width="1.2"/>
<path d="M32 11v14" stroke="#a36a3a" stroke-width="2.4"/>
<path d="M19 24l-5-8 7 4M45 24l5-8-7 4" fill="#e8dcc4" stroke="#6a5a48" stroke-width=".8"/>`, ['#5a2a22', '#140a08']),

  // Morwen Greyfen, brigand chieftain: moss-green hood, braided grey-black hair, fen-bone torc
  morwen: P('morwen', `<path d="M8 64c2-14 10-20 24-20s22 6 24 20z" fill="#3a4a2a"/>
<path d="M15 38c-2-17 6-27 17-27s19 10 17 27l-4 10H19z" fill="#44582e"/>
${FACE('#d6b494', '#9a7654')}${EYES('#1e2a14')}
<path d="M25.5 25.5l4.5-.2M34 25.3l4.5.2" stroke="#2a2a22" stroke-width="1.3" stroke-linecap="round"/>
<path d="M29 35.5c2 .6 4 .6 6 0" stroke="#7a4a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="M26 31l3 3M38 31l-3 3" stroke="#5a7a3a" stroke-width="1" opacity=".8"/>
<path d="M22 23c2-6 6-8 10-8s8 2 10 8c-3-1-6-2-10-2s-7 1-10 2z" fill="#3a3632"/>
<path d="M21 30c-2 6-1 14 1 18M43 30c2 6 1 14-1 18" stroke="#4a4640" stroke-width="3" stroke-dasharray="3 1.5" fill="none"/>
<path d="M15 38c-1-15 6-25 17-25s18 10 17 25c-2-9-8-19-17-19s-15 10-17 19z" fill="#52693a"/>
<path d="M20 50c4 3 8 4 12 4s8-1 12-4" stroke="#e8dcc0" stroke-width="2.2" fill="none"/>
<path d="M26 53l-1 3M32 54v3M38 53l1 3" stroke="#e8dcc0" stroke-width="1.4"/>`, ['#4a5838', '#121810']),

  // Ysolde, Margravine of Varr: golden hair, gold circlet, steel gorget, crimson mantle
  ysolde: P('ysolde', `<path d="M6 64c2-15 11-21 26-21s24 6 26 21z" fill="#6a1822"/>
<path d="M14 64c2-10 8-15 18-15s16 5 18 15z" fill="#8a1c2c"/>
<path d="M22 46c3 3 7 4 10 4s7-1 10-4l-2 6H24z" fill="#9aa0a8" stroke="#4a4e56" stroke-width=".8"/>
<path d="M20 30c-1 10 0 18 3 22M44 30c1 10 0 18-3 22" stroke="#c8a060" stroke-width="4" fill="none"/>
${FACE('#e2c2a4', '#aa8468')}${EYES('#26303a')}
<path d="M25.5 25.6l4.4-.8M34.1 24.8l4.4.8" stroke="#8a6a3a" stroke-width="1.1" stroke-linecap="round"/>
<path d="M29 35.4c2 .5 4 .5 6 0" stroke="#9a4a44" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M21 26c0-9 5-13 11-13s11 4 11 13c-2-5-5-7-11-7s-9 2-11 7z" fill="#d4ac6a"/>
<path d="M21 20.5c3-2 7-3 11-3s8 1 11 3" stroke="#e3c26b" stroke-width="2" fill="none"/>
<path d="M32 15.5l1.4 2.4h-2.8z" fill="#c03040" stroke="#e3c26b" stroke-width=".6"/>`, ['#5a2a30', '#140a0c']),

  // Master Edric Vane of the White Stag: grey-bearded, steel coif, white mantle with a green stag
  vane: P('vane', `<path d="M6 64c2-15 11-21 26-21s24 6 26 21z" fill="#d8d4c8"/>
<path d="M14 64c2-10 8-15 18-15s16 5 18 15z" fill="#2e5a3a"/>
<path d="M27 52l5-5 5 5-5 7z" fill="#e8e4d8" stroke="#1e2a20" stroke-width=".8"/>
<path d="M28 50l-2-4M36 50l2-4" stroke="#e8e4d8" stroke-width="1.2"/>
<path d="M18 40c0-18 6-27 14-27s14 9 14 27c-3-4-6-6-14-6s-11 2-14 6z" fill="#9aa0a6" stroke="#5a5e64" stroke-width=".8"/>
${FACE('#dcb99a', '#a8826a')}${EYES('#26302a')}
<path d="M25.5 25l4.4.4M34.1 25.4l4.4-.4" stroke="#8a8680" stroke-width="1.5" stroke-linecap="round"/>
<path d="M24 34c1 8 4 11 8 11s7-3 8-11c-2 2-5 3-8 3s-6-1-8-3z" fill="#a8a098"/>
<path d="M28.5 35.5c2-.6 5-.6 7 0" stroke="#5a4a44" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M20 22c2-6 7-9 12-9s10 3 12 9c-4-2-8-3-12-3s-8 1-12 3z" fill="#b9bec4" stroke="#5a5e64" stroke-width=".8"/>`, ['#3a4a3e', '#0e1410']),

  // Lady Ismay Morrow: black hair in a coil, a gold circlet, black iron gorget, a gold-and-black mantle
  ismay: P('ismay', `<path d="M6 64c2-15 11-21 26-21s24 6 26 21z" fill="#26262c"/>
<path d="M14 64c2-10 8-15 18-15s16 5 18 15z" fill="#34343a"/>
<path d="M22 46c3 3 7 4 10 4s7-1 10-4l-2 6H24z" fill="#4a4a52" stroke="#1a1a1e" stroke-width=".8"/>
<path d="M27 56l5-4 5 4-5 6z" fill="#d0a030"/>
${FACE('#dcb99a', '#a8826a')}${EYES('#1e2226')}
<path d="M25.5 25.2l4.4-.9M34.1 24.3l4.4.9" stroke="#1e1a18" stroke-width="1.4" stroke-linecap="round"/>
<path d="M29.2 35.6c2 .3 3.6.3 5.6 0" stroke="#8a3a38" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M20 30c0-11 5-17 12-17s12 6 12 17c-2-7-6-10-12-10s-10 3-12 10z" fill="#1e1a18"/>
<circle cx="32" cy="12" r="4" fill="#1e1a18"/>
<path d="M21 21c3-2 7-3 11-3s8 1 11 3" stroke="#d0a030" stroke-width="2" fill="none"/>`, ['#3a3226', '#0e0c0a']),

  // Hild of Millbrook, elder of the river folk: white braids, blue-grey shawl, a reed charm
  hild: P('hild', `<path d="M8 64c2-14 10-20 24-20s22 6 24 20z" fill="#4a5a68"/>
<path d="M14 64c1-10 6-16 18-18 12 2 17 8 18 18z" fill="#5d7080"/>
${FACE('#dcb99a', '#a8826a')}${EYES('#2a2a30')}
<path d="M25 27l4-.5M35 26.5l4 .5" stroke="#c9c4bc" stroke-width="1.1" stroke-linecap="round"/>
<path d="M27 31.5c1 .6 2 .6 3 0M34 31.5c1 .6 2 .6 3 0" stroke="#b08a70" stroke-width=".8" fill="none"/>
<path d="M29 35.5c2 .8 4 .8 6 0" stroke="#8a5a4a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="M21 26c0-9 5-13 11-13s11 4 11 13c-2-5-6-8-11-8s-9 3-11 8z" fill="#e8e4dc"/>
<path d="M21 26c-2 8-1 16 1 22M43 26c2 8 1 16-1 22" stroke="#ddd8ce" stroke-width="3.2" stroke-dasharray="3 1.4" fill="none"/>
<path d="M26 52l6 6 6-6" stroke="#8ab0c0" stroke-width="1.6" fill="none"/>
<circle cx="32" cy="58" r="2" fill="#c9b060"/>`, ['#50606a', '#141a1e']),
};

/** Portrait key from a message (explicit key, or matched by the speaker's name). */
export function portraitKey(msg) {
  if (msg.portrait && Object.hasOwn(PORTRAITS, msg.portrait)) return msg.portrait;
  const n = String(msg.speaker || '').toLowerCase();
  for (const k of Object.keys(PORTRAITS)) if (n.includes(k)) return k;
  return null;
}

// Osric's advisor avatar: a bust with separate parts the HUD animates (breathing, blinking, a
// talking mouth, a raised finger for urgent advice). Static project markup only.
export const OSRIC_AVATAR = `<svg class="av" viewBox="13 8 54 60" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
<defs><radialGradient id="av-bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#7a6448"/><stop offset="1" stop-color="#1e1914"/></radialGradient>
<linearGradient id="av-robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e4430"/><stop offset="1" stop-color="#4a2418"/></linearGradient></defs>
<rect width="80" height="88" fill="url(#av-bg)"/>
<path d="M4 88c0-8 3-14 8-17l2 17z" fill="#3a2a1e" opacity=".6"/>
<g class="av-body">
  <path d="M8 88c2-17 13-25 32-25s30 8 32 25z" fill="url(#av-robe)"/>
  <path d="M30 63l10 12 10-12" fill="#e8dcc0" stroke="#b8a888" stroke-width=".8"/>
  <path d="M20 70c6 7 13 10 20 10s14-3 20-10" stroke="#d9b45a" stroke-width="2.2" fill="none" stroke-dasharray="2.4 1.6"/>
  <circle cx="40" cy="81" r="3.2" fill="#e3c26b" stroke="#6a4a1a"/>
  <g class="av-ledger"><rect x="52" y="70" width="17" height="13" rx="1.5" fill="#5a3a24" stroke="#2a1a10" transform="rotate(-12 60 76)"/><path d="M55 73l12-2.5" stroke="#d8ccb0" stroke-width="1" transform="rotate(-12 60 76)"/></g>
  <g class="av-finger"><g transform="translate(-3 -14)"><path d="M58 88V70c0-2 1-3 2.5-3s2.5 1 2.5 3v-8c0-1.6 1-2.6 2.2-2.6s2.2 1 2.2 2.6V88z" fill="#e0bf9a" stroke="#8a6040" stroke-width=".8"/><path d="M54 88c0-8 2-12 6-13l8 0c2 2 3 6 3 13z" fill="#6e3a2a"/></g></g>
</g>
<g class="av-head">
  <path d="M28 34c0-10 5.5-15 12-15s12 5 12 15c0 10-5.5 17-12 17s-12-7-12-17z" fill="#e0bf9a"/>
  <path d="M28.4 38c1 7 5.5 13 11.6 13s10.6-6 11.6-13c-2 4-6.5 7-11.6 7s-9.6-3-11.6-7z" fill="#a8805e" opacity=".45"/>
  <path d="M27.6 33c-1.6 0-2.4 1.6-2 3.6s1.6 3 2.8 2.6M52.4 33c1.6 0 2.4 1.6 2 3.6s-1.6 3-2.8 2.6" fill="#d4a884"/>
  <path d="M29 42c1.4 10 5 15 11 15s9.6-5 11-15c-2.6 3.4-6.4 4.6-11 4.6s-8.4-1.2-11-4.6z" fill="#cfc9c0"/>
  <g class="av-eyes"><ellipse cx="34.5" cy="35" rx="1.6" ry="1.3" fill="#2a2018"/><ellipse cx="45.5" cy="35" rx="1.6" ry="1.3" fill="#2a2018"/><circle cx="35" cy="34.5" r=".45" fill="#fff" opacity=".8"/><circle cx="46" cy="34.5" r=".45" fill="#fff" opacity=".8"/></g>
  <path class="av-brows" d="M31.5 31.6l5-.8M43.5 30.8l5 .8" stroke="#8a8680" stroke-width="1.9" stroke-linecap="round"/>
  <path d="M40 36.5c-.8 2.2-1.4 3.6-.6 4.4.8.4 1.6.4 2.2 0" stroke="#a8805e" stroke-width="1" fill="none"/>
  <path d="M34.6 44.4c3-1.5 7.8-1.5 10.8 0" stroke="#aaa39a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path class="av-mouth-closed" d="M37 46.2c2 .6 4 .6 6 0" stroke="#7a4a3a" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <ellipse class="av-mouth-open" cx="40" cy="46.6" rx="2.6" ry="1.6" fill="#5a2a22"/>
  <path d="M26 28c0-8 6-12 14-12s14 4 14 12c-5-2-9-2.6-14-2.6S31 26 26 28z" fill="#5a4030"/>
  <path d="M25 28.4h30" stroke="#3a2a1e" stroke-width="2.4"/>
  <path d="M30 17c2-4 6-6 10-6s8 2 10 6" fill="#5a4030"/>
</g>
</svg>`;
