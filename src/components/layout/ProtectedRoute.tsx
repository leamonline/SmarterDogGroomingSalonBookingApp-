import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/src/lib/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}
