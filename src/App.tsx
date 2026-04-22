import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ApiError } from '@/lib/api'
import { AuthGuard } from '@/features/auth/AuthGuard'
import { Layout } from '@/components/layout/Layout'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { LoginPage } from '@/pages/LoginPage'
import { VerifyPage } from '@/pages/VerifyPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { BriefsPage } from '@/pages/BriefsPage'
import { BriefDetailPage } from '@/pages/BriefDetailPage'
import { BriefComparePage } from '@/pages/BriefComparePage'
import { RunsPage } from '@/pages/RunsPage'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { SourcesPage } from '@/pages/SourcesPage'
import { SourceDetailPage } from '@/pages/SourceDetailPage'
import { RecipientsPage } from '@/pages/RecipientsPage'
import { TradesPage } from '@/pages/TradesPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { UsersPage } from '@/pages/UsersPage'
import { MarketPage } from '@/pages/MarketPage'
import { TickerDetailPage } from '@/pages/TickerDetailPage'
import { PreviewPage } from '@/pages/PreviewPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/verify" element={<VerifyPage />} />
              <Route
                element={
                  <AuthGuard>
                    <Layout />
                  </AuthGuard>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="market" element={<MarketPage />} />
                <Route path="market/:ticker" element={<TickerDetailPage />} />
                <Route path="briefs" element={<BriefsPage />} />
                <Route path="briefs/:id" element={<BriefDetailPage />} />
                <Route path="briefs/:id/compare" element={<BriefComparePage />} />
                <Route path="runs" element={<RunsPage />} />
                <Route path="runs/:id" element={<RunDetailPage />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="sources/:id" element={<SourceDetailPage />} />
                <Route path="recipients" element={<RecipientsPage />} />
                <Route path="trades" element={<TradesPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="preview" element={<PreviewPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
