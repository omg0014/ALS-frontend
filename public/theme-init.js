// Sets the light/dark look before the page is drawn, so it never flashes. Kept in sync by src/lib/theme.js.
// A separate file (not inline) because the server's Content-Security-Policy blocks inline scripts.
;(function () {
  var choice = null
  try {
    choice = localStorage.getItem('acls.theme')
  } catch (e) {
    /* storage unavailable */
  }
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
})()
