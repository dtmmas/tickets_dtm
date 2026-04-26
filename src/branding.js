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
