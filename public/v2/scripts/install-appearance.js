(() => {
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  const manifest = document.querySelector('link[rel="manifest"]');
  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  const lightManifest = manifest.getAttribute("href");
  const lightIcon = touchIcon.getAttribute("href");

  function syncInstallAppearance() {
    manifest.href = darkMode.matches ? "./manifest-dark.webmanifest" : lightManifest;
    touchIcon.href = darkMode.matches ? "./assets/dark/install-icon-180.png" : lightIcon;
  }

  syncInstallAppearance();
  darkMode.addEventListener("change", syncInstallAppearance);
})();
