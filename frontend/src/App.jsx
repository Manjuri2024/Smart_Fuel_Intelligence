import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext.jsx";
import AuthLayout from "./components/AuthLayout.jsx";
import Layout from "./components/Layout.jsx";
import { RequireAccess } from "./components/RouteGuards.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Calculator from "./pages/Calculator.jsx";
import Comparison from "./pages/Comparison.jsx";
import Assistant from "./pages/Assistant.jsx";
import History from "./pages/History.jsx";
import Maps from "./pages/Maps.jsx";
import Settings from "./pages/Settings.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public pages (signed-in users are redirected to the dashboard) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Signed-in users and guests */}
        <Route element={<RequireAccess><Layout /></RequireAccess>}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/maps" element={<Maps />} />
          {/* Signed-in users only */}
          <Route path="/assistant" element={<RequireAccess level="account" feature="The AI assistant"><Assistant /></RequireAccess>} />
          <Route path="/history" element={<RequireAccess level="account" feature="Trip history"><History /></RequireAccess>} />
          <Route path="/settings" element={<RequireAccess level="account" feature="Settings"><Settings /></RequireAccess>} />
          {/* Administrators only */}
          <Route path="/admin" element={<RequireAccess level="admin"><Admin /></RequireAccess>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
