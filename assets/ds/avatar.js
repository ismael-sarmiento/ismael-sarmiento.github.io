// Shared by every site on ismael-sarmiento.github.io (copied verbatim from IsAcademy js/avatar.js; IsAcademy will import this file).
// "Alan", the assistant avatar: a friendly flat illustration that resembles Ismael without being him.
// Skin tones come from CSS variables (--av-skin, --av-shade) so light and dark themes can differ.
// Animated with CSS: breathing (.av-head), blinking (.av-eyes) and talking (.av-mouth, toggled by .talking).
export function avatarSVG(id = 'av') {
  return `
<svg class="avatar-svg" viewBox="0 0 200 200" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#2e3c74"/><stop offset="1" stop-color="#121833"/>
    </radialGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2d18b"/><stop offset="1" stop-color="#c8953f"/>
    </linearGradient>
    <clipPath id="${id}-clip"><circle cx="100" cy="100" r="96"/></clipPath>
  </defs>
  <circle cx="100" cy="100" r="96" fill="url(#${id}-bg)"/>
  <g clip-path="url(#${id}-clip)"><g transform="translate(-14 -2) scale(1.14)">
    <!-- shirt -->
    <path d="M22 206 C30 168 62 152 100 152 C138 152 170 168 178 206 Z" fill="#1c2547" stroke="#0b1026" stroke-width="2"/>
    <path d="M84 152 L100 172 L116 152" fill="none" stroke="url(#${id}-gold)" stroke-width="3" stroke-linejoin="round"/>
    <g class="av-head">
      <!-- neck -->
      <path d="M86 128 V152 Q100 160 114 152 V128 Z" fill="var(--av-shade)"/>
      <!-- ears -->
      <ellipse cx="62" cy="98" rx="7.5" ry="11" fill="var(--av-skin)"/>
      <ellipse cx="138" cy="98" rx="7.5" ry="11" fill="var(--av-skin)"/>
      <path d="M60 94 q3 4 0 9 M140 94 q-3 4 0 9" fill="none" stroke="var(--av-shade)" stroke-width="2" stroke-linecap="round"/>
      <!-- face -->
      <path d="M64 92 C64 62 80 46 100 46 C120 46 136 62 136 92 C136 122 120 142 100 142 C80 142 64 122 64 92 Z" fill="var(--av-skin)"/>
      <path d="M126 70 C134 84 134 108 124 126 C130 112 131 92 126 70 Z" fill="var(--av-shade)" opacity=".35"/>
      <!-- short beard -->
      <path d="M66 102 C68 128 84 142 100 142 C116 142 132 128 134 102 C131 118 123 127 112 129 C106 125 94 125 88 129 C77 127 69 118 66 102 Z" fill="#1d1410"/>
      <!-- short curly hair -->
      <path d="M62 90 C58 58 78 38 102 38 C126 38 144 58 138 90 C134 76 126 66 114 62 C104 68 90 68 80 63 C70 68 64 78 62 90 Z" fill="#1d1410"/>
      <g fill="none" stroke="#3a2a22" stroke-width="1.6" stroke-linecap="round">
        <path d="M76 52 q4 -4 8 0"/><path d="M92 46 q4 -4 8 0"/><path d="M108 47 q4 -4 8 0"/><path d="M122 54 q4 -4 8 0"/>
        <path d="M84 58 q4 -4 8 0"/><path d="M100 55 q4 -4 8 0"/><path d="M116 59 q3 -3 6 0"/><path d="M70 64 q3 -3 6 0"/>
      </g>
      <!-- eyebrows -->
      <path d="M77 82 Q86 77 95 80" fill="none" stroke="#1d1410" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M105 80 Q114 77 123 82" fill="none" stroke="#1d1410" stroke-width="3.4" stroke-linecap="round"/>
      <!-- eyes -->
      <g class="av-eyes">
        <ellipse cx="86" cy="93" rx="4.6" ry="4.6" fill="#efe6da"/><circle cx="86" cy="93.6" r="3.3" fill="#1d1410"/><circle cx="87" cy="92.6" r=".9" fill="#fff"/>
        <ellipse cx="114" cy="93" rx="4.6" ry="4.6" fill="#efe6da"/><circle cx="114" cy="93.6" r="3.3" fill="#1d1410"/><circle cx="115" cy="92.6" r=".9" fill="#fff"/>
      </g>
      <!-- nose -->
      <path d="M100 96 Q95 108 101 110" fill="none" stroke="var(--av-shade)" stroke-width="2.4" stroke-linecap="round"/>
      <!-- moustache and smile -->
      <path d="M86 116 Q100 109 114 116" fill="none" stroke="#1d1410" stroke-width="4" stroke-linecap="round"/>
      <g class="av-mouth">
        <path class="av-smile" d="M92 121.5 Q100 127.5 108 121.5 Q100 124.5 92 121.5 Z" fill="#efe6da" stroke="#efe6da" stroke-width="1.2" stroke-linejoin="round"/>
        <ellipse class="av-open" cx="100" cy="123" rx="6" ry="4" fill="#4a1e14" stroke="#fbf7ef" stroke-width="1.4"/>
      </g>
    </g>
  </g></g>
  <circle cx="100" cy="100" r="96" fill="none" stroke="url(#${id}-gold)" stroke-width="3"/>
</svg>`;
}
