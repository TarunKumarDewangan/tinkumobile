// One admin-chosen starting letter auto-generates the full 0-9 digit->letter map by
// simply counting forward through the alphabet (wrapping past Z), e.g. start "A":
// 0=A 1=B 2=C 3=D 4=E 5=F 6=G 7=H 8=I 9=J, so MOP ₹12999 becomes "BCJJJ".
// The code is always computed live from the current selling_price — never stored
// per-product — so editing a product's MOP and changing the start letter both stay in sync.

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function isValidStartLetter(letter) {
  return /^[A-Z]$/.test((letter || '').toUpperCase());
}

export function buildCipherMap(startLetter) {
  if (!isValidStartLetter(startLetter)) return null;
  const start = ALPHA.indexOf(startLetter.toUpperCase());
  const map = {};
  for (let d = 0; d <= 9; d++) {
    map[d] = ALPHA[(start + d) % 26];
  }
  return map;
}

export function priceToCipher(price, startLetter) {
  const map = buildCipherMap(startLetter);
  if (!map) return null;
  const digits = Math.round(Number(price) || 0).toString().split('');
  return digits.map(d => map[Number(d)]).join('');
}
