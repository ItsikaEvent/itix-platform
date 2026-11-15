import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, PublicLayout, RequireAuth } from "./components/Layouts";
import Concerts from "./pages/admin/Concerts";
import Dashboard from "./pages/admin/Dashboard";
import EmailSettings from "./pages/admin/EmailSettings";
import Login from "./pages/admin/Login";
import Orders from "./pages/admin/Orders";
import Organizers from "./pages/admin/Organizers";
import Scanner from "./pages/admin/Scanner";
import SupportMessages from "./pages/admin/SupportMessages";
import Billetterie from "./pages/public/Billetterie";
import ClientMessaging from "./pages/public/ClientMessaging";
import ConcertPage from "./pages/public/ConcertPage";
import Home from "./pages/public/Home";
import MyTickets from "./pages/public/MyTickets";
import OrganizerPage from "./pages/public/OrganizerPage";
import PrivacyPolicy from "./pages/public/PrivacyPolicy";
import TermsOfSale from "./pages/public/TermsOfSale";
import TermsOfUse from "./pages/public/TermsOfUse";

export default function App() {
  return (
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
        <Route path="scanner" element={<Scanner />} />
        <Route path="support" element={<SupportMessages />} />
        <Route path="email" element={<EmailSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
