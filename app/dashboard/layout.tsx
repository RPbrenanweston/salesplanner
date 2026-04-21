import PlannerLayout from '@/components/PlannerLayout'
import { Toaster } from '@/components/ui/toaster'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlannerLayout>{children}</PlannerLayout>
      <Toaster />
    </>
  )
}
