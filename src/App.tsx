/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from "react";
import { Toaster } from "sonner";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { AuthProvider } from "./lib/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Dashboard = lazy(async () => ({
  default: (await import("./pages/Dashboard")).Dashboard,
}));
const Calendar = lazy(async () => ({
  default: (await import("./pages/Calendar")).Calendar,
}));
const Customers = lazy(async () => ({
  default: (await import("./pages/Customers")).Customers,
}));
const Services = lazy(async () => ({
  default: (await import("./pages/Services")).Services,
}));
const Dogs = lazy(async () => ({
  default: (await import("./pages/Dogs")).Dogs,
}));
const Settings = lazy(async () => ({
  default: (await import("./pages/Settings")).Settings,
}));
const FormsManager = lazy(async () => ({
  default: (await import("./components/FormsManager")).FormsManager,
}));
const Login = lazy(async () => ({
  default: (await import("./pages/Login")).Login,
}));
const ResetPassword = lazy(async () => ({
  default: (await import("./pages/ResetPassword")).ResetPassword,
}));
const BookingPage = lazy(async () => ({
  default: (await import("./pages/BookingPage")).BookingPage,
}));
const MessagingPage = lazy(async () => ({
  default: (await import("./pages/MessagingPage")).MessagingPage,
}));
const ReportsPage = lazy(async () => ({
  default: (await import("./pages/ReportsPage")).ReportsPage,
}));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-sm text-muted-foreground">
      Loading PetSpa...
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Router>
        <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/calendar" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="clients" element={<Customers />} />
              <Route path="dogs" element={<Dogs />} />
              <Route path="customers" element={<Customers />} />
              <Route path="services" element={<Services />} />
              <Route path="forms" element={<FormsManager />} />
              <Route path="messaging" element={<MessagingPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}
