/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Toaster } from "sonner";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Calendar } from "./pages/Calendar";
import { Customers } from "./pages/Customers";
import { Services } from "./pages/Services";
import { Settings } from "./pages/Settings";
import { FormsManager } from "./components/FormsManager";
import { Login } from "./pages/Login";
import { BookingPage } from "./pages/BookingPage";
import { MessagingPage } from "./pages/MessagingPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuthProvider } from "./lib/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="customers" element={<Customers />} />
            <Route path="services" element={<Services />} />
            <Route path="forms" element={<FormsManager />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
