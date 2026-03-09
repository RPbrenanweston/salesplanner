/**
 * @crumb
 * @id frontend-page-marketing
 * @area UI/Marketing
 * @intent Public marketing landing page — hero with canvas scroll animation (160-frame laptop explosion sequence), feature cards, philosophy section, and conversion CTAs
 * @responsibilities Render full-page marketing site (no auth); manage 160-frame canvas scroll animation; preload all JPEG frames on mount; map scrollProgress to frame index + rotation; show CTA links to /signup /signin /pricing
 * @contracts MarketingPage() → JSX; reads /frames/frame-XXXX.jpg (160 static assets); links to ROUTES.SIGNUP, ROUTES.SIGNIN, ROUTES.PRICING via React Router
 * @in /public/frames/frame-0001.jpg … frame-0160.jpg (160 JPEG frames), ROUTES constants from lib/routes, React Router Link
 * @out Full-page marketing site visible at "/" to all unauthenticated visitors; canvas animation at 16:9 aspect ratio inside hero; 400vh scroll section pinning canvas during animation
 * @err If frames fail to load, canvas stays blank (no fallback image or error state); if ROUTES is missing a key, Link href is undefined (silent broken link)
 * @hazard All 160 JPEG frames are loaded eagerly via new Image() on mount — spikes network on slow connections; no IntersectionObserver or lazy-load gating
 * @hazard Canvas resize uses window "resize" event listener — ResizeObserver on the canvas element would be more accurate for layout-shift edge cases
 * @hazard scrollProgress computed from window.scrollY — does not account for dynamic header heights; pinned section top must match fixed offset (currently 0)
 * @shared-edges frontend/src/lib/routes.ts→READS ROUTES; frontend/public/frames/→READS 160 static JPEGs; frontend/src/pages/PricingPage.tsx→LINKS TO; frontend/src/pages/SignUp.tsx→LINKS TO; frontend/src/pages/SignIn.tsx→LINKS TO
 * @trail marketing#1 | Visitor lands on "/" → frames preload → scroll animation activates → scroll section unpins → feature cards visible → CTA links to /signup or /pricing
 * @prompt Add IntersectionObserver to gate frame preloading until hero section enters viewport; add <noscript> fallback image for SEO; consider extracting canvas animation into a reusable hook
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../lib/routes'

// ─── Design tokens ───────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(99, 102, 241, 0.1)',
  boxShadow: 'inset 0 0 20px rgba(99, 102, 241, 0.02)',
}

const velocityGradient: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #0db9f2 100%)',
}

// ─── Scroll section data ──────────────────────────────────────────────────────

const PHASES = [
  { rangeStart: 0.05, rangeEnd: 0.28 },
  { rangeStart: 0.25, rangeEnd: 0.52 },
  { rangeStart: 0.49, rangeEnd: 0.73 },
  { rangeStart: 0.70, rangeEnd: 0.96 },
]

const CARDS = [
  {
    side: 'left' as const,
    icon: 'timer',
    title: 'The Power Block',
    desc: 'Deep-work focus sessions designed to eliminate context switching. Execute prospect lists with 100% focused energy.',
    badge1: 'AUTOPILOT: ON',
    badge2: 'LATENCY: 4ms',
  },
  {
    side: 'right' as const,
    icon: 'manage_search',
    title: 'Research Lab',
    desc: 'Instant ICP intelligence. Find high-intent signals before your competition does.',
    badge1: 'SIGNALS: LIVE',
  },
  {
    side: 'left' as const,
    icon: 'map',
    title: 'Mission Planner',
    desc: 'High-velocity manual cadences for surgical outreach. Precision over spray-and-pray.',
    badge1: 'CADENCE: ACTIVE',
  },
  {
    side: 'right' as const,
    icon: 'leaderboard',
    title: 'The Arena',
    desc: 'Live gamification that turns daily prospecting into an elite competition. Real-time visibility that fuels momentum.',
    badge1: 'LIVE: 12 REPS',
  },
]


const PROSPECTS = [
  { name: 'Sarah Chen', company: 'Stripe', status: 'CALLING', active: true, hue: 220 },
  { name: 'Marcus Webb', company: 'Rippling', status: 'QUEUED', active: false, hue: 280 },
  { name: 'Priya Sharma', company: 'Linear', status: 'QUEUED', active: false, hue: 170 },
  { name: 'Tom Bradley', company: 'Vercel', status: 'SKIP', active: false, hue: 30 },
  { name: 'Elena Ross', company: 'Figma', status: 'QUEUED', active: false, hue: 330 },
]

const SIDEBAR_ICONS = ['rocket_launch', 'timer', 'manage_search', 'map', 'leaderboard', 'bar_chart']

// ─── Canvas scroll animation ──────────────────────────────────────────────────

const TOTAL_FRAMES = 160
const FRAME_PATH = (i: number) => `/frames/frame-${String(i).padStart(4, '0')}.jpg`

function drawOnCanvas(canvas: HTMLCanvasElement, img: HTMLImageElement, progress: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cw = canvas.width
  const ch = canvas.height
  const bw = img.naturalWidth || img.width
  const bh = img.naturalHeight || img.height
  if (!bw || !bh) return
  const deg = -4 + progress * 12
  const rad = (deg * Math.PI) / 180
  const scale = Math.max(cw / bw, ch / bh)
  ctx.clearRect(0, 0, cw, ch)
  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, (-bw * scale) / 2, (-bh * scale) / 2, bw * scale, bh * scale)
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const scrollSectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<(HTMLImageElement | null)[]>(Array(TOTAL_FRAMES).fill(null))
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeCards, setActiveCards] = useState([false, false, false, false])

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const sync = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  // ── Frame preloading ──────────────────────────────────────────────────────
  useEffect(() => {
    const frames = framesRef.current

    // Load first frame immediately so canvas shows something on arrival
    const first = new Image()
    first.onload = () => {
      frames[0] = first
      const canvas = canvasRef.current
      if (canvas) drawOnCanvas(canvas, first, 0)
    }
    first.src = FRAME_PATH(1)

    // Load the rest asynchronously
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const idx = i
      const img = new Image()
      img.onload = () => { frames[idx] = img }
      img.src = FRAME_PATH(idx + 1)
    }
  }, [])

  // ── Draw on scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.round(scrollProgress * (TOTAL_FRAMES - 1)))
    const img = framesRef.current[frameIdx]
    if (img) drawOnCanvas(canvas, img, scrollProgress)
  }, [scrollProgress])

  useEffect(() => {
    const handleScroll = () => {
      const section = scrollSectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const scrollable = section.offsetHeight - window.innerHeight
      if (scrollable <= 0) return
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable))
      setScrollProgress(progress)
      setActiveCards(PHASES.map(({ rangeStart, rangeEnd }) => progress >= rangeStart && progress <= rangeEnd))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8fafc', color: '#1e293b', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'white', fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            </div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}>
              Salesblock<span style={{ color: '#6366f1' }}>.io</span>
            </span>
          </div>

          {/* Nav links (hidden on mobile) */}
          <nav className="sb-nav-links">
            {['Product', 'Solutions', 'Philosophy', 'Pricing'].map(item => (
              <a key={item} href="#" style={{ fontSize: 14, fontWeight: 500, color: '#475569', textDecoration: 'none' }}>{item}</a>
            ))}
          </nav>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to={ROUTES.SIGNIN} style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', textDecoration: 'none' }}>Log In</Link>
            <Link to={ROUTES.SIGNUP} style={{
              background: '#6366f1', color: 'white',
              padding: '10px 20px', borderRadius: 8,
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
            }}>Enter the Cockpit</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ padding: 'clamp(3rem,8vw,6rem) 1.5rem clamp(2rem,6vw,4rem)', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sb-hero-grid">

            {/* Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, zIndex: 1 }}>

              {/* Pulsing badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content',
                borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)',
                background: 'rgba(99,102,241,0.05)', padding: '4px 12px',
              }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                  <span className="sb-ping" style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: '#6366f1', opacity: 0.75,
                  }} />
                  <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'block' }} />
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6366f1' }}>
                  v2.4 Live: High-Velocity Engine
                </span>
              </div>

              <h1 style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
                fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.025em',
                color: '#0f172a', margin: 0,
              }}>
                The System of Action for{' '}
                <span style={{ color: '#6366f1' }}>High-Velocity</span> Sales
              </h1>

              <p style={{ fontSize: 18, lineHeight: 1.65, color: '#475569', maxWidth: 480, margin: 0 }}>
                Stop recording data. Start driving revenue. The cockpit for elite sales teams to execute at light speed without the CRM friction.
              </p>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link to={ROUTES.SIGNUP} style={{
                  ...velocityGradient,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '1rem 2rem', borderRadius: 12,
                  fontSize: 18, fontWeight: 700, color: 'white', textDecoration: 'none',
                  boxShadow: '0 20px 40px -8px rgba(99,102,241,0.4)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  Enter the Cockpit
                </Link>
                <button style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '1rem 2rem', borderRadius: 12,
                  fontSize: 18, fontWeight: 700, color: '#0f172a',
                  background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer',
                }}>
                  View Demo
                </button>
              </div>
            </div>

            {/* Dashboard preview — 16:9 video preview style */}
            <div style={{ position: 'relative' }}>
              {/* Gradient halo blur */}
              <div style={{
                position: 'absolute', inset: -8, borderRadius: 24,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #0db9f2)',
                opacity: 0.22, filter: 'blur(32px)',
              }} />

              {/* 16:9 aspect-video container */}
              <div style={{
                position: 'relative', width: '100%', paddingTop: '56.25%',
                borderRadius: 16, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              }}>
                {/* Dashboard UI — absolutely fills the 16:9 frame */}
                <div style={{ position: 'absolute', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
                  {/* Browser chrome */}
                  <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#ff5f57', '#febb2d', '#28c840'].map(c => (
                        <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: 5,
                        padding: '2px 18px', fontSize: 10,
                        fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.3)',
                      }}>salesblock.io/cockpit</div>
                    </div>
                  </div>

                  {/* Dashboard body */}
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: 44, background: '#0d1829', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      {SIDEBAR_ICONS.map((icon, i) => (
                        <div key={icon} style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: i === 0 ? 'rgba(99,102,241,0.25)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: i === 0 ? '#6366f1' : 'rgba(255,255,255,0.2)' }}>{icon}</span>
                        </div>
                      ))}
                    </div>

                    {/* Main */}
                    <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                      {/* Metric strip */}
                      <div style={{ display: 'flex', gap: 7 }}>
                        {[{ l: 'CALLS', v: '47', c: '#6366f1' }, { l: 'CONNECTS', v: '12', c: '#8b5cf6' }, { l: 'PIPELINE', v: '$84K', c: '#0db9f2' }].map(({ l, v, c }) => (
                          <div key={l} style={{ flex: 1, background: `${c}10`, border: `1px solid ${c}20`, borderRadius: 7, padding: '5px 9px' }}>
                            <div style={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>{l}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: c, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Prospect rows */}
                      {PROSPECTS.map(({ name, company, status, active, hue }) => (
                        <div key={name} style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '4px 7px', borderRadius: 6,
                          background: active ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: `hsl(${hue}, 65%, 55%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 700, color: 'white',
                          }}>{name[0]}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'JetBrains Mono, monospace', flex: 1 }}>{name} · {company}</div>
                          <div style={{
                            fontSize: 8, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 4,
                            color: active ? '#6366f1' : 'rgba(255,255,255,0.2)',
                            background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                          }}>{status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Play overlay — centered over the full 16:9 frame */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(15,23,42,0.2)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'rgba(99,102,241,0.5)', fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: 'white', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sb-metrics-grid">
            {[
              { value: '+40%', label: 'Pipeline Velocity', color: '#6366f1' },
              { value: '2x',   label: 'Rep Engagement',   color: '#6366f1' },
              { value: '14ms', label: 'Action Latency',   color: '#0f172a' },
              { value: '99%',  label: 'Data Hygiene',     color: '#0db9f2' },
            ].map(({ value, label, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Section Header ── */}
      <div style={{ textAlign: 'center', padding: '4rem 1.5rem 0', background: '#f8fafc' }}>
        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
          Engineered for Peak Performance
        </h2>
        <p style={{ fontSize: 18, color: '#475569', maxWidth: 512, margin: '0 auto' }}>
          The first workspace that prioritizes flow-state for sales professionals.
        </p>
      </div>

      {/* ── Scroll Frame Section ── */}
      <div ref={scrollSectionRef} style={{ height: '400vh', position: 'relative', marginTop: '2rem' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>

          {/* Progress bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, height: 3, zIndex: 10,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            width: `${scrollProgress * 100}%`,
            transition: 'width 0.08s linear',
          }} />

          {/* Canvas scroll animation */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />

          {/* Feature cards */}
          {CARDS.map((card, i) => {
            const isActive = activeCards[i]
            const isLeft = card.side === 'left'
            return (
              <div key={card.title} style={{
                position: 'absolute',
                [isLeft ? 'left' : 'right']: '4%',
                top: '50%',
                transform: `translateY(-50%) translateX(${isActive ? 0 : (isLeft ? -60 : 60)}px)`,
                width: 280, maxWidth: '36vw',
                opacity: isActive ? 1 : 0,
                transition: 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
                zIndex: 5,
                borderRadius: 16, padding: 24,
                ...glassCard,
                border: isActive ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(99,102,241,0.1)',
                boxShadow: isActive ? '0 0 40px rgba(99,102,241,0.15), inset 0 0 20px rgba(99,102,241,0.02)' : 'none',
                pointerEvents: isActive ? 'auto' : 'none',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, marginBottom: 16,
                  background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {card.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                    color: '#6366f1', background: 'rgba(99,102,241,0.1)',
                    padding: '3px 8px', borderRadius: 4,
                  }}>{card.badge1}</span>
                  {card.badge2 && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#94a3b8' }}>
                      {card.badge2}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

        </div>
      </div>

      {/* ── Philosophy ── */}
      <section style={{ padding: 'clamp(3rem,6vw,6rem) 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ ...velocityGradient, padding: 4, borderRadius: 24 }}>
            <div style={{ background: 'white', borderRadius: 22, padding: 'clamp(2rem,5vw,4rem)' }}>
              <div className="sb-philosophy-grid">

                {/* Copy */}
                <div>
                  <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 900, color: '#0f172a', margin: '0 0 24px', lineHeight: 1.15 }}>
                    System of Action <br />
                    <span style={{ color: '#6366f1' }}>vs. System of Record</span>
                  </h2>
                  <p style={{ fontSize: 18, color: '#475569', lineHeight: 1.7, margin: 0 }}>
                    Traditional CRMs were built for managers to report on history. Salesblock was built for reps to create the future.<br /><br />
                    One is a graveyard for data; the other is an engine for execution. It's time to stop reporting and start performing.
                  </p>
                  <button style={{
                    marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 8,
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700,
                    color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    Read the Philosophy Manifesto
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                  </button>
                </div>

                {/* Comparison table */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Legacy */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
                    <h4 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', margin: '0 0 16px' }}>Legacy CRM</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {['Manual Entry', 'Slow Interface', 'Admin Focus'].map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#94a3b8', textDecoration: 'line-through' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, textDecoration: 'none' }}>close</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Salesblock */}
                  <div style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)', borderRadius: 16, padding: 24 }}>
                    <h4 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6366f1', margin: '0 0 16px' }}>Salesblock</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {['Auto-Capture', 'Sub-ms Flow', 'Rep-Centric'].map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ position: 'relative', padding: 'clamp(3rem,6vw,6rem) 1.5rem', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#0f172a' }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.1,
            backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 896, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: 'white', margin: '0 0 24px' }}>
            Ready for Takeoff?
          </h2>
          <p style={{ fontSize: 20, color: '#64748b', margin: '0 0 40px' }}>
            Join 500+ elite sales organizations moving at the speed of light.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Link to={ROUTES.SIGNUP} style={{
              ...velocityGradient,
              padding: '1.25rem 2.5rem', borderRadius: 12,
              fontSize: 20, fontWeight: 700, color: 'white', textDecoration: 'none',
              boxShadow: '0 20px 40px -8px rgba(99,102,241,0.45)',
              display: 'inline-block',
            }}>
              Claim Your Cockpit
            </Link>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#475569' }}>
              Waitlist: <span style={{ color: '#0db9f2' }}>Active</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #e2e8f0', background: 'white', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 4, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'white', fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            </div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Salesblock.io</span>
          </div>
          <div style={{ display: 'flex', gap: 32, fontSize: 14, fontWeight: 500 }}>
            {['Twitter', 'LinkedIn', 'Privacy', 'Terms'].map(item => (
              <a key={item} href="#" style={{ color: '#64748b', textDecoration: 'none' }}>{item}</a>
            ))}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#94a3b8' }}>
            © 2025 SB_ACTION_SYSTEM
          </div>
        </div>
      </footer>

      {/* ── Global styles ── */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        .sb-ping {
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .sb-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
        }
        .sb-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2rem;
        }
        .sb-philosophy-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: center;
        }
        .sb-nav-links {
          display: flex;
          gap: 2.5rem;
          align-items: center;
        }
        @media (max-width: 768px) {
          .sb-hero-grid { grid-template-columns: 1fr; }
          .sb-metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .sb-philosophy-grid { grid-template-columns: 1fr; }
          .sb-nav-links { display: none; }
        }
      `}</style>

    </div>
  )
}
