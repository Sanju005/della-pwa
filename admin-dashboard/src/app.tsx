import { Suspense, lazy } from "react";
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/auth-provider";
import { AdminShell } from "./components/admin-shell";

const DashboardPage = lazy(async () => {
  const module = await import("./pages/dashboard-page");
  return { default: module.DashboardPage };
});

const ForgotPasswordPage = lazy(async () => {
  const module = await import("./pages/forgot-password-page");
  return { default: module.ForgotPasswordPage };
});

const LoginPage = lazy(async () => {
  const module = await import("./pages/login-page");
  return { default: module.LoginPage };
});

const ResetPasswordPage = lazy(async () => {
  const module = await import("./pages/reset-password-page");
  return { default: module.ResetPasswordPage };
});

const ResourcePage = lazy(async () => {
  const module = await import("./pages/resource-page");
  return { default: module.ResourcePage };
});

const SettingsPage = lazy(async () => {
  const module = await import("./pages/settings-page");
  return { default: module.SettingsPage };
});

const UserProfilePage = lazy(async () => {
  const module = await import("./pages/user-profile-page");
  return { default: module.UserProfilePage };
});

const ProviderProfilePage = lazy(async () => {
  const module = await import("./pages/provider-profile-page");
  return { default: module.ProviderProfilePage };
});

const BookingsPage = lazy(async () => {
  const module = await import("./pages/bookings-page");
  return { default: module.BookingsPage };
});

const PaymentsPage = lazy(async () => {
  const module = await import("./pages/payments-page");
  return { default: module.PaymentsPage };
});

const BookingDetailPage = lazy(async () => {
  const module = await import("./pages/booking-detail-page");
  return { default: module.BookingDetailPage };
});

const PaymentDetailPage = lazy(async () => {
  const module = await import("./pages/payment-detail-page");
  return { default: module.PaymentDetailPage };
});

const ProvidersPage = lazy(async () => {
  const module = await import("./pages/providers-page");
  return { default: module.ProvidersPage };
});

const ProviderApprovalsPage = lazy(async () => {
  const module = await import("./pages/provider-approvals-page");
  return { default: module.ProviderApprovalsPage };
});

const ReviewsPage = lazy(async () => {
  const module = await import("./pages/reviews-page");
  return { default: module.ReviewsPage };
});

const ComplaintsPage = lazy(async () => {
  const module = await import("./pages/complaints-page");
  return { default: module.ComplaintsPage };
});

const UsersPage = lazy(async () => {
  const module = await import("./pages/users-page");
  return { default: module.UsersPage };
});

function RouteLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
    </div>
  );
}

function BlockedPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(180deg,_#f8fff9_0%,_#ecfdf3_45%,_#f8fafc_100%)] px-4">
      <div className="w-full max-w-lg rounded-[32px] border border-white/80 bg-white/90 p-8 text-center shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
          DELLA Admin
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950">
          Access restricted
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          {profile?.email ?? "This account"} is signed in, but it does not have an admin role for
          this panel.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex rounded-2xl bg-[linear-gradient(135deg,#0f8b3d,#16a34a)] px-5 py-3 font-semibold text-white shadow-[0_18px_40px_rgba(15,139,61,0.35)] transition hover:brightness-105"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { access, initialized, session } = useAuth();
  const location = useLocation();

  if (!initialized) {
    return <RouteLoader />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (access === "denied") {
    return <Navigate to="/blocked" replace />;
  }

  if (access !== "allowed") {
    return <RouteLoader />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
  },
  {
    path: "/blocked",
    element: <BlockedPage />,
  },
  {
    path: "/blokced",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/forgot-password",
    element: withSuspense(<ForgotPasswordPage />),
  },
  {
    path: "/reset-password",
    element: withSuspense(<ResetPasswordPage />),
  },
  {
    path: "/",
    element: (
        <ProtectedRoute>
          <AdminShell />
        </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },
      {
        path: "users",
        element: withSuspense(<UsersPage />),
      },
      {
        path: "users/:userId",
        element: withSuspense(<UserProfilePage />),
      },
      {
        path: "service-providers",
        element: withSuspense(<ProvidersPage />),
      },
      {
        path: "service-providers/:providerId",
        element: withSuspense(<ProviderProfilePage />),
      },
      {
        path: "provider-approvals",
        element: withSuspense(<ProviderApprovalsPage />),
      },
      {
        path: "tasks-bookings",
        element: withSuspense(<BookingsPage />),
      },
      {
        path: "tasks-bookings/:bookingId",
        element: withSuspense(<BookingDetailPage />),
      },
      {
        path: "payments",
        element: withSuspense(<PaymentsPage />),
      },
      {
        path: "payments/:paymentId",
        element: withSuspense(<PaymentDetailPage />),
      },
      {
        path: "reviews",
        element: withSuspense(<ReviewsPage />),
      },
      {
        path: "complaints",
        element: withSuspense(<ComplaintsPage />),
      },
      {
        path: "settings",
        element: withSuspense(<SettingsPage />),
      },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
