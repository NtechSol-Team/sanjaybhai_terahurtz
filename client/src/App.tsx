import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load pages for better initial bundle size
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Registration = lazy(() => import("@/pages/registration"));
const PatientDetails = lazy(() => import("@/pages/patient-details"));
const BillingCreate = lazy(() => import("@/pages/billing-create"));
const BillingManage = lazy(() => import("@/pages/bills"));
const Medicines = lazy(() => import("@/pages/medicines"));
const Treatments = lazy(() => import("@/pages/treatments"));
const Expenses = lazy(() => import("@/pages/expenses"));
const AppointmentMaster = lazy(() => import("@/pages/appointment-master"));
const Reports = lazy(() => import("@/pages/reports"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

import { useAuth, AuthProvider } from "@/hooks/use-auth";
import AuthPage from "@/pages/auth";

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any> } & any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        {/* Protected Routes */}
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/registration" component={() => <ProtectedRoute component={Registration} />} />
        <Route path="/patient/:id" component={(params) => <ProtectedRoute component={PatientDetails} params={params} />} />
        <Route path="/billing" component={() => <ProtectedRoute component={BillingCreate} />} />
        <Route path="/bills" component={() => <ProtectedRoute component={BillingManage} />} />
        <Route path="/medicines" component={() => <ProtectedRoute component={Medicines} />} />
        <Route path="/treatments" component={() => <ProtectedRoute component={Treatments} />} />
        <Route path="/expenses" component={() => <ProtectedRoute component={Expenses} />} />
        <Route path="/appointments" component={() => <ProtectedRoute component={AppointmentMaster} />} />
        <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="clinic-care-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background pb-20">
              <Navbar />
              <main>
                <Router />
              </main>
            </div>
            <footer className="fixed left-0 bottom-0 z-40 w-full h-12 border-t bg-card/95 text-sm flex items-center justify-center text-muted-foreground backdrop-blur">
              <div className="max-w-[1600px] mx-auto px-4 text-center">
                Copyright © {new Date().getFullYear()} Nakrani Techno & Solution LLP. All Rights Reserved.
              </div>
            </footer>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
