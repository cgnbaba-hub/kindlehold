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
};

/** Portrait key from a message (explicit key, or matched by the speaker's name). */
export function portraitKey(msg) {
  if (msg.portrait && Object.hasOwn(PORTRAITS, msg.portrait)) return msg.portrait;
  const n = String(msg.speaker || '').toLowerCase();
  for (const k of Object.keys(PORTRAITS)) if (n.includes(k)) return k;
  return null;
}
