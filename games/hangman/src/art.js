// Original vector drawings; decorative because the same information is in text.
export function balloonArt(count = 8) {
  const points = [[43, 63], [76, 38], [111, 60], [145, 31], [180, 57], [213, 36], [247, 65], [148, 89]];
  const balloons = points.map(([x, y], i) => i < count ? `<g class="balloon b${i % 4}"><path d="M${x} ${y + 25} Q${x + 12} 145 147 175" class="string"/><ellipse cx="${x}" cy="${y}" rx="19" ry="25"/><path d="M${x - 3} ${y + 25}l3 -4 3 4z"/><path d="M${x - 8} ${y - 10}q-4 7 -3 11" class="shine"/></g>` : '').join('');
  return `<svg class="balloon-art ${count === 0 ? 'landed' : ''}" viewBox="0 0 292 244" aria-hidden="true" focusable="false"><path class="cloud" d="M12 124q0 -14 13 -14q6 -23 23 -9q18 -2 17 15q9 13 -8 13H20q-9 0 -8 -5m216 -9q0 -12 12 -12q9 -20 23 -7q16 -1 16 13q6 11 -6 11h-34q-12 0 -11 -5"/><path class="ground" d="M26 233q120 -18 240 0"/>${balloons}<g class="basket" transform="translate(0 ${count === 0 ? 14 : 0})"><path d="M125 159l-5 20m45 -20 5 20" class="string"/><path d="M116 178h58l-6 32h-46z"/><path d="M121 189h48m-45 11h43m-33 -20v29m13 -29v30m12 -30v29" class="weave"/><rect x="114" y="174" width="62" height="8" rx="4"/></g></svg>`;
}
const pictures = {
  animals: '<path d="M19 57V24l17 12q14 -8 28 0l17 -12v33q0 26 -31 26T19 57z"/><path d="M35 53h1m28 0h1M43 65l7 5 7 -5m-7 5v7"/>',
  food: '<path d="M50 32q-23 -16 -33 8t12 43q9 4 21 0q15 6 23 -2q27 -25 9 -43q-11 -13 -32 -6zm0 0q-4 -18 10 -22m-7 15q18 1 19 -12q-17 -3 -19 12"/>',
  nature: '<path d="M50 85V56m0 9L35 55m15 14 16 -13M25 58q-24 -15 -4 -31q-4 -22 20 -18q18 -16 28 4q28 -3 23 21q17 24 -10 29z"/>',
  school: '<path d="M13 21q18 -8 37 3q19 -11 37 -3v62q-20 -8 -37 0q-18 -8 -37 0zm37 3v59M23 36h17m-17 12h17m-17 12h17m20 -24h17m-17 12h17m-17 12h17"/>',
  home: '<path d="M12 45L50 12l38 33M22 37v48h56V37M43 85V60h17v25M29 48h9v10h-9"/>',
  colors: '<path d="M20 68L51 15l16 10 -31 53zM51 15l5 -9 16 10 -5 9M20 68l-2 19 18 -9m-14 -4 8 4"/><circle cx="74" cy="66" r="15"/><circle cx="49" cy="75" r="9"/>',
  transport: '<path d="M12 62V43h76v19M19 43l12 -22h35l15 22M48 23v20M12 62h76M20 53h7m46 0h7"/><circle cx="29" cy="66" r="10"/><circle cx="71" cy="66" r="10"/>',
  play: '<path d="M50 9l25 34 -25 28 -25 -28zM50 9v62M25 43h50M50 71q15 10 0 18m-5 -6 10 6"/>',
};
export function categoryArt(category) {
  return `<svg class="category-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${pictures[category] || pictures.play}</svg>`;
}
