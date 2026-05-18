import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Menu,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  Play,
  Camera,
  Film,
  Monitor,
  MessageSquare,
  BarChart3,
  FileText,
  Shield,
  Lock,
  Trash2
} from 'lucide-react';
import CairnlyWordmarkInverted from '@/logos/cairnly-logo/cairnly_logo_wordmark_inverted.png';
import CairnlyWordmark from '@/logos/cairnly-logo/cairnly_logo_wordmark.png';
import CairnlySymbol from '@/logos/cairnly-logo/cairnly_logo_symbol_only.png';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// --- Reusable UI ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[#2ABFBF] hover:bg-[#27A1A1] text-white shadow-xl shadow-teal-500/40 hover:shadow-teal-400/60 hover:-translate-y-0.5',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm',
    outline: 'border-2 border-[#3989AF] text-[#3989AF] hover:bg-[#3989AF] hover:text-white',
  };
  return (
    <button className={`px-8 py-4 rounded-full font-bold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- Career Path Configurations ---
// Each config defines a different visual trajectory so every loop looks unique
interface CpbConfig {
  oldRise: string;
  plateau: string;
  ghost: string;
  sx: number;
  sy: number;
  oldDots: Array<{ cx: number; cy: number; r: number }>;
  newPath: string;
  branches: Array<{ d: string; color: string; width: string; dash: string }>;
  newDots: Array<{ cx: number; cy: number }>;
  newNodes: Array<{ cx: number; cy: number }>;
}

const cpbConfigs: CpbConfig[] = [
  {
    // Bottom-left → gentle rise → flat plateau through the cairn → upper-right
    oldRise: "M-150 510 C 120 470, 280 391, 460 391",
    plateau: "M460 391 C 620 391, 800 391, 980 391 C 1080 391, 1180 391, 1260 391",
    ghost: "M1260 391 C 1340 391, 1440 391, 1540 391",
    sx: 660, sy: 391,
    oldDots: [
      { cx: 0, cy: 482, r: 2.5 }, { cx: 160, cy: 443, r: 2.5 }, { cx: 300, cy: 409, r: 2.5 },
      { cx: 500, cy: 391, r: 2 }, { cx: 720, cy: 391, r: 2 }, { cx: 940, cy: 391, r: 2 }, { cx: 1140, cy: 391, r: 2 },
    ],
    newPath: "M660 391 C 720 351, 790 291, 860 241 S 1000 141, 1080 91 S 1220 21, 1340 -20",
    branches: [
      { d: "M860 241 C 890 261, 930 276, 970 266", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M1080 91 C 1100 116, 1130 131, 1170 121", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M960 171 C 980 146, 1010 131, 1050 141", color: "white", width: "1.2", dash: "3 9" },
    ],
    newDots: [{ cx: 800, cy: 291 }, { cx: 970, cy: 161 }, { cx: 1160, cy: 61 }],
    newNodes: [{ cx: 860, cy: 241 }, { cx: 1080, cy: 91 }],
  },
  {
    // Bottom-right → gentle rise → flat plateau through the cairn → upper-left
    oldRise: "M1590 510 C 1320 470, 1160 400, 980 400",
    plateau: "M980 400 C 820 400, 640 400, 460 400 C 360 400, 260 400, 180 400",
    ghost: "M180 400 C 100 400, 0 400, -100 400",
    sx: 780, sy: 400,
    oldDots: [
      { cx: 1440, cy: 483, r: 2.5 }, { cx: 1279, cy: 446, r: 2.5 }, { cx: 1140, cy: 416, r: 2.5 },
      { cx: 920, cy: 400, r: 2 }, { cx: 700, cy: 400, r: 2 }, { cx: 500, cy: 400, r: 2 }, { cx: 320, cy: 400, r: 2 },
    ],
    newPath: "M780 400 C 720 360, 650 300, 580 250 S 440 150, 360 100 S 200 30, 80 -20",
    branches: [
      { d: "M580 250 C 550 270, 510 285, 470 275", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M360 100 C 340 125, 310 140, 270 130", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M470 180 C 450 155, 420 140, 380 150", color: "white", width: "1.2", dash: "3 9" },
    ],
    newDots: [{ cx: 640, cy: 300 }, { cx: 460, cy: 180 }, { cx: 240, cy: 60 }],
    newNodes: [{ cx: 580, cy: 250 }, { cx: 360, cy: 100 }],
  },
  {
    // Bottom-left → gentle rise → flat plateau through the cairn → upper-right
    oldRise: "M-150 540 C 120 500, 290 417, 470 417",
    plateau: "M470 417 C 630 417, 810 417, 990 417 C 1090 417, 1190 417, 1270 417",
    ghost: "M1270 417 C 1350 417, 1450 417, 1550 417",
    sx: 840, sy: 417,
    oldDots: [
      { cx: 1, cy: 512, r: 2.5 }, { cx: 164, cy: 471, r: 2.5 }, { cx: 308, cy: 436, r: 2.5 },
      { cx: 510, cy: 417, r: 2 }, { cx: 720, cy: 417, r: 2 }, { cx: 930, cy: 417, r: 2 }, { cx: 1140, cy: 417, r: 2 },
    ],
    newPath: "M840 417 C 900 377, 970 317, 1040 267 S 1180 167, 1260 107 S 1380 27, 1460 -20",
    branches: [
      { d: "M1040 267 C 1070 287, 1110 302, 1150 292", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M1260 107 C 1280 132, 1310 147, 1350 137", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M1150 190 C 1170 165, 1200 150, 1240 160", color: "white", width: "1.2", dash: "3 9" },
    ],
    newDots: [{ cx: 980, cy: 317 }, { cx: 1140, cy: 207 }, { cx: 1320, cy: 77 }],
    newNodes: [{ cx: 1040, cy: 267 }, { cx: 1260, cy: 107 }],
  },
  {
    // Bottom-right → gentle rise → flat plateau through the cairn → upper-left
    oldRise: "M1590 540 C 1320 500, 1150 417, 970 417",
    plateau: "M970 417 C 810 417, 630 417, 450 417 C 350 417, 250 417, 170 417",
    ghost: "M170 417 C 90 417, -10 417, -110 417",
    sx: 600, sy: 417,
    oldDots: [
      { cx: 1439, cy: 512, r: 2.5 }, { cx: 1275, cy: 471, r: 2.5 }, { cx: 1132, cy: 436, r: 2.5 },
      { cx: 920, cy: 417, r: 2 }, { cx: 700, cy: 417, r: 2 }, { cx: 490, cy: 417, r: 2 }, { cx: 300, cy: 417, r: 2 },
    ],
    newPath: "M600 417 C 540 377, 470 317, 400 267 S 260 167, 180 107 S 60 27, -20 -20",
    branches: [
      { d: "M400 267 C 370 287, 330 302, 290 292", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M180 107 C 160 132, 130 147, 90 137", color: "#E3B04D", width: "1.5", dash: "4 8" },
      { d: "M290 190 C 270 165, 240 150, 200 160", color: "white", width: "1.2", dash: "3 9" },
    ],
    newDots: [{ cx: 460, cy: 317 }, { cx: 300, cy: 207 }, { cx: 120, cy: 77 }],
    newNodes: [{ cx: 400, cy: 267 }, { cx: 180, cy: 107 }],
  },
];

// --- Career Path Background ---
// Narrative loop: slow rise → long plateau drag → spark → upward path → fade → repeat
const CareerPathBg = () => {
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);

  // Cycle duration: 4s draw + 2.5s plateau + 1s spark + 3s new path + 2s hold + 2s fade + 1.5s pause = 16s
  const CYCLE_MS = 16000;
  const FADE_START_MS = 12500; // start fade at 12.5s

  useEffect(() => {
    // Only animate while hero is in view
    const handleScroll = () => {
      setVisible(window.scrollY < window.innerHeight);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setCycle(c => c + 1);
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [visible]);

  // Fade wrapper: fades out near end of each cycle, then resets on new cycle
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setFading(false);
    const fadeTimer = setTimeout(() => setFading(true), FADE_START_MS);
    return () => clearTimeout(fadeTimer);
  }, [cycle, visible]);

  if (!visible && cycle > 0) return null;

  // Pick a different path configuration each cycle
  const config = cpbConfigs[cycle % cpbConfigs.length];
  const { sx, sy } = config;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        key={cycle}
        className="absolute inset-0 transition-opacity duration-[2000ms]"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <svg
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* ====== ACT 1: Old path - rises, then long painful plateau ====== */}
          {/* Early rise - some momentum */}
          <path
            d={config.oldRise}
            stroke="url(#oldPathGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="cpb-old-rise"
          />
          {/* The plateau - long, flat, going nowhere */}
          <path
            d={config.plateau}
            stroke="url(#plateauGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="cpb-plateau"
          />
          {/* Ghost continuation - stagnation petering out into dots */}
          <path
            d={config.ghost}
            stroke="#9AA7B0"
            strokeWidth="2.2"
            strokeOpacity="0"
            strokeLinecap="round"
            strokeDasharray="0.5 13"
            fill="none"
            className="cpb-ghost"
          />

          {/* Milestone dots along old path - getting dimmer */}
          {config.oldDots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill="#9AA7B0" fillOpacity="0" className={`cpb-dot-old cpb-dot-${i + 1}`} />
          ))}

          {/* ====== ACT 2: The spark ====== */}
          <g className="cpb-spark-group">
            {/* Outer glow */}
            <circle cx={sx} cy={sy} r="35" fill="#E3B04D" fillOpacity="0" className="cpb-spark-ring" />
            {/* Core: the cairn — the change-of-direction point */}
            <image
              href={CairnSymbolInvert}
              x={sx - 14} y={sy - 24}
              width="28" height="48"
              preserveAspectRatio="xMidYMid meet"
              opacity="0"
              className="cpb-spark-core"
            />
            {/* Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const r1 = 28, r2 = 38 + (i % 2) * 8;
              return (
                <line
                  key={angle}
                  x1={sx + Math.cos(rad) * r1} y1={sy + Math.sin(rad) * r1}
                  x2={sx + Math.cos(rad) * r2} y2={sy + Math.sin(rad) * r2}
                  stroke="#E3B04D"
                  strokeWidth={i % 2 === 0 ? "1.5" : "1"}
                  strokeLinecap="round"
                  strokeOpacity="0"
                  className="cpb-spark-ray"
                />
              );
            })}
            {/* Sparkle particles */}
            <circle cx={sx - 20} cy={sy - 22} r="1.5" fill="#E3B04D" fillOpacity="0" className="cpb-sparkle cpb-sp1" />
            <circle cx={sx + 24} cy={sy - 14} r="1" fill="white" fillOpacity="0" className="cpb-sparkle cpb-sp2" />
            <circle cx={sx + 14} cy={sy + 20} r="1.2" fill="#E3B04D" fillOpacity="0" className="cpb-sparkle cpb-sp3" />
            <circle cx={sx - 18} cy={sy + 16} r="1" fill="white" fillOpacity="0" className="cpb-sparkle cpb-sp4" />
          </g>

          {/* ====== ACT 3: New thriving path from spark - the golden career path ====== */}
          <path
            d={config.newPath}
            stroke="url(#newPathGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="cpb-new-path"
          />

          {/* Branches off new path - possibilities opening */}
          {config.branches.map((b, i) => (
            <path
              key={i}
              d={b.d}
              stroke={b.color} strokeWidth={b.width} strokeOpacity="0"
              strokeLinecap="round" strokeDasharray={b.dash} fill="none"
              className={`cpb-branch cpb-br${i + 1}`}
            />
          ))}

          {/* Dots on new path */}
          {config.newDots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r="3" fill="#E3B04D" fillOpacity="0" className={`cpb-dot-new cpb-dn${i + 1}`} />
          ))}

          {/* Branch nodes with subtle pulse */}
          {config.newNodes.map((node, i) => (
            <circle key={i} cx={node.cx} cy={node.cy} r="5" fill="#E3B04D" fillOpacity="0" className={`cpb-node-new cpb-nn${i + 1}`} />
          ))}

          <defs>
            <linearGradient id="oldPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9AA7B0" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#9AA7B0" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#9AA7B0" stopOpacity="0.46" />
            </linearGradient>
            <linearGradient id="plateauGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9AA7B0" stopOpacity="0.46" />
              <stop offset="50%" stopColor="#9AA7B0" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#9AA7B0" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="newPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EFBE48" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#E3B04D" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#E3B04D" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <style>{`
        /* ============ TIMING ============
           0.0s - 4.0s : Old rise draws (slow, deliberate)
           2.5s - 6.5s : Plateau draws (really drags)
           5.5s - 6.5s : Ghost line appears
           6.5s - 7.5s : Spark fires
           7.5s - 10.5s: New path draws (moderate, confident)
           9.5s - 11s  : Branches appear
           12.5s       : Wrapper starts fading (handled by React)
        ================================= */

        /* ACT 1: Old rise - slow and deliberate */
        .cpb-old-rise {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: cpb-draw 4s ease-in-out 0.5s forwards;
        }

        /* Plateau - even slower, the drag */
        .cpb-plateau {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: cpb-draw 4s cubic-bezier(0.4, 0, 0.6, 1) 2.5s forwards;
        }

        /* Ghost flatline */
        .cpb-ghost {
          animation: cpb-ghost-in 2s ease-out 5.5s forwards;
        }

        /* Old dots - fade in along the path */
        .cpb-dot-old { animation: cpb-dot-fade 0.4s ease-out forwards; }
        .cpb-dot-1 { animation-delay: 1s; }
        .cpb-dot-2 { animation-delay: 1.8s; }
        .cpb-dot-3 { animation-delay: 2.6s; }
        .cpb-dot-4 { animation-delay: 3.8s; }
        .cpb-dot-5 { animation-delay: 4.6s; }
        .cpb-dot-6 { animation-delay: 5.4s; }
        .cpb-dot-7 { animation-delay: 6s; }

        /* Old path dims after spark */
        .cpb-old-rise {
          animation: cpb-draw 4s ease-in-out 0.5s forwards, cpb-dim 2s ease-out 7.5s forwards;
        }
        .cpb-plateau {
          animation: cpb-draw 4s cubic-bezier(0.4, 0, 0.6, 1) 2.5s forwards, cpb-dim 2s ease-out 7.5s forwards;
        }

        /* ACT 2: Spark at 6.5s */
        .cpb-spark-core {
          animation: cpb-spark-core-in 0.7s ease-out 6.5s forwards, cpb-pulse 3s ease-in-out 7.2s infinite;
        }
        .cpb-spark-ring {
          animation: cpb-spark-ring-in 1s ease-out 6.5s forwards, cpb-ring-breathe 4s ease-in-out 7.5s infinite;
        }
        .cpb-spark-ray {
          animation: cpb-ray-in 0.8s ease-out 6.6s forwards;
        }
        .cpb-sp1 { animation: cpb-sparkle 2.5s ease-in-out 6.8s infinite; }
        .cpb-sp2 { animation: cpb-sparkle 3s ease-in-out 7s infinite; }
        .cpb-sp3 { animation: cpb-sparkle 2.8s ease-in-out 6.9s infinite; }
        .cpb-sp4 { animation: cpb-sparkle 3.2s ease-in-out 7.1s infinite; }

        /* ACT 3: New path draws from spark - moderate speed, confident */
        .cpb-new-path {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: cpb-draw 3s ease-out 7.5s forwards;
        }

        /* Branches appear */
        .cpb-br1 { animation: cpb-branch-in 1s ease-out 9.5s forwards; }
        .cpb-br2 { animation: cpb-branch-in 1s ease-out 10s forwards; }
        .cpb-br3 { animation: cpb-branch-in 1s ease-out 10.3s forwards; }

        /* New dots */
        .cpb-dn1 { animation: cpb-dot-new-in 0.5s ease-out 8.5s forwards; }
        .cpb-dn2 { animation: cpb-dot-new-in 0.5s ease-out 9.2s forwards; }
        .cpb-dn3 { animation: cpb-dot-new-in 0.5s ease-out 10s forwards; }

        /* New nodes */
        .cpb-nn1 { animation: cpb-dot-new-in 0.5s ease-out 9s forwards; }
        .cpb-nn2 { animation: cpb-dot-new-in 0.5s ease-out 10s forwards; }

        /* ============ KEYFRAMES ============ */
        @keyframes cpb-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes cpb-dot-fade {
          to { fill-opacity: 0.3; }
        }
        @keyframes cpb-ghost-in {
          to { stroke-opacity: 0.2; }
        }
        @keyframes cpb-dim {
          to { opacity: 0.3; }
        }

        @keyframes cpb-spark-core-in {
          0%   { opacity: 0; }
          50%  { opacity: 1; }
          100% { opacity: 0.95; }
        }
        @keyframes cpb-pulse {
          0%, 100% { opacity: 0.88; }
          50% { opacity: 1; }
        }
        @keyframes cpb-spark-ring-in {
          0%   { fill-opacity: 0; }
          40%  { fill-opacity: 0.3; }
          100% { fill-opacity: 0.1; }
        }
        @keyframes cpb-ring-breathe {
          0%, 100% { fill-opacity: 0.07; }
          50% { fill-opacity: 0.15; }
        }
        @keyframes cpb-ray-in {
          0%   { stroke-opacity: 0; }
          40%  { stroke-opacity: 0.6; }
          100% { stroke-opacity: 0.2; }
        }
        @keyframes cpb-sparkle {
          0%, 100% { fill-opacity: 0; transform: translate(0, 0); }
          25% { fill-opacity: 0.55; }
          50% { fill-opacity: 0.25; transform: translate(2px, -3px); }
          75% { fill-opacity: 0.5; }
        }

        @keyframes cpb-branch-in {
          to { stroke-opacity: 0.18; }
        }
        @keyframes cpb-dot-new-in {
          to { fill-opacity: 0.55; }
        }
      `}</style>
    </div>
  );
};

// --- Placeholder Components ---

// VIDEO placeholder - prominent, hero-adjacent
const VideoPlaceholder = () => (
  <div className="relative w-full bg-[#0a1f3d] rounded-2xl border-2 border-dashed border-white/20 overflow-hidden group cursor-pointer hover:border-[#27A1A1]/50 transition-all">
    {/* Fake video thumbnail background */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] via-[#0a2a52] to-[#27A1A1]/20 opacity-80" />
    {/* Main content area */}
    <div className="relative z-10 flex flex-col items-center gap-4 py-16 md:py-20 px-6">
      <div className="w-20 h-20 rounded-full bg-[#27A1A1]/90 flex items-center justify-center shadow-2xl shadow-teal-500/30 group-hover:scale-110 transition-transform">
        <Play className="w-8 h-8 text-white ml-1" />
      </div>
      <div className="text-center">
        <p className="text-white/90 font-bold text-lg">Product Video</p>
        <p className="text-blue-200/50 text-sm font-medium">Coming soon - 60-90 second explainer</p>
      </div>
    </div>
    {/* Dev note - hidden on mobile, visible on larger screens */}
    <div className="relative z-10 mx-3 mb-3 bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10 hidden md:block">
      <p className="text-[10px] text-blue-200/60 font-mono leading-relaxed">
        <Film className="w-3 h-3 inline mr-1" />
        VIDEO: Show the user journey - take assessment, see AI analysis in action, chat with AI coach, get concrete career paths. Emphasize speed (15 min) and specificity (actual job titles, salary data). End with the "aha moment" of seeing personalized results.
      </p>
    </div>
  </div>
);

// SCREENSHOT placeholder - for product screens
const ScreenshotPlaceholder: React.FC<{
  title: string;
  description: string;
  aspect?: string;
  className?: string;
}> = ({ title, description, aspect = 'aspect-[4/3]', className = '' }) => (
  <div className={`relative w-full ${aspect} bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden ${className}`}>
    <div className="relative z-10 flex flex-col items-center gap-3 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1A1A1A]/10 flex items-center justify-center">
        <Camera className="w-6 h-6 text-[#1A1A1A]/40" />
      </div>
      <div>
        <p className="text-[#1A1A1A]/70 font-bold text-sm">{title}</p>
        <p className="text-gray-400 text-xs font-medium mt-1 max-w-xs leading-relaxed">{description}</p>
      </div>
    </div>
    {/* Corner tag */}
    <div className="absolute top-3 right-3 bg-[#D4A024]/10 text-[#D4A024] px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider">
      Screenshot needed
    </div>
  </div>
);

// IMAGE placeholder - for generated images
const ImagePlaceholder: React.FC<{
  prompt: string;
  aspect?: string;
  className?: string;
}> = ({ prompt, aspect = 'aspect-video', className = '' }) => (
  <div className={`relative w-full ${aspect} bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-dashed border-indigo-200 flex flex-col items-center justify-center overflow-hidden ${className}`}>
    <div className="relative z-10 flex flex-col items-center gap-3 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-indigo-400" />
      </div>
      <p className="text-indigo-400 font-bold text-xs">AI-Generated Image</p>
    </div>
    <div className="absolute bottom-3 left-3 right-3 bg-indigo-900/10 backdrop-blur-sm rounded-lg p-3">
      <p className="text-[10px] text-indigo-500/70 font-mono leading-relaxed">
        PROMPT: {prompt}
      </p>
    </div>
    <div className="absolute top-3 right-3 bg-indigo-100 text-indigo-500 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider">
      Generate image
    </div>
  </div>
);


// --- Main Page ---
const Index = () => {
  const { t } = useTranslation(['common', 'landing']);
  const [scrolled, setScrolled] = useState(false);
  const [founderExpanded, setFounderExpanded] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: t('common:nav.howItWorks'), href: "#how-it-works" },
    { name: t('common:nav.pricing'), href: "#pricing" },
    { name: t('common:nav.aboutUs'), href: "#about" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-[#374151] font-sans selection:bg-[#27A1A1] selection:text-white overflow-x-hidden">

      {/* ========== NAVIGATION ========== */}
      <nav className={`fixed w-full z-[100] transition-all duration-500 ${scrolled ? 'bg-[#213F4F]/95 backdrop-blur-xl py-1 shadow-2xl border-b border-white/5' : 'bg-transparent py-2'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="cursor-pointer flex flex-col items-start" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-28 w-auto" />
            <p className="-mt-8 ml-[52px] text-[10px] font-normal tracking-[0.22em] text-[#D4A024]">career path clarity.</p>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`font-bold text-xs uppercase tracking-widest transition-colors ${scrolled ? 'text-blue-100 hover:text-white' : 'text-blue-100/70 hover:text-white'}`}
              >
                {link.name}
              </a>
            ))}
            {!user && (
              <button
                onClick={() => navigate('/auth')}
                className={`font-bold text-xs uppercase tracking-widest transition-colors ${scrolled ? 'text-blue-100 hover:text-white' : 'text-blue-100/70 hover:text-white'}`}
              >
                {t('common:nav.signIn')}
              </button>
            )}
            <LanguageSwitcher className="text-blue-100 hover:text-white" />
            <Button className="py-2.5 px-6 text-xs uppercase tracking-tighter" onClick={handleGetStarted}>
              {user ? t('common:nav.dashboard') : t('common:nav.getStarted')}
            </Button>
          </div>

          <button className="lg:hidden p-2 text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Sidebar */}
        <div className={`fixed inset-0 bg-[#213F4F] z-[101] transition-transform duration-500 transform ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} lg:hidden`}>
          <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-10">
              <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-12 w-auto" />
              <X className="text-white w-8 h-8 cursor-pointer" onClick={() => setMobileMenuOpen(false)} />
            </div>
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-white text-2xl font-bold tracking-tight hover:text-[#27A1A1] transition-colors"
                >
                  {link.name}
                </a>
              ))}
              {!user && (
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/auth'); }}
                  className="text-white text-2xl font-bold tracking-tight hover:text-[#27A1A1] transition-colors text-left"
                >
                  {t('common:nav.signIn')}
                </button>
              )}
              <Button className="w-full text-base py-4 mt-4" onClick={handleGetStarted}>
                {user ? t('common:nav.dashboard') : t('common:nav.getStarted')}
              </Button>
              <div className="mt-4">
                <LanguageSwitcher className="text-white" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative min-h-screen flex items-center bg-[#213F4F] pt-28 pb-20 md:py-20 overflow-hidden">
        {/* Subtle teal gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#27A1A1]/12 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#27A1A1]/20 rounded-full blur-[120px] -mr-96 -mt-96" />
        <CareerPathBg />
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: Copy */}
            <div className="lg:w-1/2 text-center lg:text-left">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-[0.95] tracking-tighter">
                Stop Guessing. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8891A] to-[#F0C040]">Start Thriving.</span>
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-blue-100/60 mb-10 max-w-xl font-medium leading-relaxed">
                Find a career path that actually fits you, not the one you thought you wanted at 16.
              </p>

              <div className="space-y-3 mb-10 text-blue-100/80 font-medium">
                {[
                  "About an hour to your full report",
                  "AI analysis built with career coaches",
                  "Interactive AI coaching chat",
                  "Concrete career recommendations with salary data"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 justify-center lg:justify-start">
                    <div className="w-5 h-5 rounded-full bg-[#27A1A1]/20 flex items-center justify-center">
                      <ArrowRight className="text-[#27A1A1] w-3 h-3" />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button className="text-lg" onClick={handleGetStarted}>Get Started - €39</Button>
                <Button variant="secondary" className="text-lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                  See How It Works
                </Button>
              </div>
            </div>

            {/* Right: Video Placeholder (hidden until real video is ready) */}
            {/* <div className="lg:w-1/2 w-full max-w-xl">
              <VideoPlaceholder />
            </div> */}
          </div>
        </div>
      </section>

      {/* ========== TRUST STRIP ========== */}
      <section className="py-10 bg-[#fcfdfe] border-b border-gray-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { Icon: Shield, title: 'GDPR compliant', desc: 'European servers. Your data stays in Europe.' },
              { Icon: Lock, title: 'Payments by Stripe', desc: 'We never see your card.' },
              { Icon: Trash2, title: 'One-click delete', desc: 'Your data is yours. Take it back anytime.' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-gradient-to-br from-[#27A1A1] to-[#3989AF] rounded-xl flex items-center justify-center text-white shrink-0">
                  <item.Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black text-sm text-[#1A1A1A]">{item.title}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how-it-works" className="py-24 md:py-32 bg-white scroll-mt-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 leading-tight tracking-tight">From Assessment to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#27A1A1] to-[#3989AF]">Action</span></h2>
            <p className="text-xl text-gray-500 font-medium max-w-2xl mx-auto">Five steps, from assessment to landing the job. Concrete career paths that actually fit who you are today.</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-20">

            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="md:w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27A1A1] to-[#3989AF] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-teal-500/30">1</div>
                  <h3 className="text-2xl font-black text-[#1A1A1A]">Take the Assessment</h3>
                </div>
                <p className="text-gray-500 text-lg leading-relaxed font-medium ml-16">
                  Answer questions about your background, skills, work style, values, and goals. Designed to capture what actually matters for career fit - not just personality types.
                </p>
              </div>
              {/* Screenshot slot: set the text div above to md:w-1/2, then uncomment and swap for a real <img> of a survey question.
              <div className="md:w-1/2">
                <ScreenshotPlaceholder title="The assessment" description="A question from the survey" />
              </div>
              */}
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row-reverse gap-10 items-center">
              <div className="md:w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27A1A1] to-[#3989AF] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-teal-500/30">2</div>
                  <h3 className="text-2xl font-black text-[#1A1A1A]">AI Analyzes Your Profile</h3>
                </div>
                <p className="text-gray-500 text-lg leading-relaxed font-medium ml-16">
                  Multiple specialized AI workflows analyze your responses, generate your personality profile, and match you to specific careers with personalized justifications.
                </p>
              </div>
              {/* Screenshot slot: set the text div above to md:w-1/2, then uncomment and swap for a real <img> of the analysis / processing screen.
              <div className="md:w-1/2">
                <ScreenshotPlaceholder title="AI analysis" description="The profile being built" />
              </div>
              */}
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="md:w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27A1A1] to-[#3989AF] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-teal-500/30">3</div>
                  <h3 className="text-2xl font-black text-[#1A1A1A]">Chat With Your AI Coach</h3>
                </div>
                <p className="text-gray-500 text-lg leading-relaxed font-medium ml-16">
                  Discuss your results one-on-one. Ask follow-up questions, explore specific careers in depth, and get honest answers about fit, trade-offs, and next steps.
                </p>
              </div>
              {/* Screenshot slot: set the text div above to md:w-1/2, then uncomment and swap for a real <img> of the AI coach chat.
              <div className="md:w-1/2">
                <ScreenshotPlaceholder title="AI coach chat" description="A coaching conversation" />
              </div>
              */}
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row-reverse gap-10 items-center">
              <div className="md:w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27A1A1] to-[#3989AF] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-teal-500/30">4</div>
                  <h3 className="text-2xl font-black text-[#1A1A1A]">Get Your Report</h3>
                </div>
                <p className="text-gray-500 text-lg leading-relaxed font-medium ml-16">
                  Your complete career report - incorporating chat feedback - with personality analysis, all career recommendations, salary data, AI impact ratings, and concrete next steps.
                </p>
              </div>
              {/* Screenshot slot: set the text div above to md:w-1/2, then uncomment and swap for a real <img> of the report / a career card.
              <div className="md:w-1/2">
                <ScreenshotPlaceholder title="Your report" description="A career recommendation card" />
              </div>
              */}
            </div>

            {/* Step 5 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="md:w-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27A1A1] to-[#3989AF] text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-teal-500/30">5</div>
                  <h3 className="text-2xl font-black text-[#1A1A1A]">Land the Job</h3>
                </div>
                <p className="text-gray-500 text-lg leading-relaxed font-medium ml-16">
                  Pick the recommendations that resonate and Cairnly finds live job openings for them. When you apply, it tailors your resume and cover letter using everything it already learned about you, no prompting required.
                </p>
                <p className="text-[#D4A024] text-sm font-black ml-16 mt-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  These job-landing features are in beta and free to unlock.
                </p>
              </div>
              {/* Screenshot slot: set the text div above to md:w-1/2, then uncomment and swap for a real <img> of the job-openings finder.
              <div className="md:w-1/2">
                <ScreenshotPlaceholder title="Land the job" description="The job-openings finder" />
              </div>
              */}
            </div>
          </div>
        </div>
      </section>

      {/* ========== WHAT MAKES CAIRNLY DIFFERENT (compact) ========== */}
      <section className="py-24 md:py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight">Not another <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#27A1A1] to-[#3989AF]">personality test</span></h2>
            <p className="text-xl text-gray-300 font-medium max-w-2xl mx-auto">Cairnly gives you actual job titles, salary data, and honest reality checks - not vague personality insights you'll forget by tomorrow.</p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: MessageSquare, title: "Interactive, not static", desc: "An AI coach walks you through results and answers your questions. No PDF you read once and forget." },
              { icon: BarChart3, title: "Future-aware", desc: "Every career includes an AI impact assessment showing how AI is set to reshape that role." },
              { icon: CheckCircle2, title: "Honest, not flattering", desc: "Reality checks on challenges, trade-offs, and skills you'd need to develop. No cheerleading." },
              { icon: FileText, title: "Specific, not vague", desc: "Up to 14 career recommendations with salary ranges, day-to-day breakdowns, and personalized fit explanations." },
            ].map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 flex gap-5 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-[#27A1A1] to-[#3989AF] rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/20">
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-[#1A1A1A] mb-2">{item.title}</h4>
                  <p className="text-gray-500 leading-relaxed font-medium text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS — hidden until real beta-user quotes are collected ==========
           Do NOT fill these with invented quotes. Fabricated testimonials are deceptive and
           illegal under EU consumer law. When you have real, permissioned beta-user quotes,
           replace the placeholders below (first name + role/situation), then uncomment.
      <section className="py-24 md:py-32 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-6 tracking-tight">
              What early users say
            </h2>
            <p className="text-xl text-gray-500 font-medium max-w-2xl mx-auto">
              Real words from people who took Cairnly during the beta.
            </p>
          </div>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { quote: '[Real beta-user quote.]', name: '[First name]', detail: '[Role or situation]' },
              { quote: '[Real beta-user quote.]', name: '[First name]', detail: '[Role or situation]' },
              { quote: '[Real beta-user quote.]', name: '[First name]', detail: '[Role or situation]' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 p-8 rounded-2xl border border-gray-100 flex flex-col">
                <p className="text-gray-700 leading-relaxed font-medium flex-1">{item.quote}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#27A1A1]/15 shrink-0" />
                  <div>
                    <p className="font-black text-sm text-[#1A1A1A]">{item.name}</p>
                    <p className="text-xs text-gray-400 font-medium">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      ====================================================================== */}

      {/* ========== PRICING ========== */}
      <section id="pricing" className="relative py-24 md:py-32 bg-[#213F4F] text-white scroll-mt-24 overflow-hidden">
        {/* Subtle teal gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tl from-[#27A1A1]/8 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col md:flex-row">
            {/* Value Side */}
            <div className="p-10 md:p-16 flex-1 text-[#1A1A1A]">
              <div className="text-[#27A1A1] font-black uppercase tracking-[0.2em] text-[10px] mb-4">The Package</div>
              <h2 className="text-3xl md:text-4xl font-black mb-10 tracking-tighter">Everything you need to find your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#27A1A1] to-[#3989AF]">right path</span></h2>
              <div className="space-y-5">
                {[
                  "Complete personality and career assessment",
                  "AI analysis tailored to your goals",
                  "Interactive coaching chat with follow-up questions",
                  "Up to 14 careers in 4 categories",
                  "Role details and localized salary ranges",
                  "AI impact ratings on all suggested roles",
                  "Dream job feasibility assessment",
                  "Full report incl. feedback from the chat"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 font-bold text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-[#27A1A1] shrink-0 mt-0.5" />
                    <span className="text-sm leading-tight">{item}</span>
                  </div>
                ))}
                <div className="flex items-start gap-4 font-black text-[#D4A024] pt-4">
                  <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-sm leading-tight">Like the suggestions? We help you land the job (beta)</span>
                </div>
              </div>
            </div>

            {/* Action Side */}
            <div className="bg-slate-50 p-10 md:p-16 md:w-[380px] flex flex-col justify-center items-center text-center border-t md:border-t-0 md:border-l border-gray-100">
              <div className="bg-[#D4A024] text-[#1A1A1A] px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8">Beta Access</div>
              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-gray-300 line-through text-2xl font-bold">€79</span>
                <span className="text-6xl font-black text-[#1A1A1A] tracking-tighter">€39</span>
              </div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-10">Introductory Price</p>
              <Button className="w-full py-6 text-xl tracking-tight shadow-xl" onClick={() => navigate('/payment')}>Get Beta Access</Button>
              <p className="text-gray-400 text-xs font-medium mt-6">Full refund if you're not satisfied.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== WHO THIS IS FOR / NOT FOR ========== */}
      <section className="py-24 md:py-32 bg-white">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h3 className="text-2xl font-black text-[#1A1A1A] mb-8 flex items-center gap-4">
                <CheckCircle2 className="text-[#27A1A1] w-7 h-7 shrink-0" />
                <span>You're in the right place if:</span>
              </h3>
              <ul className="space-y-5">
                {[
                  "You're questioning whether your current career still fits",
                  "You made career choices based on limited information or others' expectations",
                  "You're facing a career transition and want data-backed options",
                  "You're open to exploring directions you haven't seriously considered before",
                  "You want concrete next steps, not vague personality insights"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 text-gray-700 font-bold leading-snug">
                    <span className="text-[#27A1A1]">•</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-black text-[#1A1A1A] mb-8 flex items-center gap-4">
                <XCircle className="text-red-400 w-7 h-7 shrink-0" />
                <span>This probably isn't for you if:</span>
              </h3>
              <ul className="space-y-5">
                {[
                  "You're mainly looking to get promoted or advance within your current field (Cairnly explores new directions, not optimizes existing ones)",
                  "You need industry-specific technical training (we help you find the right direction first)",
                  "You want validation for a decision you've already made (we give honest assessments, not cheerleading)"
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 text-gray-400 font-bold leading-snug">
                    <span className="text-gray-300">•</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOUNDER ========== */}
      <section id="about" className="py-24 md:py-32 bg-gray-50 border-t border-gray-100 scroll-mt-24">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Why I <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#27A1A1] to-[#3989AF]">Built This</span></h2>
          </div>
          <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-[#1A1A1A] rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-xl">SG</div>
                <div>
                  <div className="font-black text-[#1A1A1A] text-2xl tracking-tighter">Sjoerd Geurts</div>
                  <div className="text-[#27A1A1] uppercase tracking-[0.25em] text-[10px] font-black">Founder, Cairnly</div>
                </div>
              </div>
              <img src={CairnlySymbol} alt="Cairnly" className="w-28 h-28 md:w-36 md:h-36 object-contain hidden sm:block" />
            </div>
            <div className="space-y-6 text-gray-600 leading-relaxed font-medium text-lg">
              <p>I've watched too many smart people stuck in careers they fell into by accident. Myself included.</p>
              <div className={`space-y-6 overflow-hidden transition-all duration-700 ${founderExpanded ? 'max-h-[2000px]' : 'max-h-[140px] relative'}`}>
                <p>Most of us made career decisions based on what we were "supposed" to do, what subjects we happened to be good at, or what seemed safe at the time. Then life happens - your priorities shift, the market changes, AI starts eating jobs - and suddenly you're questioning everything.</p>
                <p>Traditional career coaching is expensive and often just as confused about the future as you are. Generic career tests give you personality types and vague suggestions. You need something that actually helps.</p>
                <p>Cairnly combines proven career coaching methodology with AI analysis to give you concrete, honest career recommendations based on who you are right now - not who your parents expected you to become.</p>
                <p className="font-black text-[#1A1A1A]">Currently in beta. Your feedback shapes what this becomes.</p>
                {!founderExpanded && <div className="absolute bottom-0 left-0 w-full h-28 bg-gradient-to-t from-white to-transparent" />}
              </div>
              <button onClick={() => setFounderExpanded(!founderExpanded)} className="text-[#27A1A1] font-black text-sm flex items-center gap-2 group tracking-widest uppercase py-4">
                {founderExpanded ? "Read Less" : "Read Full Story"} <ChevronDown className={`w-4 h-4 transition-transform group-hover:translate-y-1 ${founderExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CAREER CRISIS (collapsible, accessible but not prominent) ========== */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6 max-w-3xl">
          <button
            onClick={() => setCrisisOpen(!crisisOpen)}
            className="w-full flex items-center justify-between py-4 group"
          >
            <div className="flex items-center gap-4">
              <BarChart3 className="w-6 h-6 text-[#1A1A1A]/40" />
              <div className="text-left">
                <h3 className="text-lg font-black text-[#1A1A1A]">The Career Uncertainty Crisis</h3>
                <p className="text-sm text-gray-400 font-medium">85% global disengagement. 66% career regret. See the data.</p>
              </div>
            </div>
            {crisisOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          <div className={`overflow-hidden transition-all duration-700 ${crisisOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-6 pb-4">
              <div className="bg-[#213F4F] rounded-2xl p-8 md:p-12 text-white mb-8">
                <div className="text-[#27A1A1] font-black uppercase tracking-[0.2em] text-[10px] mb-4">2025 Career Satisfaction Report</div>
                <h3 className="text-3xl md:text-4xl font-black mb-4 leading-tight">85% Global Disengagement</h3>
                <p className="text-blue-100/60 font-medium leading-relaxed max-w-lg">Workers report feeling disconnected from their daily purpose and long-term career trajectory.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <div className="text-3xl font-black text-white mb-2">66%</div>
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Career Regret</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <div className="text-3xl font-black text-white mb-2">50%</div>
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Actively Looking</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <div className="text-3xl font-black text-white mb-2">54%</div>
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Job Stress</p>
                </div>
              </div>

              <p className="text-gray-500 font-medium leading-relaxed mb-6">
                The problem starts early - career decisions based on limited information, parental expectations, or what subjects you happened to be good at in school. Now those choices show up as stress, regret, and Sunday night dread.
              </p>

              <Button variant="outline" className="text-sm py-3 px-6" onClick={() => window.open('https://www.cairnly.io/report', '_blank')}>
                Read the Full Research Report <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="py-32 md:py-40 bg-[#213F4F] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#213F4F] via-transparent to-[#27A1A1]/10 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[#C8891A] to-[#F0C040]">Ready to Stop Guessing?</h2>
          <p className="text-lg md:text-xl text-blue-100/70 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
            Take the assessment, get honest recommendations, make informed decisions.
          </p>
          <div className="flex justify-center">
            <Button className="text-xl md:text-2xl py-7 px-14 mb-6 uppercase tracking-widest shadow-[0_0_50px_rgba(39,161,161,0.3)]" onClick={() => navigate('/payment')}>
              Get career path clarity now!
            </Button>
          </div>
          <p className="text-blue-100/70 text-[10px] font-black uppercase tracking-[0.4em] mt-4">During beta full refund if you're not satisfied!</p>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src={CairnlyWordmark} alt="Cairnly" className="h-10 w-auto" />
            </div>
            <p className="text-gray-500 font-bold text-[10px] tracking-[0.3em] uppercase">© 2026 CAIRNLY</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
            <a href="/privacy-policy" className="hover:text-[#27A1A1] transition-colors">Privacy Policy</a>
            <a href="/terms-conditions" className="hover:text-[#27A1A1] transition-colors">Terms of Service</a>
            <a href="/cookie-policy" className="hover:text-[#27A1A1] transition-colors">Cookie Policy</a>
            <a href="/support" className="hover:text-[#27A1A1] transition-colors">Support</a>
            <a href="/security" className="hover:text-[#27A1A1] transition-colors">Security</a>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-4">Built in the Netherlands. GDPR compliant. Payments by Stripe.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
