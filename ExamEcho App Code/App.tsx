import React, { useState, useEffect, useRef } from 'react';
import { 
  AppStep, 
  AppSource,
  QuizType, 
  Difficulty, 
  Quiz, 
  EvaluationResults,
  QuizHistoryEntry
} from './types';
import { detectTopics, generateQuiz, evaluateQuiz, generateStudyNotes } from './services/geminiService';

declare const marked: any;
declare const renderMathInElement: any;

const HISTORY_KEY = 'examecho_history_v2';

const RenderedContent: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(ref.current, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
          ],
          throwOnError: false
        });
      } catch (e) {
        console.warn("KaTeX render error caught:", e);
      }
    }
  }, [text]);

  const html = typeof marked !== 'undefined' ? marked.parse(text) : text;
  return (
    <div 
      ref={ref} 
      className={`prose prose-invert max-w-none ${className || ''}`} 
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

const Header: React.FC<{ onReset: () => void; onShowHistory: () => void }> = ({ onReset, onShowHistory }) => (
  <header className="px-6 md:px-12 h-20 flex justify-between items-center bg-slate-900/40 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
    <div className="flex items-center gap-3 cursor-pointer group" onClick={onReset}>
      <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase">Exam<span className="text-indigo-500">Echo</span></h1>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Your Curriculum</p>
      </div>
    </div>
    <button 
      onClick={onShowHistory}
      className="text-[10px] font-black uppercase tracking-widest bg-slate-800/50 hover:bg-slate-800 text-slate-300 px-5 py-2.5 rounded-full border border-white/5 transition-all"
    >
      Learning Stats
    </button>
  </header>
);

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
    <div className="loader-dots flex gap-2 mb-6">
      <div /> <div /> <div />
    </div>
    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Preparing Session</h3>
    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">{message}</p>
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('UPLOAD');
  const [source, setSource] = useState<AppSource | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('Full Content');
  const [quizType, setQuizType] = useState<QuizType>('MCQ');
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [evaluation, setEvaluation] = useState<EvaluationResults | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch (e) { console.error("History load error."); }
  }, []);

  const saveToHistory = (res: EvaluationResults, qz: Quiz) => {
    const entry: QuizHistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title: qz.quiz_title || "Revision Session",
      percentage: res.percentage,
      results: res,
      quiz: qz
    };
    const updated = [entry, ...(Array.isArray(history) ? history : [])].slice(0, 10);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg('Analyzing and indexing document...');
    setStep('LOADING');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const src: AppSource = { type: 'pdf', data: { base64, mimeType: file.type, name: file.name } };
        setSource(src);
        const tags = await detectTopics(src);
        setTopics(['Full Content', ...(Array.isArray(tags) ? tags : [])]);
        setStep('PREVIEW');
      } catch (err) {
        setStep('UPLOAD');
        alert("Deep analysis failed. Try a standard PDF.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickDraft = async () => {
    if (!topicInput.trim()) return;
    setLoadingMsg('Synthesizing expert module...');
    setStep('LOADING');
    try {
      const notes = await generateStudyNotes(topicInput);
      const src: AppSource = { type: 'generated', topic: topicInput, content: notes };
      setSource(src);
      const tags = await detectTopics(src);
      setTopics(['Full Content', ...(Array.isArray(tags) ? tags : [])]);
      setStep('PREVIEW');
    } catch (e) { setStep('UPLOAD'); }
  };

  const handleStartQuiz = async () => {
    if (!source) return;
    setLoadingMsg('Constructing grounded quiz questions...');
    setStep('LOADING');
    try {
      const qz = await generateQuiz(source, { type: quizType, count, difficulty, topic: selectedTopic });
      if (qz && Array.isArray(qz.questions)) {
        setQuiz(qz);
        setUserAnswers({});
        setStep('QUIZ');
        window.scrollTo(0, 0);
      } else throw new Error();
    } catch (e) { setStep('CONFIG'); }
  };

  const handleFinish = async () => {
    if (!source || !quiz) return;
    setLoadingMsg('Performing cognitive audit...');
    setStep('LOADING');
    try {
      const res = await evaluateQuiz(source, quiz, userAnswers);
      setEvaluation(res);
      saveToHistory(res, quiz);
      setStep('REVIEW');
      window.scrollTo(0, 0);
    } catch (e) { setStep('QUIZ'); }
  };

  const safeTopics = Array.isArray(topics) ? topics : [];
  const safeHistory = Array.isArray(history) ? history : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 selection:bg-indigo-500/30">
      <Header 
        onReset={() => setStep('UPLOAD')} 
        onShowHistory={() => setStep('HISTORY_VIEW')} 
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:py-16">
        {step === 'LOADING' && <LoadingOverlay message={loadingMsg} />}

        {step === 'UPLOAD' && (
          <div className="animate-in max-w-2xl mx-auto py-12">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tighter leading-tight">Elevate Your <br/> <span className="text-indigo-500">Academic Potential.</span></h2>
              <p className="text-slate-400 text-lg font-medium max-w-md mx-auto">Upload your notes to index or draft professional study modules instantly.</p>
            </div>

            <div className="grid gap-8">
              <label className="block group cursor-pointer">
                <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-[2.5rem] p-16 text-center hover:border-indigo-500/50 hover:bg-slate-900/60 transition-all shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-indigo-600/10 p-6 rounded-full w-fit mx-auto mb-6 group-hover:scale-110 transition-transform relative z-10">
                    <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 relative z-10">Upload PDF Notes</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] relative z-10">Deep indexing and RAG enabled</p>
                  <input type="file" className="hidden" accept=".pdf" onChange={onFileUpload} />
                </div>
              </label>

              <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 text-center">Module Generator</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type="text" 
                    placeholder="Enter academic topic or subject..." 
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-8 py-5 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-white placeholder:text-slate-800"
                    value={topicInput}
                    onChange={e => setTopicInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleQuickDraft()}
                  />
                  <button 
                    onClick={handleQuickDraft}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 whitespace-nowrap"
                  >
                    Draft Module
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'PREVIEW' && source && (
          <div className="space-y-10 animate-in">
            <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Content Overview</h3>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Grounding logic verified</p>
              </div>
              <button onClick={() => setStep('CONFIG')} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-black text-white uppercase text-[10px] tracking-widest shadow-2xl transition-all active:scale-95">Configure Session</button>
            </div>

            <div className="bg-slate-900 p-10 md:p-14 rounded-[3rem] border border-slate-800 shadow-inner min-h-[500px]">
              {source.type === 'pdf' ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 border border-white/5">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-xl text-white font-bold tracking-tight mb-2">{source.data.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest">Indexed Academic Entity</p>
                </div>
              ) : (
                <RenderedContent text={source.content} />
              )}
            </div>
          </div>
        )}

        {step === 'CONFIG' && (
          <div className="bg-slate-900 p-12 md:p-20 rounded-[4rem] border border-slate-800 shadow-2xl max-w-2xl mx-auto animate-in">
            <h3 className="text-4xl font-black text-white uppercase mb-12 text-center tracking-tighter">Session Blueprint</h3>
            
            <div className="space-y-16">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 text-center">Focus Module</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {safeTopics.map(t => (
                    <button 
                      key={t} 
                      onClick={() => setSelectedTopic(t)} 
                      className={`px-5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${selectedTopic === t ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Format</p>
                  <select value={quizType} onChange={e => setQuizType(e.target.value as QuizType)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold uppercase text-[10px] text-white outline-none cursor-pointer">
                    <option value="MCQ">MCQ</option>
                    <option value="Subjective">Subjective</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Volume</p>
                  <select value={count} onChange={e => setCount(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold uppercase text-[10px] text-white outline-none cursor-pointer">
                    {[5, 10, 15].map(v => <option key={v} value={v}>{v} Qs</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Rigour</p>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold uppercase text-[10px] text-white outline-none cursor-pointer">
                    <option value="Easy">Standard</option>
                    <option value="Medium">Advanced</option>
                    <option value="Hard">Expert</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleStartQuiz} 
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-[2rem] text-xl uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98]"
              >
                Initiate Practice
              </button>
            </div>
          </div>
        )}

        {step === 'QUIZ' && quiz && (
          <div className="space-y-12 pb-48 animate-in max-w-3xl mx-auto">
            <div className="sticky top-24 z-10 bg-slate-950/80 backdrop-blur-2xl border border-white/5 p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{selectedTopic}</p>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{quiz.quiz_title}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Progress</span>
                  <span className="text-xl font-black text-indigo-400">{Object.keys(userAnswers).length} / {quiz.questions.length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {(quiz?.questions || []).map((q, idx) => (
                <div key={q.id} className="bg-slate-900 p-10 md:p-12 rounded-[3rem] border border-slate-800 shadow-2xl transition-all hover:border-slate-700/50">
                  <div className="flex gap-6 mb-8 items-start">
                    <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-lg">{idx+1}</span>
                    <RenderedContent text={q.question} className="text-2xl font-bold leading-relaxed pt-1 text-white" />
                  </div>

                  {q.type === 'MCQ' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-16">
                      {q.options && Object.entries(q.options).map(([k, v]) => (
                        <button 
                          key={k} 
                          onClick={() => setUserAnswers(prev => ({...prev, [q.id]: k}))} 
                          className={`p-5 rounded-2xl border-2 text-left transition-all font-bold flex items-center gap-4 ${userAnswers[q.id] === k ? 'border-indigo-600 bg-indigo-600/10 shadow-lg' : 'border-transparent bg-slate-950 hover:bg-slate-800'}`}
                        >
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${userAnswers[q.id] === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{k}</span>
                          <span className={`flex-1 text-sm ${userAnswers[q.id] === k ? 'text-white' : 'text-slate-400'}`}>{v}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="pl-0 md:pl-16">
                      <textarea 
                        className="w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl min-h-[180px] text-white focus:ring-4 focus:ring-indigo-600/20 outline-none transition-all placeholder:text-slate-800 font-medium leading-relaxed" 
                        placeholder="Provide detailed articulation..." 
                        value={userAnswers[q.id] || ''} 
                        onChange={e => setUserAnswers(prev => ({...prev, [q.id]: e.target.value}))} 
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50">
              <button 
                onClick={handleFinish} 
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-[2.5rem] text-lg uppercase tracking-widest shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={Object.keys(userAnswers).length === 0}
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {step === 'REVIEW' && evaluation && (
          <div className="space-y-16 pb-40 animate-in max-w-3xl mx-auto">
            <div className="bg-slate-900 p-16 md:p-24 rounded-[4.5rem] text-center border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-500 opacity-50" />
              <p className="text-[120px] font-black text-indigo-500 leading-none mb-4 tracking-tighter drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]">{evaluation.percentage}%</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-10">Cognitive Audit</h2>
              
              <div className="grid grid-cols-3 gap-6 border-y border-slate-800 py-10 my-10">
                <div><p className="text-4xl font-black text-white">{evaluation.correct}</p><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">Verified</p></div>
                <div><p className="text-4xl font-black text-white">{evaluation.incorrect}</p><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-2">Lapses</p></div>
                <div><p className="text-4xl font-black text-indigo-400">{evaluation.score}/{evaluation.total_score}</p><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2">Aggregate</p></div>
              </div>

              <div className="mb-12 px-8">
                <RenderedContent text={evaluation.final_feedback} className="text-lg italic text-slate-400 text-center" />
              </div>

              <button onClick={() => setStep('UPLOAD')} className="bg-indigo-600 hover:bg-indigo-500 px-12 py-5 rounded-full text-white font-black uppercase tracking-widest text-base shadow-2xl transition-all active:scale-95">Restart Revision</button>
            </div>

            <div className="space-y-10">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter pl-8 border-l-4 border-indigo-500">Analysis Breakdown</h3>
              {(evaluation?.all_questions_review || []).map((item, idx) => (
                <div key={item.id} className={`bg-slate-900 rounded-[3.5rem] border shadow-2xl overflow-hidden transition-all ${item.is_correct ? 'border-emerald-900/20' : 'border-rose-900/20'}`}>
                  <div className={`p-10 border-b flex justify-between items-start ${item.is_correct ? 'bg-emerald-900/5 border-emerald-900/10' : 'bg-rose-900/5 border-rose-900/10'}`}>
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-4 mb-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.is_correct ? 'bg-emerald-600/20 text-emerald-500' : 'bg-rose-600/20 text-rose-500'}`}>
                          {item.is_correct ? 'Proficient' : 'Needs Review'}
                        </span>
                        <span className="text-slate-600 font-black text-[10px] uppercase tracking-widest">Question {idx+1}</span>
                      </div>
                      <h4 className="text-xl font-bold text-white leading-tight">{item.question}</h4>
                    </div>
                    <span className={`text-3xl font-black ${item.is_correct ? 'text-emerald-500' : 'text-rose-500'}`}>{item.score_attained}.0</span>
                  </div>

                  <div className="p-10 md:p-14 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800">
                        <p className="text-[10px] uppercase font-black text-slate-500 mb-3 tracking-widest">Student Response</p>
                        <p className={`text-sm font-bold leading-relaxed ${item.is_correct ? 'text-emerald-400' : 'text-rose-400'}`}>{item.your_answer || "Unanswered"}</p>
                      </div>
                      <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800">
                        <p className="text-[10px] uppercase font-black text-indigo-400 mb-3 tracking-widest">Model Reference</p>
                        <RenderedContent text={item.correct_answer} className="text-sm font-bold text-white leading-relaxed" />
                      </div>
                    </div>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-3xl">
                      <p className="text-[10px] uppercase font-black text-indigo-400 mb-3 tracking-widest">Tutor Insight</p>
                      <RenderedContent text={item.explanation} className="text-slate-400 text-base leading-relaxed font-medium" />
                    </div>

                    <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 relative group">
                      <p className="text-[10px] uppercase font-black text-rose-500/60 mb-4 tracking-[0.4em]">Evidence Chain</p>
                      <p className="italic font-serif text-lg text-slate-400 opacity-90 leading-relaxed">"{item.evidence}"</p>
                      <p className="text-right text-[10px] font-black text-slate-700 mt-8 uppercase tracking-widest">{item.source}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'HISTORY_VIEW' && (
          <div className="animate-in max-w-2xl mx-auto py-12">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Learning History</h2>
              <button onClick={() => setStep('UPLOAD')} className="text-[10px] font-black uppercase text-indigo-400 hover:text-white transition-colors">Back to Main</button>
            </div>
            <div className="grid gap-4">
              {safeHistory.length > 0 ? safeHistory.map(e => (
                <div key={e.id} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 flex justify-between items-center hover:border-indigo-500/30 transition-all cursor-pointer group" onClick={() => { setQuiz(e.quiz); setEvaluation(e.results); setStep('REVIEW'); }}>
                  <div className="text-left">
                    <p className="text-lg font-bold text-slate-200 group-hover:text-indigo-400 mb-1">{e.title}</p>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{new Date(e.timestamp).toLocaleDateString()} at {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-black text-indigo-500">{e.percentage}%</span>
                    <span className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Proficiency</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-slate-600 italic font-medium border-2 border-dashed border-slate-800 rounded-3xl">No historical records found. Complete a quiz to see your progress.</div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.8em] mt-auto border-t border-slate-900">ExamEcho V9.0 — Cognitive Precision Engine</footer>
    </div>
  );
};

export default App;