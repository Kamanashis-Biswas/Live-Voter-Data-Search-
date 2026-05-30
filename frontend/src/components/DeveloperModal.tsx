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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-300">
      
      {/* Glow effects in background */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Modal Container */}
      <div className="bg-slate-900/90 border border-slate-800 text-white rounded-3xl overflow-hidden shadow-2xl relative max-w-2xl w-full mx-auto max-h-[90vh] flex flex-col transform transition-all duration-500 scale-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        
        {/* Banner / Header */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 p-6 sm:p-8 relative shrink-0">
          
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
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-6 pt-4 border-t border-white/10 text-xs">
            <span className="px-3 py-1 bg-white/15 rounded-full font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-300" />
              3+ Years Experience
            </span>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5 animate-pulse-slow">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Available for Projects
            </span>
          </div>

        </div>

        {/* Bio Banner / Headline */}
        <div className="bg-slate-950 border-b border-slate-800/80 px-6 sm:px-8 py-3 text-center sm:text-left shrink-0">
          <p className="text-[11px] sm:text-xs text-slate-300 tracking-wide font-medium italic">
            🚀 MERN Stack Developer • Modern Web Solutions • React & Node.js Expert
          </p>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
          
          {/* Tech Stack Header */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <span className="w-2 h-4 bg-indigo-500 rounded-sm"></span>
            <h3 className="font-bold text-sm tracking-widest text-slate-400 uppercase">PROFESSIONAL TECH STACK</h3>
          </div>

          {/* Grid of Skill Categories */}
          <div className="grid grid-cols-1 gap-5">
            {Object.values(skills).map((category, idx) => (
              <div 
                key={idx} 
                className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start gap-4 hover:border-slate-700/80 hover:bg-slate-950/60 transition-all duration-300 group"
              >
                
                {/* Category Icon & Title */}
                <div className="flex items-center sm:flex-col sm:items-start shrink-0 gap-3 sm:gap-1.5 sm:w-44">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    {category.icon}
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-200 tracking-tight">
                    {category.title}
                  </h4>
                </div>

                {/* Skill Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {category.items.map((item, key) => (
                    <span 
                      key={key} 
                      className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg border font-mono transition-transform hover:scale-105 duration-200 ${category.badgeColor}`}
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
        <div className="bg-slate-950 border-t border-slate-800 px-6 sm:px-8 py-5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span>Built with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse fill-rose-500" />
            <span>by Kamanashis Biswas</span>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="mailto:kamanashis.iict.kuet@gmail.com" 
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Mail className="w-4 h-4 text-cyan-400" />
              Email Me
            </a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Github className="w-4 h-4 text-indigo-400" />
              GitHub
            </a>
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950 transition-all cursor-pointer shrink-0"
            >
              Close Profile
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
