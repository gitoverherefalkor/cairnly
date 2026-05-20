import React from 'react';
import {
  ArrowRight,
  Play,
  CheckCircle2,
  MessageSquare,
  BarChart3,
  FileText,
  Layers,
} from 'lucide-react';

// Each palette: [primary dark, gradient mid, accent teal stays]
const palettes = [
  {
    name: 'Current: Navy + Teal',
    primary: '#012F64',
    gradientMid: '#0a2a52',
    accent: '#27A1A1',
    accentHover: '#1f8282',
    textMuted: 'rgba(191, 219, 254, 0.6)',   // blue-100/60
    textSubtle: 'rgba(191, 219, 254, 0.8)',  // blue-100/80
    bgGlow: '#27A1A1',
    cardBg: 'rgba(255,255,255,0.1)',
    note: 'Professional, corporate, trustworthy. Safe choice for B2B.',
  },
  {
    name: 'Charcoal Slate + Teal',
    primary: '#1a1a2e',
    gradientMid: '#16213e',
    accent: '#27A1A1',
    accentHover: '#1f8282',
    textMuted: 'rgba(203, 213, 225, 0.6)',   // slate-300/60
    textSubtle: 'rgba(203, 213, 225, 0.8)',  // slate-300/80
    bgGlow: '#27A1A1',
    cardBg: 'rgba(255,255,255,0.08)',
    note: 'Modern, premium, tech-forward. Feels more startup/SaaS.',
  },
  {
    name: 'Deep Indigo + Teal',
    primary: '#1e1b4b',
    gradientMid: '#272463',
    accent: '#27A1A1',
    accentHover: '#1f8282',
    textMuted: 'rgba(199, 210, 254, 0.6)',   // indigo-200/60
    textSubtle: 'rgba(199, 210, 254, 0.8)',  // indigo-200/80
    bgGlow: '#27A1A1',
    cardBg: 'rgba(255,255,255,0.06)',
    note: 'Creative, bold, premium. Stands out more but could feel less "career/business".',
  },
];

const ColorTest = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-8 px-6 text-center sticky top-0 z-50">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Color Palette Comparison</h1>
        <p className="text-gray-500 font-medium">Same layout, same teal accent, different primary dark color. Scroll to compare.</p>
        <a href="/" className="text-[#27A1A1] font-bold text-sm mt-3 inline-block hover:underline">← Back to homepage</a>
      </div>

      {palettes.map((p, idx) => (
        <div key={idx} className="mb-4">

          {/* Palette label */}
          <div className="bg-white border-b border-gray-200 py-4 px-6 sticky top-[108px] z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-900">{idx + 1}.</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
                  <p className="text-sm text-gray-400 font-medium">{p.note}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-lg shadow-inner border border-gray-200" style={{ backgroundColor: p.primary }} title="Primary" />
                <div className="w-10 h-10 rounded-lg shadow-inner border border-gray-200" style={{ backgroundColor: p.gradientMid }} title="Mid" />
                <div className="w-10 h-10 rounded-lg shadow-inner border border-gray-200" style={{ backgroundColor: p.accent }} title="Accent" />
              </div>
            </div>
          </div>

          {/* ===== HERO SECTION ===== */}
          <section className="relative min-h-[80vh] flex items-center pt-16 pb-16 overflow-hidden" style={{ backgroundColor: p.primary }}>
            <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[120px] -mr-96 -mt-96" style={{ backgroundColor: p.bgGlow, opacity: 0.1 }} />
            <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                {/* Left */}
                <div className="lg:w-1/2 text-center lg:text-left">
                  <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-8 leading-[0.95] tracking-tighter">
                    Stop Guessing. <br />
                    <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${p.accent}, ${p.accent}cc)` }}>
                      Start Thriving.
                    </span>
                  </h1>
                  <p className="text-lg sm:text-xl md:text-2xl mb-10 max-w-xl font-medium leading-relaxed" style={{ color: p.textMuted }}>
                    Find a career path that actually fits you, not the one you thought you wanted at 16.
                  </p>

                  <div className="space-y-3 mb-10 font-medium" style={{ color: p.textSubtle }}>
                    {[
                      '15-minute assessment',
                      'AI analysis built with career coaches',
                      'Interactive AI coaching chat',
                      'Concrete career recommendations with salary data',
                    ].map((text, i) => (
                      <div key={i} className="flex items-center gap-3 justify-center lg:justify-start">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${p.accent}33` }}>
                          <ArrowRight className="w-3 h-3" style={{ color: p.accent }} />
                        </div>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <button
                      className="px-8 py-4 rounded-full font-bold text-white text-lg transition-all hover:-translate-y-0.5 active:scale-95 shadow-lg"
                      style={{ backgroundColor: p.accent, boxShadow: `0 10px 25px -5px ${p.accent}66` }}
                    >
                      Get Started - €39
                    </button>
                    <button className="px-8 py-4 rounded-full font-bold text-white text-lg transition-all active:scale-95 border border-white/10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      See How It Works
                    </button>
                  </div>
                </div>

                {/* Right: Video Placeholder */}
                <div className="lg:w-1/2 w-full max-w-xl">
                  <div className="relative w-full rounded-2xl border-2 border-dashed border-white/20 overflow-hidden" style={{ backgroundColor: p.gradientMid }}>
                    <div className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.gradientMid}, ${p.accent}20)` }} />
                    <div className="relative z-10 flex flex-col items-center gap-4 py-16 md:py-20 px-6">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl" style={{ backgroundColor: `${p.accent}e6`, boxShadow: `0 0 40px ${p.accent}4d` }}>
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/90 font-bold text-lg">Product Video</p>
                        <p className="text-sm font-medium" style={{ color: p.textMuted }}>Coming soon - 60-90 second explainer</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== DIFFERENTIATORS (compact) ===== */}
          <section className="py-20 bg-gray-50">
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight tracking-tight" style={{ color: p.primary }}>
                  Not another personality test
                </h2>
                <p className="text-lg text-gray-500 font-medium max-w-2xl mx-auto">
                  Atlas gives you actual job titles, salary data, and honest reality checks.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { icon: MessageSquare, title: 'Interactive, not static', desc: 'An AI coach walks you through results and answers your questions.' },
                  { icon: BarChart3, title: 'Future-aware', desc: 'Every career includes an AI impact assessment for 2027-2028.' },
                  { icon: CheckCircle2, title: 'Honest, not flattering', desc: 'Reality checks on challenges, trade-offs, and skills to develop.' },
                  { icon: FileText, title: 'Specific, not vague', desc: '10+ career recommendations with salary ranges and fit explanations.' },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 flex gap-5 hover:shadow-lg transition-all">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.accent}1a` }}>
                      <item.icon className="w-6 h-6" style={{ color: p.accent }} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold mb-2" style={{ color: p.primary }}>{item.title}</h4>
                      <p className="text-gray-500 leading-relaxed font-medium text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ===== CTA SECTION ===== */}
          <section className="py-24 text-center relative overflow-hidden" style={{ backgroundColor: p.primary }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${p.primary}, transparent, ${p.accent}1a)` }} />
            <div className="max-w-3xl mx-auto px-6 relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tighter leading-tight">Ready to Stop Guessing?</h2>
              <p className="text-lg mb-10 font-medium leading-relaxed" style={{ color: p.textMuted }}>
                Get clarity on your career direction. Take the assessment, get honest recommendations.
              </p>
              <button
                className="px-12 py-6 rounded-full font-bold text-white text-xl uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ backgroundColor: p.accent, boxShadow: `0 0 50px ${p.accent}4d` }}
              >
                Get Your Cairnly Assessment - €39
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] mt-6" style={{ color: `${p.textMuted}50` }}>
                Beta access. Full refund if you're not satisfied.
              </p>
            </div>
          </section>

          {/* ===== NAV BAR PREVIEW (scrolled state) ===== */}
          <div className="py-4 px-6" style={{ backgroundColor: `${p.primary}f2` }}>
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)` }}>
                  <Layers className="text-white w-5 h-5" />
                </div>
                <span className="text-white text-lg font-bold tracking-tighter">ATLAS</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest">How It Works</span>
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Pricing</span>
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest">About</span>
                <button className="px-5 py-2 rounded-full text-white text-xs font-bold uppercase tracking-tight" style={{ backgroundColor: p.accent }}>
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Bottom note */}
      <div className="py-16 px-6 text-center bg-white">
        <p className="text-gray-400 font-medium text-sm">Temporary page - delete after choosing a palette</p>
        <a href="/" className="text-[#27A1A1] font-bold text-sm mt-2 inline-block hover:underline">← Back to homepage</a>
      </div>
    </div>
  );
};

export default ColorTest;
