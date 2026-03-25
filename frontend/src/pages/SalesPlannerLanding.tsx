import { Link } from 'react-router-dom'
import { ArrowRight, Sunrise, CalendarDays, Timer, FileText, BookOpen } from 'lucide-react'

const features = [
  {
    icon: Sunrise,
    title: 'Morning Briefing',
    description: 'Start every day with clarity. Review yesterday, commit to today.',
  },
  {
    icon: CalendarDays,
    title: 'Day Planner',
    description: 'Time-block your outreach. Drag, drop, and own your schedule.',
  },
  {
    icon: Timer,
    title: 'Focus Sessions',
    description: 'Timed execution blocks. Contact queue. Zero distractions.',
  },
  {
    icon: FileText,
    title: 'Activity Feed',
    description: 'See everything you did today. Proof of work, not busywork.',
  },
  {
    icon: BookOpen,
    title: 'Daily Debrief',
    description: 'Reflect, learn, set tomorrow\'s priorities. Close the loop.',
  },
]

export default function SalesPlannerLanding() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-display font-bold text-indigo-400">SalesPlanner</span>
          <div className="flex items-center gap-4">
            <Link
              to="/signin"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight mb-6">
          The day planner<br />
          <span className="text-indigo-400">built for sellers</span>
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
          Stop organizing and start selling. SalesPlanner gives you a focused daily workflow —
          briefing, planning, execution, and reflection — so you always know what to do next.
        </p>
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-lg font-semibold transition-colors"
        >
          Start planning your day
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Daily Loop */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-12">
          Your complete daily workflow
        </h2>
        <div className="grid md:grid-cols-5 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="relative bg-white/5 border border-white/10 rounded-xl p-5 text-center"
            >
              {i < features.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-white/20">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
              <feature.icon className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-16 text-center">
        <h2 className="text-2xl font-display font-bold mb-4">
          Focus is the key currency in a world of more.
        </h2>
        <p className="text-white/50 mb-8">Free to use. No credit card required.</p>
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors"
        >
          Get started
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/30">
        SalesPlanner by <a href="https://salesblock.io" className="text-white/50 hover:text-white">SalesBlock</a>
      </footer>
    </div>
  )
}
