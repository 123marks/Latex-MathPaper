import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import HorizonBackground from "./components/HorizonBackground.jsx";
import BackgroundVideo from "./components/BackgroundVideo.jsx";
import SiteLayout from "./components/SiteLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRoute from "./components/RoleRoute.jsx";
import Home from "./pages/Home.jsx";
import Features from "./pages/Features.jsx";
import HowTo from "./pages/HowTo.jsx";
import About from "./pages/About.jsx";
import Community from "./pages/Community.jsx";
import Market from "./pages/Market.jsx";
import Download from "./pages/Download.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";
import Pricing from "./pages/Pricing.jsx";
import Enterprise from "./pages/Enterprise.jsx";
import Docs from "./pages/Docs.jsx";
import Changelog from "./pages/Changelog.jsx";
import AppLayout from "./pages/app/AppLayout.jsx";
import Dashboard from "./pages/app/Dashboard.jsx";
import Workbench from "./pages/app/Workbench.jsx";
import Usage from "./pages/app/Usage.jsx";
import TeamSpace from "./pages/app/TeamSpace.jsx";
import Magnifier from "./pages/app/Magnifier.jsx";
import Sessions from "./pages/app/Sessions.jsx";
import CommunityBoard from "./pages/app/CommunityBoard.jsx";
import Account from "./pages/app/Account.jsx";
import ApiKeys from "./pages/app/ApiKeys.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import AdminUsage from "./pages/admin/AdminUsage.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminCommunity from "./pages/admin/AdminCommunity.jsx";
import AdminContent from "./pages/admin/AdminContent.jsx";
import AdminAudit from "./pages/admin/AdminAudit.jsx";
import AdminSystem from "./pages/admin/AdminSystem.jsx";
import AdminMonitor from "./pages/admin/AdminMonitor.jsx";
import AdminLicenses from "./pages/admin/AdminLicenses.jsx";
import AdminSessions from "./pages/admin/AdminSessions.jsx";
import AdminKeys from "./pages/admin/AdminKeys.jsx";
import AdminReleases from "./pages/admin/AdminReleases.jsx";

const Kitchensink = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/Kitchensink.jsx"))
  : null;

export default function App() {
  return (
    <AuthProvider>
      <HorizonBackground />
      <BackgroundVideo />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/market" element={<Market />} />
          <Route path="/how-to" element={<HowTo />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/about" element={<About />} />
          <Route path="/community" element={<Community />} />
          <Route path="/download" element={<Download />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/workbench" element={<Workbench />} />
          <Route path="/app/magnifier" element={<Magnifier />} />
          <Route path="/app/sessions" element={<Sessions />} />
          <Route path="/app/team" element={<TeamSpace />} />
          <Route path="/app/community" element={<CommunityBoard />} />
          <Route path="/app/usage" element={<Usage />} />
          <Route path="/app/api-keys" element={<ApiKeys />} />
          <Route path="/app/account" element={<Account />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <RoleRoute>
                <AdminLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/usage" element={<AdminUsage />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/community" element={<AdminCommunity />} />
          <Route path="/admin/content" element={<AdminContent />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/system" element={<AdminSystem />} />
          <Route path="/admin/monitor" element={<AdminMonitor />} />
          <Route path="/admin/licenses" element={<AdminLicenses />} />
          <Route path="/admin/sessions" element={<AdminSessions />} />
          <Route path="/admin/keys" element={<AdminKeys />} />
          <Route path="/admin/releases" element={<AdminReleases />} />
        </Route>

        {Kitchensink ? (
          <Route
            path="/_kitchensink"
            element={
              <Suspense fallback={<div className="kitchen__loading-route" role="status">加载组件目录…</div>}>
                <Kitchensink />
              </Suspense>
            }
          />
        ) : null}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
