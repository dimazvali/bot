
/**
 * Simple hash function to convert a string into a 32-bit integer.
 */
export const stringToSeed = (str: string): number => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Converts a string to a hexadecimal display hash based on the seed.
 */
export const stringToDisplayHash = (str: string): string => {
  const seed = stringToSeed(str);
  return '0x' + seed.toString(16).toUpperCase().padStart(8, '0');
};

/**
 * Parses a hex signature (0x...) back into a numeric seed.
 */
export const signatureToSeed = (sig: string): number => {
  const clean = sig.replace(/^0x/i, '');
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0 : Math.abs(parsed | 0);
};

/**
 * Encodes a string into a reversible base64 code with Unicode support.
 */
export const encodeMessage = (str: string): string => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (e) {
    return "";
  }
};

/**
 * Decodes a base64 code back into the original string.
 */
export const decodeMessage = (code: string): string => {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(code), (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return "";
  }
};

/**
 * A simple seeded pseudo-random number generator.
 */
export const createPRNG = (seed: number) => {
  let currentSeed = seed;
  return {
    next: () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    }
  };
};
