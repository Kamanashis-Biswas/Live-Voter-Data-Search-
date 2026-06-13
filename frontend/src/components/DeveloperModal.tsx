import React, { useEffect } from 'react';
import { 
  X, Sparkles, Terminal, Database, Code2, Layers, Wrench, 
  MapPin, Mail, Github, Award, Briefcase, Heart 
} from 'lucide-react';

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperModal: React.FC<DeveloperModalProps> = ({ isOpen, onClose }) => {
  // Lock scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const skills = {
    frontend: {
      title: 'Frontend Development',
      icon: <Code2 className="w-5 h-5 text-cyan-400" />,
      badgeColor: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300',
      items: ['React', 'Next.js', 'HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'Redux', 'React Query', 'Axios']
    },
    styling: {
      title: 'Styling & Design UI',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      badgeColor: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
      items: ['Tailwind CSS', 'Bootstrap 5', 'daisyUI', 'Flowbite', 'Material-UI', 'Sass', 'Shadcn UI', 'Ant Design']
    },
    backend: {
      title: 'Backend Engineering',
      icon: <Terminal className="w-5 h-5 text-emerald-400" />,
      badgeColor: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
      items: ['Node.js', 'Express.js', 'JWT Auth', 'RESTful APIs', 'Middleware Architectures']
    },
    database: {
      title: 'Database & ORM',
      icon: <Database className="w-5 h-5 text-amber-400" />,
      badgeColor: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
      items: ['MongoDB', 'MySQL', 'Firebase DB', 'Mongoose', 'Prisma ORM', 'PostgreSQL']
    },
    tools: {
      title: 'DevOps & Tooling',
      icon: <Wrench className="w-5 h-5 text-rose-400" />,
      badgeColor: 'bg-rose-500/10 border-rose-500/25 text-rose-300',
      items: ['GitHub VCS', 'VS Code IDE', 'Figma UX/UI', 'Firebase Hosting', 'Netlify CD', 'NPM/Yarn Package managers']
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto custom-scrollbar flex items-start justify-center p-4 sm:p-6 md:p-10 bg-slate-950/85 backdrop-blur-md select-none animate-in fade-in duration-300">
      
      {/* Glow effects in background */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Modal Container */}
      <div className="bg-slate-900/95 border border-slate-800/80 text-white rounded-3xl overflow-hidden shadow-2xl relative max-w-2xl w-full mx-auto my-auto transform transition-all duration-500 scale-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        
        {/* Banner / Header */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 border-b border-slate-800/60 p-6 sm:p-8 relative">
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-950/40 hover:bg-slate-950/70 border border-white/10 rounded-full text-white/80 hover:text-white transition-all cursor-pointer hover:rotate-90 duration-300"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Sparkle background elements */}
          <div className="absolute top-3 left-4 text-white/20 animate-pulse"><Sparkles className="w-4 h-4" /></div>
          
          {/* Profile Header Grid */}
          <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-5 mt-2">
            
            {/* Developer Glowing Avatar */}
            <div className="relative shrink-0 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-violet-600 rounded-full blur-sm opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="w-20 h-20 rounded-full bg-slate-950 border-2 border-white/20 flex items-center justify-center text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-400 shadow-inner select-none relative z-10 font-mono">
                KB
              </div>
            </div>

            {/* Developer Identity */}
            <div className="space-y-1 z-10">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-serif bg-gradient-to-r from-white to-slate-200 text-transparent bg-clip-text">
                Kamanashis Biswas
              </h2>
              <p className="text-cyan-200 text-sm font-bold flex items-center justify-center sm:justify-start gap-1">
                <Code2 className="w-4 h-4 text-cyan-300" />
                Full Stack Developer
              </p>
              <p className="text-white/80 text-xs flex items-center justify-center sm:justify-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-white/60" />
                IICT, KUET, Khulna-9203
              </p>
            </div>

          </div>

          {/* Quick Metrics Bar inside Header */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-5 pt-4 border-t border-white/10 text-[10px] sm:text-xs">
            <span className="px-3 py-1 bg-white/5 rounded-full font-bold flex items-center gap-1 border border-white/10">
              <Award className="w-3.5 h-3.5 text-amber-300" />
              3+ Years Experience
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full font-bold flex items-center gap-1.5 animate-pulse-slow">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Available for Projects
            </span>
          </div>

        </div>

        {/* Bio Banner / Headline */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-3 text-center sm:text-left">
          <p className="text-[11px] sm:text-xs text-slate-300 tracking-wide font-medium italic">
            🚀 MERN Stack Developer • Modern Web Solutions • React & Node.js Expert
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-8 space-y-6">
          
          {/* About Me Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <span className="w-1.5 h-3 bg-indigo-500 rounded-xs"></span>
              <h3 className="font-bold text-xs tracking-widest text-slate-400 uppercase">About Me</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              I am a highly motivated and detail-oriented Full Stack Developer specializing in the MERN Stack. With a passion for building scalable web architectures, clean user interfaces, and robust APIs, I strive to create web solutions that offer top-tier performance and premium user experience.
            </p>
          </div>

          {/* Tech Stack Header */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <span className="w-1.5 h-3 bg-indigo-500 rounded-xs"></span>
            <h3 className="font-bold text-xs tracking-widest text-slate-400 uppercase">PROFESSIONAL TECH STACK</h3>
          </div>

          {/* Grid of Skill Categories */}
          <div className="grid grid-cols-1 gap-4">
            {Object.values(skills).map((category, idx) => (
              <div 
                key={idx} 
                className="bg-slate-950/30 border border-slate-800/50 hover:border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-950/50 transition-all duration-300 group"
              >
                
                {/* Category Icon & Title */}
                <div className="flex items-center gap-3 shrink-0 md:w-48">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl group-hover:scale-110 group-hover:border-slate-700/50 transition-all duration-300">
                    {category.icon}
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-200 tracking-tight">
                    {category.title}
                  </h4>
                </div>

                {/* Skill Badges */}
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {category.items.map((item, key) => (
                    <span 
                      key={key} 
                      className={`px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-lg border transition-all duration-200 hover:brightness-110 hover:scale-105 ${category.badgeColor}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>

              </div>
            ))}
          </div>

        </div>

        {/* Modal Footer (Action Panel) */}
        <div className="bg-slate-950/80 border-t border-slate-800/80 px-5 sm:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span>Built with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse fill-rose-500" />
            <span>by Kamanashis Biswas</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full md:w-auto">
            <div className="flex gap-2.5 w-full sm:w-auto">
              <a 
                href="mailto:kamanashis.iict.kuet@gmail.com" 
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Email Me
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
              >
                <Github className="w-3.5 h-3.5 text-indigo-400" />
                GitHub
              </a>
            </div>
            <button 
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-md shadow-indigo-950 transition-all duration-300 cursor-pointer"
            >
              Close Profile
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
