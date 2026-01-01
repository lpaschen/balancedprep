import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarDays, 
  ShoppingCart, 
  BookOpen, 
  User, 
  LogOut,
  Leaf,
  ChefHat
} from 'lucide-react';
import { Button } from './ui/button';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', icon: CalendarDays, label: 'Plan' },
    { to: '/meal-prep', icon: ChefHat, label: 'Meal Prep' },
    { to: '/grocery', icon: ShoppingCart, label: 'Grocery' },
    { to: '/recipes', icon: BookOpen, label: 'Recipes' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Left */}
            <NavLink to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-foreground" strokeWidth={1.5} />
              </div>
              <span className="text-xl font-semibold tracking-tight">BalancedPrep</span>
            </NavLink>
            
            {/* Nav - Left aligned after logo with gap */}
            <nav className="flex items-center gap-1 ml-12 flex-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.5} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* User info - Right */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-full"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 glass border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-lg font-semibold">BalancedPrep</span>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="rounded-full"
            data-testid="mobile-logout-btn"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden bottom-nav glass border-t border-border">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
