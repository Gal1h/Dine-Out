import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./features/auth/use-auth";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { GroupsPage } from "./features/groups/pages/GroupsPage";
import { GroupPage } from "./features/groups/pages/GroupPage";
import { VoteFormPage } from "./features/votes/pages/VoteFormPage";
import { VoteDetailPage } from "./features/votes/pages/VoteDetailPage";
import { SummaryPage } from "./features/summaries/pages/SummaryPage";
import { BillPage } from "./features/bills/pages/BillPage";
import { ProfilePage } from "./features/profile/pages/ProfilePage";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" strokeLinecap="round" />
            <path d="M7 7h4M9 13v8" strokeLinecap="round" />
            <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.4 0 1.6.8 2.6 2.4 2.6s2.4-1 2.4-2.6C19.4 6 18.6 4.2 17 3Z" />
            <path d="M17 11v10" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">DineOut</p>
      </div>
    </div>
  );
}

function ProtectedLayout() {
  const { me, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Splash />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}

function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tautan yang Anda buka tidak tersedia.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<GroupsPage />} />
        <Route path="groups/:groupId" element={<GroupPage />} />
        <Route path="groups/:groupId/votes/new" element={<VoteFormPage />} />
        <Route path="votes/:voteId" element={<VoteDetailPage />} />
        <Route path="votes/:voteId/edit" element={<VoteFormPage />} />
        <Route path="votes/:voteId/summary" element={<SummaryPage />} />
        <Route path="summaries/:summaryId/bill" element={<BillPage />} />
        <Route path="bills/:billId" element={<BillPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
