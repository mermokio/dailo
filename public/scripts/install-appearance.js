(() => {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  const manifest = document.querySelector('link[rel="manifest"]');
  const lightManifest = manifest.getAttribute("href");

  function syncInstallAppearance() {
    // Keep the iOS touch icon static so the Home Screen can style the same artwork.
    manifest.href = darkMode.matches ? "./manifest-dark.webmanifest" : lightManifest;
  }

  syncInstallAppearance();
  darkMode.addEventListener("change", syncInstallAppearance);
})();
