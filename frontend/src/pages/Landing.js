import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowRight, Leaf, Target, ShoppingCart, Repeat } from 'lucide-react';
import { useEffect } from 'react';

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (user.onboarding_complete) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: Target,
      title: 'Flexible Targets',
      description: 'Set the macros that matter to you. Calories, protein, carbs, or fat—track one or all.'
    },
    {
      icon: Repeat,
      title: 'Prep Your Way',
      description: 'From batch cooking to daily variety, control how many unique meals you cook each week.'
    },
    {
      icon: ShoppingCart,
      title: 'Smart Grocery List',
      description: 'Consolidated shopping list with everything you need, organized by category.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1678831654314-8d68bb47cb0f?w=1920&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15
          }}
        />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-16 md:pt-16 md:pb-24">
          {/* Header */}
          <header className="flex items-center justify-between mb-16 md:mb-24 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" strokeWidth={1.5} />
              </div>
              <span className="text-2xl font-semibold tracking-tight">BalancedPrep</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              className="rounded-full px-6"
              data-testid="header-login-btn"
            >
              Sign in
            </Button>
          </header>

          {/* Hero Content */}
          <div className="max-w-3xl animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Meal planning that
              <span className="text-primary"> fits your life</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
              Enter your nutrition goals, choose your prep style, and get a personalized 7-day meal plan with a complete grocery list.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                className="btn-primary rounded-full px-8 py-6 text-lg font-medium shadow-sm"
                data-testid="get-started-btn"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/login')}
                className="rounded-full px-8 py-6 text-lg font-medium"
                data-testid="sign-in-btn"
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">
            Simple steps to balanced eating
          </h2>
          <div className="grid md:grid-cols-3 gap-8 stagger-children">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-background border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-6">
            Ready to simplify your meal prep?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Join thousands who've found peace of mind in the kitchen.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/register')}
            className="btn-primary rounded-full px-10 py-6 text-lg font-medium shadow-sm"
            data-testid="cta-get-started-btn"
          >
            Start Planning Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>© 2025 BalancedPrep. Eat well, live better.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
