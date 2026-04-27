export const applyFavicon = (faviconUrl) => {
  if (typeof document === 'undefined') return;
  if (!faviconUrl) return;

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    document.head.appendChild(link);
  }

  link.setAttribute('href', faviconUrl);
};

export const DEFAULT_BRAND = {
  primary: 'rgb(79, 70, 229)',
  soft: 'rgba(79, 70, 229, 0.10)',
  softer: 'rgba(79, 70, 229, 0.18)',
  deep: 'rgb(55, 48, 163)',
  glowA: 'rgba(79, 70, 229, 0.22)',
  glowB: 'rgba(6, 182, 212, 0.14)',
  textOnPrimary: '#ffffff'
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rgbToString = (r, g, b) => `rgb(${r}, ${g}, ${b})`;
const rgbaToString = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;

const getContrastText = (r, g, b) => {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
};

export const buildBrandPalette = (r, g, b) => {
  const safeR = clamp(Math.round(r), 0, 255);
  const safeG = clamp(Math.round(g), 0, 255);
  const safeB = clamp(Math.round(b), 0, 255);

  return {
    primary: rgbToString(safeR, safeG, safeB),
    soft: rgbaToString(safeR, safeG, safeB, 0.10),
    softer: rgbaToString(safeR, safeG, safeB, 0.18),
    deep: rgbToString(
      clamp(Math.round(safeR * 0.72), 0, 255),
      clamp(Math.round(safeG * 0.72), 0, 255),
      clamp(Math.round(safeB * 0.72), 0, 255)
    ),
    glowA: rgbaToString(safeR, safeG, safeB, 0.20),
    glowB: rgbaToString(
      clamp(Math.round((safeR + 255) / 2), 0, 255),
      clamp(Math.round((safeG + 255) / 2), 0, 255),
      clamp(Math.round((safeB + 255) / 2), 0, 255),
      0.12
    ),
    textOnPrimary: getContrastText(safeR, safeG, safeB)
  };
};

export const extractBrandFromImage = (imageUrl) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || !imageUrl) {
      resolve(DEFAULT_BRAND);
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(DEFAULT_BRAND);
          return;
        }

        const width = 48;
        const height = Math.max(1, Math.round((image.height / Math.max(image.width, 1)) * width));
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);

        const { data } = context.getImageData(0, 0, width, height);
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 16) {
          const alpha = data[i + 3];
          if (alpha < 120) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);

          if (brightness > 242 || saturation < 12) continue;

          totalR += r;
          totalG += g;
          totalB += b;
          count += 1;
        }

        if (count === 0) {
          resolve(DEFAULT_BRAND);
          return;
        }

        resolve(buildBrandPalette(totalR / count, totalG / count, totalB / count));
      } catch (_) {
        resolve(DEFAULT_BRAND);
      }
    };

    image.onerror = () => resolve(DEFAULT_BRAND);
    image.src = imageUrl;
  });
