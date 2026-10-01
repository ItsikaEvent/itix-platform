import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, PublicLayout, RequireAuth } from "./components/Layouts";
import Concerts from "./pages/admin/Concerts";
import Dashboard from "./pages/admin/Dashboard";
import EmailSettings from "./pages/admin/EmailSettings";
import Login from "./pages/admin/Login";
import Orders from "./pages/admin/Orders";
import Scanner from "./pages/admin/Scanner";
import SupportMessages from "./pages/admin/SupportMessages";
import ConcertPage from "./pages/public/ConcertPage";
import Home from "./pages/public/Home";
import Billetterie from "./pages/public/Billetterie";
import MyTickets from "./pages/public/MyTickets";
import ClientMessaging from "./pages/public/ClientMessaging";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/billetterie" element={<Billetterie />} />
        <Route path="/concerts/:id" element={<ConcertPage />} />
        <Route path="/mes-billets" element={<MyTickets />} />
        <Route path="/messagerie" element={<ClientMessaging />} />
      </Route>
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
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
