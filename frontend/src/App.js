import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import MealPrep from "./pages/MealPrep";
import GroceryList from "./pages/GroceryList";
import Recipes from "./pages/Recipes";
import AddRecipe from "./pages/AddRecipe";
import Profile from "./pages/Profile";
import "@/App.css";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const OnboardingGuard = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <OnboardingGuard>
                <Layout>
                  <Dashboard />
                </Layout>
              </OnboardingGuard>
            }
          />
          <Route
            path="/meal-prep"
            element={
              <OnboardingGuard>
                <Layout>
                  <MealPrep />
                </Layout>
              </OnboardingGuard>
            }
          />
          <Route
            path="/grocery"
            element={
              <OnboardingGuard>
                <Layout>
                  <GroceryList />
                </Layout>
              </OnboardingGuard>
            }
          />
          <Route
            path="/recipes"
            element={
              <OnboardingGuard>
                <Layout>
                  <Recipes />
                </Layout>
              </OnboardingGuard>
            }
          />
          <Route
            path="/recipes/add"
            element={
              <OnboardingGuard>
                <Layout>
                  <AddRecipe />
                </Layout>
              </OnboardingGuard>
            }
          />
          <Route
            path="/profile"
            element={
              <OnboardingGuard>
                <Layout>
                  <Profile />
                </Layout>
              </OnboardingGuard>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;
