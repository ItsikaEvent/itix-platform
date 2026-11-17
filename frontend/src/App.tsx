import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, PublicLayout, RequireAuth } from "./components/Layouts";
import { Spinner } from "./components/ui";

// Code splitting des pages publiques
const Home = lazy(() => import("./pages/public/Home"));
const Billetterie = lazy(() => import("./pages/public/Billetterie"));
const ConcertPage = lazy(() => import("./pages/public/ConcertPage"));
const OrganizerPage = lazy(() => import("./pages/public/OrganizerPage"));
const MyTickets = lazy(() => import("./pages/public/MyTickets"));
const ClientMessaging = lazy(() => import("./pages/public/ClientMessaging"));
const PrivacyPolicy = lazy(() => import("./pages/public/PrivacyPolicy"));
const TermsOfSale = lazy(() => import("./pages/public/TermsOfSale"));
const TermsOfUse = lazy(() => import("./pages/public/TermsOfUse"));

// Code splitting des pages d'administration
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Organizers = lazy(() => import("./pages/admin/Organizers"));
const Concerts = lazy(() => import("./pages/admin/Concerts"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const Payouts = lazy(() => import("./pages/admin/Payouts"));
const Staff = lazy(() => import("./pages/admin/Staff"));
const Scanner = lazy(() => import("./pages/admin/Scanner"));
const SupportMessages = lazy(() => import("./pages/admin/SupportMessages"));
const EmailSettings = lazy(() => import("./pages/admin/EmailSettings"));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/billetterie" element={<Billetterie />} />
          <Route path="/concerts/:id" element={<ConcertPage />} />
          <Route path="/organisateurs/:slug" element={<OrganizerPage />} />
          <Route path="/mes-billets" element={<MyTickets />} />
          <Route path="/messagerie" element={<ClientMessaging />} />
          <Route path="/politique-de-confidentialite" element={<PrivacyPolicy />} />
          <Route path="/conditions-generales-de-vente" element={<TermsOfSale />} />
          <Route path="/conditions-generales-d-utilisation" element={<TermsOfUse />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="organizers" element={<Organizers />} />
          <Route path="concerts" element={<Concerts />} />
          <Route path="orders" element={<Orders />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="staff" element={<Staff />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="support" element={<SupportMessages />} />
          <Route path="email" element={<EmailSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
