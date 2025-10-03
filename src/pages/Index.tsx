import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Cpu, ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section with Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Parallax Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/hero-bg.jpg')",
            transform: `translateY(${scrollY * 0.5}px)`,
            filter: "brightness(0.75)",
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black" />
        
        {/* Hero Content */}
        <div className="relative z-10 text-center space-y-6 px-4 animate-fade-in">
          <h1 className="font-poppins text-8xl md:text-9xl font-light tracking-tight">
            <span className="text-white drop-shadow-2xl">Isola</span>
          </h1>
          <p className="font-poppins text-xl md:text-2xl text-white/90 font-light tracking-wide drop-shadow-lg">
            Your AI. Your Data. Air-Gapped. Always
          </p>
          
          {/* Scroll Indicator */}
          <div className="pt-12">
            <button
              onClick={scrollToContent}
              className="animate-bounce"
              aria-label="Scroll down"
            >
              <ChevronDown className="w-12 h-12 text-white/70 hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section 
        className="relative min-h-screen bg-black py-24 px-4"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      >
        {/* Ambient glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" />
        
        <div className="relative z-10 max-w-6xl mx-auto space-y-24">
          {/* Description */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed">
              Enterprise-grade AI assistant with complete data sovereignty. 
              Deploy on-premises, maintain full control, never compromise security.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-primary/50 transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center">
                <div className="w-16 h-16 mb-6 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center glow-cyan">
                  <Shield className="w-8 h-8 text-black" />
                </div>
                <h3 className="font-poppins text-xl font-semibold mb-3 text-white">Air-Gapped Security</h3>
                <p className="text-white/60 font-light leading-relaxed">
                  Complete isolation from external networks. Your data never leaves your infrastructure.
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-accent/50 transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center">
                <div className="w-16 h-16 mb-6 mx-auto rounded-2xl bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center glow-magenta">
                  <Lock className="w-8 h-8 text-black" />
                </div>
                <h3 className="font-poppins text-xl font-semibold mb-3 text-white">Zero-Trust Architecture</h3>
                <p className="text-white/60 font-light leading-relaxed">
                  End-to-end encryption with granular access controls. Every request verified, every action logged.
                </p>
              </div>
            </div>

            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-tertiary/50 transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-tertiary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center">
                <div className="w-16 h-16 mb-6 mx-auto rounded-2xl bg-gradient-to-br from-tertiary to-tertiary/50 flex items-center justify-center glow-yellow">
                  <Cpu className="w-8 h-8 text-black" />
                </div>
                <h3 className="font-poppins text-xl font-semibold mb-3 text-white">Advanced RAG Engine</h3>
                <p className="text-white/60 font-light leading-relaxed">
                  State-of-the-art retrieval augmented generation with multi-model support and vector search.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              onClick={() => navigate("/auth")} 
              size="lg" 
              className="group relative px-8 py-6 text-lg font-poppins font-medium bg-gradient-siri hover:scale-105 transition-transform duration-300 glow-cyan"
            >
              <span className="relative z-10 text-black flex items-center gap-2">
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
