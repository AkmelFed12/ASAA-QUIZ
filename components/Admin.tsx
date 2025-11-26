
import React, { useState, useEffect, useRef } from 'react';
import { getGlobalState, saveGlobalState, getQuestionsBank, saveQuestion, deleteQuestion, getResults, getUsers, saveUser } from '../services/storageService';
import { GlobalState, Question, Difficulty, User, QuizResult } from '../types';
import { Power, Settings, Clock, Loader2, Database, Upload, Trash2, Edit2, Plus, Save, X, Mail, Users, LayoutDashboard, Search, Filter, Shield, ShieldAlert, Download } from 'lucide-react';

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'USERS' | 'QUESTIONS' | 'CONFIG'>('DASHBOARD');
  
  // Data State
  const [state, setState] = useState<GlobalState>({ isManualOverride: false, isQuizOpen: false });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');

  // Edit Question State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFormState: Question = {
      questionText: '',
      options: ['', '', '', ''],
      correctAnswerIndex: 0,
      explanation: '',
      difficulty: 'MEDIUM',
      source: 'MANUAL'
  };
  const [formData, setFormData] = useState<Question>(initialFormState);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const [globalData, questionsData, usersData, resultsData] = await Promise.all([
      getGlobalState(),
      getQuestionsBank(),
      getUsers(),
      getResults()
    ]);
    
    setState(globalData);
    setQuestions(questionsData);
    setUsers(usersData);
    setResults(resultsData);
    setLoading(false);
  };

  // --- Filter Logic ---
  const filteredQuestions = questions.filter(q => filterDifficulty === 'ALL' || q.difficulty === filterDifficulty);

  // --- Actions ---

  const handleToggleOverride = async () => {
    const newState = { ...state, isManualOverride: !state.isManualOverride };
    setState(newState);
    await saveGlobalState(newState);
  };

  const handleToggleStatus = async () => {
    const newState = { ...state, isQuizOpen: !state.isQuizOpen };
    setState(newState);
    await saveGlobalState(newState);
  };

  const handleRoleToggle = async (targetUser: User) => {
    if (targetUser.username.toLowerCase() === 'admin') {
        alert("Impossible de modifier le rôle du super-administrateur principal.");
        return;
    }

    const newRole: 'USER' | 'ADMIN' = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const action = newRole === 'ADMIN' ? 'promouvoir' : 'rétrograder';

    if (window.confirm(`Êtes-vous sûr de vouloir ${action} "${targetUser.username}" en tant que ${newRole} ?`)) {
        try {
            const updatedUser: User = { ...targetUser, role: newRole };
            await saveUser(updatedUser);
            await refreshData();
        } catch (error) {
            console.error("Erreur lors du changement de rôle", error);
            alert("Erreur lors de la mise à jour du rôle.");
        }
    }
  };

  const handleEmailBackup = async () => {
      const backupData = {
          users,
          results,
          questions,
          timestamp: new Date().toISOString()
      };
      const subject = "BACKUP DONNÉES ASAA APP";
      const body = `Voici le backup complet des données (Format JSON):\n\n${JSON.stringify(backupData)}`;
      
      if (body.length > 2000) {
          alert("Backup trop volumineux pour mailto. Copiez les données depuis la console.");
          console.log(backupData);
      } else {
          window.location.href = `mailto:ouattaral2@student.iugb.edu.ci?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      }
  };

  const handleExportCSV = () => {
      if (results.length === 0) {
          alert("Aucune donnée à exporter.");
          return;
      }

      const headers = ["Date", "Heure", "Utilisateur", "Score", "Total Questions", "Niveau"];
      const csvRows = [headers.join(',')];

      results.forEach(row => {
          const dateObj = new Date(row.date);
          const date = dateObj.toLocaleDateString();
          const time = dateObj.toLocaleTimeString();
          
          // Escape quotes and commas
          const escape = (str: string | number | undefined) => {
              if (str === undefined || str === null) return '';
              const stringValue = String(str);
              if (stringValue.includes(',') || stringValue.includes('"')) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
          };

          const values = [
              escape(date),
              escape(time),
              escape(row.username),
              escape(row.score),
              escape(row.totalQuestions),
              escape(row.difficultyLevel || '-')
          ];
          csvRows.push(values.join(','));
      });

      // Add BOM for Excel compatibility with UTF-8
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quiz_results_asaa_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Question Logic ---
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveQuestion(formData);
    setIsFormOpen(false);
    setFormData(initialFormState);
    setEditingQuestion(null);
    refreshData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Supprimer cette question ?')) {
        await deleteQuestion(id);
        refreshData();
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (Array.isArray(json)) {
                  let count = 0;
                  for (const q of json) {
                      if (q.questionText) {
                          await saveQuestion({ ...q, source: 'MANUAL' });
                          count++;
                      }
                  }
                  alert(`${count} questions importées.`);
                  refreshData();
              }
          } catch (err) { alert("Erreur fichier JSON."); }
      };
      reader.readAsText(file);
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600" />
      </div>
    );
  }

  // --- Navigation Component ---
  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all w-full md:w-auto justify-center md:justify-start
            ${activeTab === id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent hover:border-gray-200'}`}
      >
          <Icon size={18} />
          <span>{label}</span>
      </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
         <h2 className="text-2xl font-bold font-serif text-gray-800">Panneau d'Administration</h2>
         <button onClick={handleEmailBackup} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 flex items-center gap-2">
            <Mail size={14} /> Backup
         </button>
      </div>

      {/* Nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 bg-gray-100 p-2 rounded-2xl">
          <TabButton id="DASHBOARD" label="Vue d'ensemble" icon={LayoutDashboard} />
          <TabButton id="USERS" label="Utilisateurs" icon={Users} />
          <TabButton id="QUESTIONS" label="Banque Quiz" icon={Database} />
          <TabButton id="CONFIG" label="Configuration" icon={Settings} />
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-gray-500 font-medium">Utilisateurs Inscrits</h3>
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{users.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-gray-500 font-medium">Questions en Banque</h3>
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Database size={20} /></div>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{questions.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-gray-500 font-medium">Quiz Joués (Total)</h3>
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Clock size={20} /></div>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{results.length}</p>
              </div>

              <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800">Activité Récente</h3>
                    <button 
                        onClick={handleExportCSV} 
                        className="text-sm bg-green-50 text-green-600 px-3 py-1.5 rounded hover:bg-green-100 flex items-center gap-2 transition border border-green-100"
                    >
                        <Download size={14} /> Exporter CSV
                    </button>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Utilisateur</th>
                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Niveau</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.slice(0, 5).map((r, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">{new Date(r.date).toLocaleString()}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{r.username}</td>
                                    <td className="px-4 py-3">{r.score} pts</td>
                                    <td className="px-4 py-3">{r.difficultyLevel || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
              </div>
          </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                          <th className="px-6 py-4">Nom d'utilisateur</th>
                          <th className="px-6 py-4">Rôle</th>
                          <th className="px-6 py-4 text-right">Dernière Connexion</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {users.map((u) => (
                          <tr key={u.username} className="hover:bg-gray-50 group">
                              <td className="px-6 py-4 font-medium text-gray-900">{u.username}</td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {u.role}
                                      </span>
                                      {/* Bouton de changement de rôle */}
                                      {u.username.toLowerCase() !== 'admin' && (
                                        <button 
                                            onClick={() => handleRoleToggle(u)}
                                            title={u.role === 'ADMIN' ? "Rétrograder en Membre" : "Promouvoir Admin"}
                                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                                        >
                                            {u.role === 'ADMIN' ? <ShieldAlert size={16} /> : <Shield size={16} />}
                                        </button>
                                      )}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-500">
                                  {u.lastPlayedDate ? new Date(u.lastPlayedDate).toLocaleDateString() : 'Jamais'}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* --- QUESTIONS TAB --- */}
      {activeTab === 'QUESTIONS' && (
          <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 gap-4">
                 <div className="flex gap-2">
                     <button onClick={() => { setFormData(initialFormState); setEditingQuestion(null); setIsFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                         <Plus size={16} /> Ajouter Question
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                         <Upload size={16} /> Importer
                     </button>
                     <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <Filter size={16} className="text-gray-500" />
                        <select 
                            value={filterDifficulty} 
                            onChange={(e) => setFilterDifficulty(e.target.value)}
                            className="bg-transparent text-sm text-gray-700 font-medium outline-none cursor-pointer"
                        >
                            <option value="ALL">Tous les niveaux</option>
                            <option value="EASY">Facile</option>
                            <option value="MEDIUM">Moyen</option>
                            <option value="HARD">Difficile</option>
                            <option value="EXPERT">Expert</option>
                        </select>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="text-gray-500 text-sm whitespace-nowrap">{filteredQuestions.length} / {questions.length}</div>
                 </div>
              </div>

              {isFormOpen && (
                  <div className="bg-white p-6 rounded-xl border-2 border-emerald-500 shadow-xl">
                      <h4 className="font-bold text-lg mb-4 text-emerald-800">{editingQuestion ? 'Modifier' : 'Nouveau'}</h4>
                      <form onSubmit={handleSaveQuestion} className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase">Question</label>
                              <textarea required value={formData.questionText} onChange={e => setFormData({...formData, questionText: e.target.value})} className="w-full mt-1 p-2 border rounded-md" rows={2} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {formData.options.map((opt, idx) => (
                                  <div key={idx}>
                                      <input required value={opt} placeholder={`Option ${idx + 1}`} onChange={e => { const newOpts = [...formData.options]; newOpts[idx] = e.target.value; setFormData({...formData, options: newOpts}); }} className={`w-full p-2 border rounded-md ${formData.correctAnswerIndex === idx ? 'border-green-500 bg-green-50' : ''}`} />
                                  </div>
                              ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">Bonne Réponse</label>
                                  <select value={formData.correctAnswerIndex} onChange={e => setFormData({...formData, correctAnswerIndex: parseInt(e.target.value)})} className="w-full mt-1 p-2 border rounded-md">
                                      {formData.options.map((_, idx) => <option key={idx} value={idx}>Option {idx + 1}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase">Difficulté</label>
                                  <select value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value as Difficulty})} className="w-full mt-1 p-2 border rounded-md">
                                      <option value="EASY">Facile</option>
                                      <option value="MEDIUM">Moyen</option>
                                      <option value="HARD">Difficile</option>
                                      <option value="EXPERT">Expert</option>
                                  </select>
                              </div>
                          </div>
                          <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-gray-600">Annuler</button>
                              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Enregistrer</button>
                          </div>
                      </form>
                  </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                              <th className="px-4 py-3 text-left">Question</th>
                              <th className="px-4 py-3 text-left">Niveau</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredQuestions.map((q) => (
                              <tr key={q.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 max-w-lg truncate">{q.questionText}</td>
                                  <td className="px-4 py-3">
                                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${q.difficulty === 'EXPERT' ? 'bg-purple-100 text-purple-700' : q.difficulty === 'HARD' ? 'bg-orange-100 text-orange-700' : q.difficulty === 'EASY' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {q.difficulty}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                                      <button onClick={() => { setEditingQuestion(q); setFormData(q); setIsFormOpen(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                                      <button onClick={() => q.id && handleDelete(q.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {filteredQuestions.length === 0 && (
                      <div className="p-8 text-center text-gray-500">Aucune question trouvée pour ce filtre.</div>
                  )}
              </div>
          </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === 'CONFIG' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8 animate-in fade-in">
              <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock /> Contrôle d'Accès</h3>
                  <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                      <div>
                          <p className="font-medium text-gray-900">Horaire Automatique</p>
                          <p className="text-sm text-gray-500">20h00 - 00h00 (GMT)</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${!state.isManualOverride ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {!state.isManualOverride ? 'ACTIF' : 'INACTIF'}
                      </span>
                  </div>
              </div>

              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Power /> Forçage Manuel</h3>
                      <button onClick={handleToggleOverride} className={`w-12 h-6 rounded-full transition-colors p-1 ${state.isManualOverride ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${state.isManualOverride ? 'translate-x-6' : ''}`} />
                      </button>
                  </div>
                  
                  {state.isManualOverride && (
                      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl text-center">
                          <p className="text-indigo-900 font-medium mb-4">État actuel du Quiz : {state.isQuizOpen ? <span className="text-green-600 font-bold">OUVERT</span> : <span className="text-red-600 font-bold">FERMÉ</span>}</p>
                          <button 
                            onClick={handleToggleStatus}
                            className={`px-6 py-3 rounded-lg font-bold text-white shadow-lg transition transform active:scale-95 ${state.isQuizOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                          >
                              {state.isQuizOpen ? 'STOPPER IMMÉDIATEMENT' : 'OUVRIR MAINTENANT'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
