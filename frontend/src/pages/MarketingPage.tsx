import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../lib/routes'

// ─── Pricing data ────────────────────────────────────────────────────────────

const PRICING: Record<string, { symbol: string; monthly: number; annual: number }> = {
  USD: { symbol: '$', monthly: 9, annual: 99 },
  GBP: { symbol: '£', monthly: 9, annual: 99 },
  EUR: { symbol: '€', monthly: 9, annual: 99 },
}

const CURRENCIES = ['USD', 'GBP', 'EUR'] as const

const PLAN_FEATURES = [
  'Guided morning briefing',
  'Visual day planner with timeline',
  'Built-in pomodoro timer',
  'GitHub-style activity streak grid',
  'Commission calculator',
  'Personal pledges & KPI targets',
  'Sales math forecasting',
  'Evening debrief & reflection',
  'Daily improvement loop',
  'Performance streaks & milestones',
]

// ─── Ticker tape items ───────────────────────────────────────────────────────

const TICKER_ITEMS = [
  'Morning Briefing',
  'Day Planner',
  'Pomodoro Timer',
  'Streak Grid',
  'Commission Calc',
  'Personal Pledges',
  'Sales Math',
  'Evening Debrief',
  'KPI Targets',
  'Daily Streaks',
]

// ─── Feature data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Morning Briefing',
    desc: "Review yesterday, plan today. Your morning briefing pulls in last night\u2019s debrief, shows unfinished work, and lets you commit to a clear plan before you pick up the phone. No more starting cold.",
    icon: '\u{1F4CB}',
  },
  {
    title: 'Day Planner & Pomodoro Timer',
    desc: "Drag and drop your calls, emails, and meetings onto a visual timeline. Then execute in focused pomodoro blocks \u2014 25 minutes on, 5 minutes rest. Built-in break reminders keep you sharp all day instead of burning out by 2pm.",
    icon: '\u{23F2}',
  },
  {
    title: 'Streak Grid & Personal Pledges',
    desc: "A GitHub-style contribution grid that tracks your daily activity streaks. Set personal pledges \u2014 50 dials a day, 3 meetings a week \u2014 and watch your consistency build over weeks and months. Miss a day and the grid shows it. Hit your streak and it glows.",
    icon: '\u{1F525}',
  },
  {
    title: 'Commission Calculator & Sales Math',
    desc: "Know your numbers. Plug in your base, OTE, and deal values to see exactly how many calls, meetings, and closes you need to hit target. Work backwards from your income goal to a daily action plan that makes the maths work.",
    icon: '\u{1F4B0}',
  },
  {
    title: 'Evening Debrief',
    desc: "End each day with a structured 5-minute reflection. What went well, what to improve, and your top three priorities for tomorrow. Your debrief feeds directly into the next morning\u2019s briefing \u2014 a daily loop that compounds into serious results.",
    icon: '\u{1F4DD}',
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('USD')
  const [isAnnual, setIsAnnual] = useState(true)
  const [navSolid, setNavSolid] = useState(false)
  const pricingRef = useRef<HTMLElement>(null)
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])
  const [visibleFeatures, setVisibleFeatures] = useState<boolean[]>(() => Array(FEATURES.length).fill(false))

  // Sticky nav background on scroll
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-reveal for feature blocks
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = featureRefs.current.indexOf(entry.target as HTMLDivElement)
          if (idx !== -1 && entry.isIntersecting) {
            setVisibleFeatures((prev) => {
              const next = [...prev]
              next[idx] = true
              return next
            })
          }
        })
      },
      { threshold: 0.15 }
    )
    featureRefs.current.forEach((ref) => ref && observer.observe(ref))
    return () => observer.disconnect()
  }, [])

  const prices = PRICING[currency]
  const displayPrice = isAnnual ? prices.annual : prices.monthly
  const priceSuffix = isAnnual ? '/year' : '/month'

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Duplicate ticker items for seamless loop
  const tickerContent = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <div className="min-h-screen bg-quest-bg font-body text-quest-text">

      {/* ── Navigation ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navSolid
            ? 'bg-quest-bg/95 backdrop-blur-md border-b border-quest-border/50'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-epic text-xl font-bold tracking-wide text-quest-gold">
            DESTINY
          </span>

          <nav className="hidden md:flex items-center gap-10">
            {['Features', 'Pricing'].map((item) => (
              <button
                key={item}
                onClick={() => {
                  document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-sm font-body font-medium text-quest-muted hover:text-quest-text transition-colors bg-transparent border-none cursor-pointer"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to={ROUTES.SIGNIN}
              className="text-sm font-semibold text-quest-muted hover:text-quest-text transition-colors no-underline"
            >
              Log In
            </Link>
            <Link
              to={ROUTES.SIGNUP}
              className="px-5 py-2.5 bg-quest-gold text-quest-bg font-epic text-xs font-bold uppercase tracking-widest no-underline hover:shadow-quest-glow-strong transition-shadow"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero (Video Background) ── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/hero-quest.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-quest-bg/60 via-quest-bg/20 to-quest-bg/80" />

        <div className="relative z-10 text-center px-6 max-w-[800px]">
          <h1
            className="font-epic text-5xl md:text-7xl lg:text-[72px] font-bold leading-[1.05] text-quest-text mb-6 drop-shadow-lg"
            style={{ textShadow: '0 0 40px rgba(212, 175, 55, 0.2)' }}
          >
            Plan Your Day.
            <br />
            Hit Your Number.
          </h1>

          <p className="font-body text-lg md:text-xl text-quest-muted max-w-[560px] mx-auto mb-10 leading-relaxed">
            The personal productivity planner for salespeople who take their income seriously. Five screens. Zero fluff.
          </p>

          <button
            onClick={scrollToPricing}
            className="inline-flex items-center gap-3 px-10 py-4 bg-quest-gold text-quest-bg font-epic text-base font-bold uppercase tracking-widest cursor-pointer border-none hover:shadow-quest-glow-strong transition-all duration-300 hover:scale-[1.02]"
          >
            Start Planning
          </button>
        </div>
      </section>

      {/* ── Ticker Tape Separator ── */}
      <div className="relative overflow-hidden bg-quest-gold/10 border-y border-quest-gold/20 py-3">
        <div className="flex animate-ticker whitespace-nowrap">
          {tickerContent.map((item, i) => (
            <span key={`${item}-${i}`} className="flex items-center gap-6 mx-6 shrink-0">
              <span className="font-epic text-sm font-bold uppercase tracking-widest text-quest-gold">
                {item}
              </span>
              <span className="text-quest-gold/40">&#9670;</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Content with fantasy background image ── */}
      <div
        className="relative bg-cover bg-center bg-fixed"
        style={{ backgroundImage: 'url(/images/quest-bg.png)' }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-quest-bg/85" />

        <div className="relative z-10">

          {/* ── Features ── */}
          <section id="features" className="py-24 md:py-32 px-6">
            <div className="max-w-[1080px] mx-auto">
              <div className="text-center mb-20">
                <h2 className="font-epic text-3xl md:text-5xl font-bold text-quest-text mb-4">
                  Five Screens. One Daily System.
                </h2>
                <p className="font-body text-lg text-quest-muted max-w-[560px] mx-auto">
                  Morning briefing to evening debrief. Pomodoro blocks, streak tracking, and the maths to make your number.
                </p>
              </div>

              <div className="space-y-20 md:space-y-28">
                {FEATURES.map((feature, i) => {
                  const isEven = i % 2 === 0
                  return (
                    <div
                      key={feature.title}
                      ref={(el) => { featureRefs.current[i] = el }}
                      className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center transition-all duration-700 ${
                        visibleFeatures[i]
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      <div className={isEven ? 'md:order-1' : 'md:order-2'}>
                        <h3 className="font-epic text-2xl md:text-3xl font-bold text-quest-text mb-4">
                          {feature.title}
                        </h3>
                        <p className="font-body text-base text-quest-muted leading-relaxed">
                          {feature.desc}
                        </p>
                      </div>

                      <div className={isEven ? 'md:order-2' : 'md:order-1'}>
                        <div className="w-full aspect-[5/4] bg-quest-surface/60 backdrop-blur-sm border border-quest-border/50 flex items-center justify-center">
                          <div
                            className="text-6xl"
                            style={{ filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))' }}
                          >
                            {feature.icon}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" ref={pricingRef} className="py-24 md:py-32 px-6">
            <div className="max-w-[600px] mx-auto text-center">
              <h2 className="font-epic text-3xl md:text-5xl font-bold text-quest-text mb-4">
                Simple, Honest Pricing
              </h2>
              <p className="font-body text-lg text-quest-muted mb-12">
                One plan. Everything included. No surprises.
              </p>

              {/* Annual / Monthly toggle */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <span className={`font-body text-sm font-medium ${!isAnnual ? 'text-quest-text' : 'text-quest-muted'}`}>
                  Monthly
                </span>
                <button
                  onClick={() => setIsAnnual(!isAnnual)}
                  className={`relative w-14 h-7 rounded-full border-none cursor-pointer transition-colors duration-200 ${
                    isAnnual ? 'bg-quest-gold' : 'bg-quest-border'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 rounded-full bg-quest-bg transition-transform duration-200 ${
                      isAnnual ? 'translate-x-7' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className={`font-body text-sm font-medium ${isAnnual ? 'text-quest-text' : 'text-quest-muted'}`}>
                  Annual
                </span>
                {isAnnual && (
                  <span className="font-epic text-[10px] font-bold uppercase tracking-widest text-quest-accent bg-quest-accent/10 px-2 py-1">
                    Save 8%
                  </span>
                )}
              </div>

              {/* Currency toggle */}
              <div className="flex items-center justify-center mb-10">
                <div className="inline-flex border border-quest-border overflow-hidden">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-4 py-2 text-xs font-epic font-bold tracking-wider border-none cursor-pointer transition-all duration-200 ${
                        currency === c
                          ? 'bg-quest-gold/10 text-quest-gold'
                          : 'bg-transparent text-quest-muted hover:text-quest-text'
                      }`}
                    >
                      {PRICING[c].symbol} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single pricing card */}
              <div className="bg-quest-surface/80 backdrop-blur-sm border border-quest-gold/30 p-10 shadow-quest-glow">
                <div className="mb-8">
                  <span className="font-epic text-6xl font-bold text-quest-text">
                    {prices.symbol}{displayPrice}
                  </span>
                  <span className="font-body text-lg text-quest-muted ml-2">{priceSuffix}</span>
                </div>

                <Link
                  to={ROUTES.SIGNUP}
                  className="block w-full py-4 bg-quest-gold text-quest-bg font-epic text-sm font-bold uppercase tracking-widest no-underline hover:shadow-quest-glow-strong transition-shadow mb-8"
                >
                  Start Your Free Trial
                </Link>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm font-body text-quest-muted">
                      <span className="text-quest-gold mt-0.5 shrink-0">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-body text-xs text-quest-muted mt-6">
                14-day free trial. No credit card required. Cancel anytime.
              </p>
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-[700px] mx-auto text-center">
              <h2
                className="font-epic text-4xl md:text-5xl font-bold text-quest-text mb-6"
                style={{ textShadow: '0 0 30px rgba(212, 175, 55, 0.15)' }}
              >
                Know Your Numbers. Own Your Day.
              </h2>
              <p className="font-body text-xl text-quest-muted mb-12 max-w-[480px] mx-auto">
                Five screens. Five minutes to plan. The rest of the day to execute.
              </p>
              <Link
                to={ROUTES.SIGNUP}
                className="inline-flex items-center gap-3 px-12 py-5 bg-quest-gold text-quest-bg font-epic text-base font-bold uppercase tracking-widest no-underline hover:shadow-quest-glow-strong transition-all duration-300 hover:scale-[1.02]"
              >
                Get Started Free
              </Link>
            </div>
          </section>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-quest-border/50 bg-[#050508] py-12 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <span className="font-epic text-lg font-bold text-quest-gold block mb-3">DESTINY</span>
              <p className="font-body text-sm text-quest-muted leading-relaxed">
                The personal sales planner that makes your daily maths work.
              </p>
            </div>
            <div>
              <h4 className="font-epic text-xs font-bold uppercase tracking-[0.15em] text-quest-text mb-4">Product</h4>
              <ul className="space-y-2 list-none p-0 m-0">
                {['Features', 'Pricing', 'Roadmap', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-body text-sm text-quest-muted hover:text-quest-text transition-colors no-underline">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-epic text-xs font-bold uppercase tracking-[0.15em] text-quest-text mb-4">Company</h4>
              <ul className="space-y-2 list-none p-0 m-0">
                {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-body text-sm text-quest-muted hover:text-quest-text transition-colors no-underline">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-epic text-xs font-bold uppercase tracking-[0.15em] text-quest-text mb-4">Legal</h4>
              <ul className="space-y-2 list-none p-0 m-0">
                {['Privacy', 'Terms', 'Security'].map((item) => (
                  <li key={item}>
                    <a href="#" className="font-body text-sm text-quest-muted hover:text-quest-text transition-colors no-underline">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-quest-border/30 pt-6 flex items-center justify-between flex-wrap gap-4">
            <span className="font-body text-xs text-quest-muted">
              &copy; 2025 Destiny Planner. All rights reserved.
            </span>
            <div className="flex gap-6">
              {['Twitter', 'LinkedIn'].map((item) => (
                <a key={item} href="#" className="font-body text-xs text-quest-muted hover:text-quest-text transition-colors no-underline">{item}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Ticker animation ── */}
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
      `}</style>
    </div>
  )
}
