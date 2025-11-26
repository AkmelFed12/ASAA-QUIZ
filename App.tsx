import React, { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, getGlobalState, initDB } from './services/storageService';
import { User, AppView } from './types';
import { Layout } from './components/Layout';
import { Auth } from './components/Auth';
import { Quiz } from './components/Quiz';
import { Leaderboard } from './components/Leaderboard';
import { Admin } from './components/Admin';
import { Profile } from './components/Profile';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';

const HADITHS = [
  "Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne.",
  "La pureté est la moitié de la foi.",
  "Celui qui croit en Allah et au Jour dernier, qu'il dise du bien ou qu'il se taise.",
  "Nulle richesse n'égale l'intelligence, nulle pauvreté n'égale l'ignorance.",
  "Le fort n'est pas celui qui terrasse ses adversaires, mais celui qui se maîtrise dans la colère.",
  "Allah est Beau et Il aime la beauté.",
  "Faites cadeau les uns aux autres, vous vous aimerez.",
  "Le sourire est une aumône.",
  "Craignez Allah où que vous soyez.",
  "La religion, c'est le bon comportement."
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [hadith, setHadith] = useState("");
  const [isDbReady, setIsDbReady] = useState(false);
  
  // Quiz availability state
  const [isQuizAvailable, setIsQuizAvailable] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  // Initial Load
  useEffect(() => {
    const initialize = async () => {
        try {
            await initDB();
            setIsDbReady(true);
            const loadedUser = getCurrentUser();
            if (loadedUser) {
              setUser(loadedUser);
              setView(AppView.HOME);
            }
            // Set random Hadith
            setHadith(HADITHS[Math.floor(Math.random() * HADITHS.length)]);
        } catch (e) {
            console.error("Failed to init app", e);
        }
    };
    initialize();
  }, []);

  // Check Quiz Availability Logic
  useEffect(() => {
    const checkAvailability = async () => {
      if (!isDbReady) return;

      try {
          const globalState = await getGlobalState();
          
          // 1. Admin Override Check
          if (globalState.isManualOverride) {
            setIsQuizAvailable(globalState.isQuizOpen);
            setAvailabilityMessage(globalState.isQuizOpen ? "Le quiz est ouvert manuellement." : "Le quiz est fermé par l'administrateur.");
            return;
          }

          // 2. Time Check (20h - 00h)
          const now = new Date();
          const hours = now.getHours();

          // For testing purposes, you might want to broaden this range or rely on Admin Override
          const isOpenTime = hours >= 20 && hours <= 23; 
          // 00h is practically next day start, so 23:59 is end.

          if (!isOpenTime) {
            setIsQuizAvailable(false);
            setAvailabilityMessage("Le quiz est ouvert uniquement entre 20H00 et 00H00.");
            return;
          }

          // 3. One Attempt Per Day Check
          if (user && user.lastPlayedDate) {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastPlayedDate === today) {
              setIsQuizAvailable(false);
              setAvailabilityMessage("Vous avez déjà participé aujourd'hui. Revenez demain insha'Allah.");
              return;
            }
          }

          setIsQuizAvailable(true);
          setAvailabilityMessage("Le quiz est ouvert ! Bismillah.");
      } catch (e) {
          console.error("Error checking availability", e);
      }
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, view, isDbReady]); // Re-check when user or view changes

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView(AppView.HOME);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setView(AppView.AUTH);
  };

  if (!isDbReady) {
      return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Connexion à la base de données...</p>
          </div>
      );
  }

  // Render View Content
  const renderContent = () => {
    if (!user) {
      return <Auth onLogin={handleLogin} />;
    }

    switch (view) {
      case AppView.ADMIN:
        return user.role === 'ADMIN' ? <Admin /> : <div className="text-center text-red-500">Accès refusé</div>;
      
      case AppView.LEADERBOARD:
        return <Leaderboard />;

      case AppView.PROFILE:
        return <Profile user={user} />;
      
      case AppView.QUIZ:
        return <Quiz user={user} onComplete={() => setView(AppView.LEADERBOARD)} />;

      case AppView.HOME:
      default:
        return (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-8 border-emerald-600">
              <div className="p-8 text-center">
                 {/* Decorative Icon - Logo */}
                 <div className="mx-auto w-28 h-28 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg overflow-hidden border-4 border-emerald-50">
                    <img 
                        src="logo.png" 
                        alt="Logo ASAA" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            // Fallback if image missing
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.parentElement) {
                                target.parentElement.innerHTML = '<span class="text-6xl">🕌</span>';
                            }
                        }}
                    />
                 </div>
                
                <h2 className="text-3xl font-serif font-bold text-gray-800 mb-4">Bienvenue, {user.username}</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Testez vos connaissances sur l'Islam, apprenez de nouvelles choses et participez au classement de l'association ASAA.
                </p>

                {isQuizAvailable ? (
                  <button 
                    onClick={() => setView(AppView.QUIZ)}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-10 rounded-full transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 mx-auto"
                  >
                    <span>Commencer le Quiz (Niveau Avancé)</span>
                    <CheckCircle2 size={20} />
                  </button>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="flex flex-col items-center gap-3 text-amber-800">
                      <Clock size={32} className="text-amber-600" />
                      <p className="font-semibold text-center">{availabilityMessage}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                <span>1 participation / jour</span>
                <span>Questions IA Illimitées</span>
              </div>
            </div>

            {/* User Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div 
                 onClick={() => setView(AppView.LEADERBOARD)}
                 className="bg-white p-6 rounded-xl shadow cursor-pointer hover:shadow-md transition border border-gray-100"
               >
                 <h3 className="text-lg font-bold text-gray-800 mb-2">Classement</h3>
                 <p className="text-emerald-600 text-sm font-medium flex items-center gap-1">
                   Voir les meilleurs scores <span aria-hidden="true">&rarr;</span>
                 </p>
               </div>
               
               <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 p-6 rounded-xl shadow text-white flex flex-col justify-center">
                 <h3 className="text-lg font-bold mb-2 flex items-center gap-2">Hadith du jour</h3>
                 <p className="text-emerald-100 text-sm italic leading-relaxed">
                   "{hadith}"
                 </p>
               </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      currentView={view} 
      onNavigate={setView}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;