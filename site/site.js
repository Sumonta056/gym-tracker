;(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]

  const tabs = $$('.tab-list [role="tab"]')
  const showTab = (index, focus) => {
    tabs.forEach((tab, i) => {
      const on = i === index
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !on
      if (on && focus) tab.focus()
    })
  }
  const ua = navigator.userAgent
  const guess =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'ios'
      : /Android/.test(ua)
        ? 'android'
        : /Macintosh/.test(ua) && /Version\/\d+.*Safari/.test(ua)
          ? 'mac'
          : 'desktop'
  showTab(
    Math.max(
      0,
      tabs.findIndex((t) => t.id === `tab-${guess}`),
    ),
  )
  tabs.forEach((tab, i) => tab.addEventListener('click', () => showTab(i)))
  $('.tab-list').addEventListener('keydown', (e) => {
    const cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')
    const next = {
      ArrowRight: (cur + 1) % tabs.length,
      ArrowLeft: (cur + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key]
    if (next === undefined) return
    e.preventDefault()
    showTab(next, true)
  })

  const copyBtn = $('#copyUrl')
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('https://gym-tracker-ten-gamma.vercel.app/')
      copyBtn.textContent = 'Copied'
    } catch {
      copyBtn.textContent = 'Select and copy'
    }
    setTimeout(() => (copyBtn.textContent = 'Copy the address'), 1600)
  })

  const zoom = $('#zoom')
  const zoomImg = $('img', zoom)
  document.addEventListener('click', (e) => {
    const t = e.target.closest('img[data-zoom]')
    if (!t) return
    zoomImg.src = t.currentSrc || t.src
    zoomImg.alt = t.alt
    zoom.showModal()
  })
  zoom.addEventListener('click', () => zoom.close())

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          en.target.classList.add('in')
          io.unobserve(en.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    $$('.feature, .pipe, .get li').forEach((el) => {
      el.classList.add('reveal')
      io.observe(el)
    })
  }
})()
