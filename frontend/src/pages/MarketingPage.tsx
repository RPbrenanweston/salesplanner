import { Link } from 'react-router-dom'
import { ROUTES } from '../lib/routes'
import {
  Clock,
  List,
  FileText,
  TrendingUp,
  Target,
  BarChart2,
  Users,
  Mail,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'

const features = [
  {
    icon: Clock,
    name: 'SalesBlocks',
    description: 'Time-blocked calling sessions that keep you focused and dialling. No more distracted prospecting.',
  },
  {
    icon: List,
    name: 'Smart Lists',
    description: 'Organise contacts into targeted lists. Filter, segment, and prioritise your outreach.',
  },
  {
    icon: FileText,
    name: 'Call Scripts',
    description: 'Pre-built and custom scripts surfaced during live calls so you never fumble an objection.',
  },
  {
    icon: Mail,
    name: 'Email Templates',
    description: 'Send polished follow-ups instantly. Templates for every stage of your pipeline.',
  },
  {
    icon: TrendingUp,
    name: 'Pipeline',
    description: 'Visual deal tracking from first touch to close. Know exactly where every opportunity stands.',
  },
  {
    icon: Target,
    name: 'Goals',
    description: 'Set daily, weekly, and monthly targets. Stay accountable with progress tracking built in.',
  },
  {
    icon: BarChart2,
    name: 'Analytics',
    description: 'Call activity, conversion rates, and pipeline velocity — all in one dashboard.',
  },
  {
    icon: Users,
    name: 'Team',
    description: 'Manage your sales team, share scripts, and compare performance across reps.',
  },
]

const benefits = [
  'Make more calls in less time with structured SalesBlocks',
  'Never lose a lead with pipeline tracking',
  'Onboard new reps faster with shared scripts and templates',
  'Hit quota consistently with goal tracking and daily accountability',
]

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Nav */}
      <nav className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            SalesBlock.io
          </div>
          <div className="flex items-center gap-4">
            <Link
              to={ROUTES.PRICING}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              to={ROUTES.SIGNIN}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              to={ROUTES.SIGNUP}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
          The CRM built for{' '}
          <span className="text-blue-600 dark:text-blue-400">outbound sales</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          SalesBlock.io helps sales reps make more calls, manage their pipeline, and hit quota — every single week.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={ROUTES.SIGNUP}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-blue-600/25"
          >
            Start free trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to={ROUTES.SIGNIN}
            className="inline-flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-base font-semibold px-8 py-4 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Log In
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Free 14-day trial · No credit card required
        </p>
      </section>

      {/* Benefits */}
      <section className="bg-blue-50 dark:bg-blue-950/30 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Everything your team needs to close more deals
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
          Purpose-built tools for every step of the outbound sales process — from first call to signed contract.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {feature.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 dark:bg-blue-700 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to build a better sales rhythm?
          </h2>
          <p className="text-blue-100 mb-10 text-lg">
            Join sales teams who use SalesBlock.io to stay consistent, hit targets, and grow pipeline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={ROUTES.SIGNUP}
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 text-base font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors"
            >
              Start free trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to={ROUTES.PRICING}
              className="inline-flex items-center justify-center text-white border border-white/40 text-base font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            SalesBlock.io
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link to={ROUTES.PRICING} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Pricing
            </Link>
            <Link to={ROUTES.SIGNIN} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Log In
            </Link>
            <Link to={ROUTES.SIGNUP} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
