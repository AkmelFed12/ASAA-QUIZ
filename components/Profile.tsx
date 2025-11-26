
import React, { useMemo, useEffect, useState } from 'react';
import { User, QuizResult, UserBadge } from '../types';
import { getResults, getUserBadges, BADGE_DEFINITIONS } from '../services/storageService';
import { User as UserIcon, Award, Calendar, Hash, History, Loader2, Lock, TrendingUp } from 'lucide-react';

interface ProfileProps {
  user: User;
}

export const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [resData, badgesData] = await Promise.all([
        getResults(),
        getUserBadges(user.username)
      ]);
      setResults(resData);
      setUserBadges(badgesData);
      setIsLoading(false);
    };
    fetchData();
  }, [user.username]);

  const userResults = useMemo(() => 
    results
      .filter(r => r.username === user.username)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [results, user.username]
  );
  
  const stats = useMemo(() => {
    const totalScore = userResults.reduce((acc, curr) => acc + curr.score, 0);
    const gamesPlayed = userResults.length;
    const lastDate = user.lastPlayedDate || (userResults.length > 0 ? userResults[0].date : null);
    
    return { totalScore, gamesPlayed, lastDate };
  }, [userResults, user]);

  // Data for the Chart (Last 5 games, Chronological order)
  const chartData = useMemo(() => {
    return [...userResults].slice(0, 5).reverse();
  }, [userResults]);

  // Calculate max score for graph scaling (assume default max is 30, but scale up if bonus points exist)
  const maxGraphScore = Math.max(30, ...chartData.map(d => d.score));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-500">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4 border-emerald-600">
        <div className="p-8 text-center bg-gradient-to-b from-white to-gray-50">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
            <span className="text-4xl font-serif text-emerald-700 font-bold">{user.username.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-gray-800">{user.username}</h2>
          <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wide">
             {user.role === 'ADMIN' ? 'Administrateur' : 'Membre ASAA'}
          </span>
        </div>
      </div>

      {/* Badges Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-serif font-bold text-gray-800 flex items-center gap-2">
           <Award className="text-amber-500" />
           Badges & Réussites
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {BADGE_DEFINITIONS.map(badgeDef => {
             const isUnlocked = userBadges.some(ub => ub.badgeId === badgeDef.id);
             return (
               <div 
                 key={badgeDef.id} 
                 className={`relative p-4 rounded-xl border flex flex-col items-center text-center transition-all duration-300
                    ${isUnlocked 
                      ? 'bg-white border-amber-200 shadow-md scale-100 opacity-100' 
                      : 'bg-gray-50 border-gray-200 opacity-60 grayscale'}`}
               >
                 <div className="text-3xl mb-2">{badgeDef.icon}</div>
                 <h4 className={`font-bold text-sm ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>{badgeDef.name}</h4>
                 <p className="text-[10px] text-gray-500 mt-1 leading-tight">{badgeDef.description}</p>
                 
                 {!isUnlocked && (
                    <div className="absolute top-2 right-2 text-gray-300">
                        <Lock size={12} />
                    </div>
                 )}
               </div>
             );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-amber-50 rounded-full text-amber-500 mb-3">
             <Award size={24} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.totalScore}</h3>
          <p className="text-gray-500 text-sm">Score Total</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-blue-50 rounded-full text-blue-500 mb-3">
             <Hash size={24} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.gamesPlayed}</h3>
          <p className="text-gray-500 text-sm">Participations</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-purple-50 rounded-full text-purple-500 mb-3">
             <Calendar size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">
            {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString() : 'Jamais'}
          </h3>
          <p className="text-gray-500 text-sm">Dernier Quiz</p>
        </div>
      </div>

      {/* Evolution Chart */}
      {chartData.length > 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <h3 className="font-bold text-gray-700">Évolution du Score (5 derniers quiz)</h3>
              </div>
              
              <div className="h-48 flex items-end justify-between gap-2 md:gap-4 px-2">
                  {chartData.map((data, index) => {
                      const heightPercentage = Math.max((data.score / maxGraphScore) * 100, 5); // Min 5% height
                      return (
                          <div key={index} className="flex flex-col items-center justify-end w-full group">
                              <div className="mb-2 opacity-0 group-hover:opacity-100 transition text-xs font-bold text-emerald-600">
                                  {data.score} pts
                              </div>
                              <div 
                                  className="w-full max-w-[50px] bg-emerald-200 rounded-t-lg relative overflow-hidden transition-all duration-500 hover:bg-emerald-300"
                                  style={{ height: `${heightPercentage}%` }}
                              >
                                  <div className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-emerald-600 to-emerald-400 opacity-90"></div>
                              </div>
                              <div className="mt-2 text-[10px] md:text-xs text-gray-500 font-medium text-center">
                                  {new Date(data.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* History List */}
      {userResults.length > 0 && (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
            <History size={18} className="text-gray-500" />
            <h3 className="font-bold text-gray-700">Historique récent</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {userResults.slice(0, 5).map((result, idx) => (
              <li key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div>
                   <p className="text-sm font-medium text-gray-800">
                     {new Date(result.date).toLocaleDateString()}
                     <span className="text-gray-400 mx-2">•</span>
                     {new Date(result.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                     <span className="block font-bold text-emerald-600">{result.score} pts</span>
                     <span className="text-xs text-gray-400">{result.totalQuestions} questions</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
