export interface ThemeColors {
  /** Main action/brand color (e.g. button bg, active nav, links) */
  primary: string
  /** Muted/hover variant of primary */
  primaryDim: string
  /** Page/app background */
  bg: string
  /** Card and panel background */
  surface: string
  /** Secondary/deeper surface (sidebar, modals) */
  surfaceAlt: string
  /** Primary text color */
  text: string
  /** Secondary/muted text */
  textMuted: string
  /** Secondary accent (neon, highlight badges) */
  accent: string
  /** Tertiary accent */
  accent2: string
  /** Border color */
  border: string
  /** Destructive/error color */
  danger: string
  /** Success/positive color */
  success: string
}

export interface ThemeFonts {
  /** Heading/display font name (used in CSS font-family) */
  display: string
  /** Body font name */
  body: string
  /** Google Fonts embed URL — injected into <head> at runtime */
  googleFontsUrl: string
}

export interface ThemeFeatures {
  // ── Core planner features ──────────────────────────────────
  /** Focus/work sessions (was "SalesBlocks") */
  sessions: boolean
  /** People/contacts list */
  contacts: boolean
  /** Accounts/companies list */
  accounts: boolean
  /** Script/template editor */
  scripts: boolean
  /** Email templates */
  emailTemplates: boolean
  /** Pipeline view */
  pipeline: boolean
  /** Goals tracking */
  goals: boolean
  /** Analytics dashboard */
  analytics: boolean
  /** Team management */
  team: boolean
  /** Activity feed on dashboard */
  activityFeed: boolean

  // ── Theme-specific feature pages ───────────────────────────
  /** Daily reflection / journal prompt (Stoic, Manifestation) */
  dailyReflection: boolean
  /** Affirmations board (Manifestation) */
  affirmations: boolean
  /** Star sign / horoscope dashboard (Star Sign) */
  horoscope: boolean
  /** Hyperfocus deep-work timer (ADHD) */
  hyperfocusTimer: boolean
  /** Workout session log (Athlete) */
  workoutLog: boolean
  /** Weight & measurement tracker (Weight Loss) */
  weightTracker: boolean
  /** Caregiver schedule & notes log (Caring for Others) */
  caregiverLog: boolean
}

export interface ThemeLabels {
  /** e.g. "Focus Session", "Intention Block", "Training Block" */
  sessionName: string
  sessionNamePlural: string
  /** e.g. "People", "Supporters", "Team Members" */
  contactsName: string
  /** e.g. "Templates", "Affirmations", "Scripts" */
  scriptsName: string
  /** Dashboard page title */
  dashboardTitle: string
  /** Greeting prefix shown on dashboard e.g. "Good morning," */
  dashboardGreeting: string
  /** Short app name shown in sidebar when collapsed */
  shortName: string
  /** Full app name shown in sidebar */
  fullName: string
}

export interface ThemeConfig {
  id: string
  name: string
  tagline: string
  /** Browser tab title */
  appTitle: string
  defaultDarkMode: boolean
  colors: ThemeColors
  fonts: ThemeFonts
  features: ThemeFeatures
  labels: ThemeLabels
}
