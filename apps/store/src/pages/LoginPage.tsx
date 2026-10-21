import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { CustomerAuth } from "../features/auth/CustomerAuth";

export function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine return target (e.g. /cart, /account, /addresses)
  const from = (location.state as { from?: string })?.from || "/account";

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-dark border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto py-6 sm:py-10 px-2 sm:px-4">
      <CustomerAuth
        onAuthSuccess={() => {
          navigate(from, { replace: true });
        }}
        onContinueGuest={() => {
          navigate("/", { replace: true });
        }}
      />
    </div>
  );
}
