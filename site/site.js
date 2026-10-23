;(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]

  const VIEWS = {
    phone: { plate: 'p1', title: 'Phone · 390 px' },
    laptop: { plate: 'pl-workout', title: 'Laptop · 1440 px' },
  }

  const frame = $('#demoFrame')
  const stage = $('.demo-stage')
  const open = $('#demoOpen')
  const title = $('#demoTitle')
  let view = 'phone'
  let pending = VIEWS.phone.plate

  const frameReady = () => {
    const doc = frame.contentDocument
    return doc && doc.readyState === 'complete' && doc.location.href !== 'about:blank'
  }

  const scrollFrame = () => {
    if (!frameReady()) return
    const doc = frame.contentDocument
    const label = doc.getElementById(pending)
    if (!label) return
    const target = label.closest('section') ?? label
    const win = frame.contentWindow
    win.scrollTo({
      top: target.getBoundingClientRect().top + win.scrollY - 12,
      behavior: 'instant',
    })
  }

  const showPlate = (plate) => {
    view = plate.startsWith('pl-') ? 'laptop' : 'phone'
    pending = plate
    stage.dataset.view = view
    title.textContent = VIEWS[view].title
    open.href = `demo/index.html#${plate}`
    $$('.demo-tabs button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.view === view)),
    )
    if (frame.loading === 'lazy') frame.loading = 'eager'
    requestAnimationFrame(scrollFrame)
    setTimeout(scrollFrame, 350)
  }

  frame.addEventListener('load', scrollFrame)
  $$('.demo-tabs button').forEach((b) =>
    b.addEventListener('click', () => showPlate(VIEWS[b.dataset.view].plate)),
  )
  $$('[data-plate]').forEach((el) =>
    el.addEventListener('click', () => showPlate(el.dataset.plate)),
  )
  $('#demoReset').addEventListener('click', () => {
    pending = VIEWS[view].plate
    open.href = `demo/index.html#${pending}`
    frame.contentWindow.history.scrollRestoration = 'manual'
    frame.contentWindow.location.reload()
  })

  const copyBtn = $('#copyUrl')
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('https://gym-tracker-ten-gamma.vercel.app')
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
    $$('.feature, .tut > li, .dl-card, .pipe').forEach((el) => {
      el.classList.add('reveal')
      io.observe(el)
    })
  }
})()
