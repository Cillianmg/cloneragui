import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success("Welcome back!");
      navigate("/chat");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      toast.success("Account created! Redirecting...");
      navigate("/chat");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center p-4">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 bg-gradient-glow opacity-20 animate-pulse-glow" />
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <h1 className="font-poppins text-5xl font-bold">
            <span className="bg-gradient-siri bg-clip-text text-transparent">Isola</span>
          </h1>
          <p className="text-white/60 text-sm font-light tracking-wide">
            Your AI. Your Data. Air-Gapped. Always
          </p>
        </div>

        {/* Auth Form */}
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="space-y-6">
            {/* Tab Toggle */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 px-4 rounded-xl font-poppins font-medium transition-all duration-300 ${
                  isLogin 
                    ? 'bg-gradient-siri text-black shadow-lg' 
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 px-4 rounded-xl font-poppins font-medium transition-all duration-300 ${
                  !isLogin 
                    ? 'bg-gradient-siri text-black shadow-lg' 
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="text-white/80 font-poppins font-light text-sm">
                    Full Name
                  </Label>
                  <Input
                    id="full-name"
                    type="text"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 h-12 rounded-xl font-poppins"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80 font-poppins font-light text-sm">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 h-12 rounded-xl font-poppins"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80 font-poppins font-light text-sm">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 h-12 rounded-xl font-poppins"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-siri hover:scale-[1.02] transition-transform duration-300 font-poppins font-medium text-black glow-cyan"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-white/50 hover:text-white/80 text-sm font-poppins font-light transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
