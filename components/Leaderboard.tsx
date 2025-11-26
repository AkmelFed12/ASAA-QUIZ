
import React, { useMemo, useEffect, useState } from 'react';
import { getResults } from '../services/storageService';
import { Trophy, Calendar, Loader2, Mail } from 'lucide-react';
import { QuizResult } from '../types';

export const Leaderboard: React.FC = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      const data = await getResults();
      setResults(data);
      setIsLoading(false);
    };
    fetchResults();
  }, []);

  // Aggregate stats per user
  const stats = useMemo(() => {
    const userStats: Record<string, { totalScore: number, gamesPlayed: number, lastDate: string }> = {};

    results.forEach(r => {
      if (!userStats[r.username]) {
        userStats[r.username] = { totalScore: 0, gamesPlayed: 0, lastDate: r.date };
      }
      userStats[r.username].totalScore += r.score;
      userStats[r.username].gamesPlayed += 1;
      if (new Date(r.date) > new Date(userStats[r.username].lastDate)) {
        userStats[r.username].lastDate = r.date;
      }
    });

    return Object.entries(userStats)
      .map(([username, data]) => ({ username, ...data }))
      .sort((a, b) => b.totalScore - a.totalScore); // Sort by total score
  }, [results]);

  const sendLeaderboardByEmail = () => {
      const subject = `Classement Général ASAA`;
      let body = `As-salamu alaykum,\n\nVoici le classement actuel des participants :\n\n`;
      
      stats.forEach((s, idx) => {
          body += `#${idx + 1} - ${s.username} : ${s.totalScore} pts (${s.gamesPlayed} quiz)\n`;
      });
      
      body += `\nTotal participants : ${stats.length}\nDate : ${new Date().toLocaleString()}`;

      window.location.href = `mailto:ouattaral2@student.iugb.edu.ci?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-500">Chargement du classement...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8 relative">
        <h2 className="text-3xl font-serif font-bold text-gray-800 flex items-center justify-center gap-3">
          <Trophy className="text-amber-400" size={32} />
          Classement Général
        </h2>
        <p className="text-gray-500 mt-2">Les meilleurs participants de l'association</p>
        
        {stats.length > 0 && (
            <button 
                onClick={sendLeaderboardByEmail}
                className="mt-4 md:absolute md:right-0 md:top-0 md:mt-0 flex items-center gap-2 text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition"
            >
                <Mail size={14} /> Envoyer par mail
            </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {stats.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun résultat pour le moment. Soyez le premier à participer !
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rang</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Membre</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Score Total</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Participations</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Dernier Quiz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.map((stat, index) => (
                  <tr key={stat.username} className={`hover:bg-gray-50 transition ${index < 3 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                        ${index === 0 ? 'bg-amber-400 text-white shadow-sm' : 
                          index === 1 ? 'bg-gray-300 text-white shadow-sm' : 
                          index === 2 ? 'bg-amber-700 text-white shadow-sm' : 'text-gray-500'}`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{stat.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                        {stat.totalScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                      {stat.gamesPlayed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 flex items-center justify-end gap-2">
                      <Calendar size={14} />
                      {new Date(stat.lastDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
