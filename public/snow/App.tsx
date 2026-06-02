
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, RefreshCw, Snowflake, Send, Info, Binary, Sparkles, Loader2, Lock, Unlock, Copy, Check, Zap } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { stringToSeed, createPRNG, stringToDisplayHash, signatureToSeed, encodeMessage, decodeMessage } from './services/hashService';
import { SnowflakeParams } from './types';
import SnowflakeCanvas, { SnowflakeCanvasHandle } from './components/SnowflakeCanvas';

type InputMode = 'compose' | 'decipher' | 'signature';

const NEW_YEAR_WISHES = [
  'Счастья в новом году',
  'Пусть сбываются мечты',
  'Здоровья и тепла',
  'Вдохновения и удачи',
  'Зимнего волшебства',
  'Мира и любви',
  'Светлых моментов',
  'Уютных вечеров',
  'Новых горизонтов',
  'Радости и смеха'
];

const App: React.FC = () => {
  const getRandomWish = () => NEW_YEAR_WISHES[Math.floor(Math.random() * NEW_YEAR_WISHES.length)];
  
  const [inputMode, setInputMode] = useState<InputMode>('compose');
  // Устанавливаем случайное новогоднее пожелание при загрузке
  const initialWish = useMemo(() => getRandomWish(), []);
  const [inputValue, setInputValue] = useState(initialWish);
  const [activePhrase, setActivePhrase] = useState(initialWish);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  const canvasRef = useRef<SnowflakeCanvasHandle>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const decodedResult = useMemo(() => {
    if (inputMode === 'decipher') return decodeMessage(activePhrase);
    return null;
  }, [activePhrase, inputMode]);

  const currentSeed = useMemo(() => {
    if (inputMode === 'compose') return stringToSeed(activePhrase || 'default');
    if (inputMode === 'decipher') return stringToSeed(decodedResult || 'default');
    return signatureToSeed(activePhrase);
  }, [activePhrase, inputMode, decodedResult]);

  const messageCode = useMemo(() => {
    if (inputMode === 'compose') return encodeMessage(activePhrase);
    return null;
  }, [activePhrase, inputMode]);

  const displayHash = useMemo(() => {
    const textToHash = inputMode === 'decipher' ? (decodedResult || '') : activePhrase;
    if (inputMode === 'signature') return activePhrase.startsWith('0x') ? activePhrase.toUpperCase() : `0x${activePhrase.toUpperCase()}`;
    return stringToDisplayHash(textToHash);
  }, [activePhrase, inputMode, decodedResult]);

  const snowflakeParams = useMemo<SnowflakeParams>(() => {
    const rng = createPRNG(currentSeed);
    const colorRoll = rng.next();
    let color = 'rgba(255, 255, 255, 0.95)';
    if (colorRoll > 0.85) color = 'rgba(239, 68, 68, 1)'; 
    else if (colorRoll > 0.7) color = 'rgba(255, 255, 255, 0.6)';

    return {
      branchCount: 6,
      branchLength: 130 + rng.next() * 90,
      subBranchAngle: 20 + rng.next() * 40,
      subBranchLength: 40 + rng.next() * 60,
      subBranchDensity: Math.floor(5 + rng.next() * 7),
      lineWidth: 0.3 + rng.next() * 1.2,
      glowSize: 4 + rng.next() * 12,
      color: color
    };
  }, [currentSeed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePhrase(inputValue);
    setAnalysis(null);
  };

  const handleDownload = () => {
    const name = inputMode === 'decipher' ? decodedResult : activePhrase;
    const sanitized = (name || 'wish').replace(/[^a-zа-я0-9]/gi, '_').toLowerCase().slice(0, 20);
    canvasRef.current?.download(`libo_libo_cyber_${sanitized}`);
  };

  const copyToClipboard = () => {
    if (messageCode) {
      navigator.clipboard.writeText(messageCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRandomize = () => {
    const newPhrase = getRandomWish();
    setInputValue(newPhrase);
    setActivePhrase(newPhrase);
    setInputMode('compose');
    setAnalysis(null);
  };

  const decodeEssence = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const subject = inputMode === 'decipher' ? decodedResult : activePhrase;
      const prompt = `Проанализируй геометрию этой гипер-детализированной снежинки, созданной из пожелания "${subject}". 
      Хеш: ${displayHash}. Плотность квантовых узлов: ${snowflakeParams.subBranchDensity}.
      Дай футуристическое и поэтичное описание того, какую энергию или судьбу несет это пожелание в новом году. 
      Стиль: киберпанк-мистицизм, лаконично, до 35 слов. На русском языке.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAnalysis(response.text || "Энергия пожелания стабилизирована.");
    } catch (error) {
      setAnalysis("Ошибка дешифровки ментального слоя.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const snowflakeSize = useMemo(() => {
    if (windowWidth < 768) {
      return Math.min(windowWidth - 48, 400);
    }
    return 640;
  }, [windowWidth]);

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center p-4 md:p-8 bg-black selection:bg-red-600/30">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      <header className="mb-12 text-center max-w-2xl relative z-10">
        <h1 className="text-5xl md:text-8xl font-serif mb-4 tracking-tighter text-white">
          либо-либо. <span className="text-red-600 italic">снежность</span>
        </h1>
        <p className="text-zinc-500 text-sm font-light tracking-[0.2em] uppercase">
          отправь снежинку со смыслом
        </p>
      </header>

      <main className="w-full max-w-7xl flex flex-col-reverse lg:flex-row items-center lg:items-center gap-12 lg:gap-16 relative z-10">
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          <section className="bg-zinc-900/60 backdrop-blur-3xl border border-zinc-800 rounded-[2.5rem] p-6 md:p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <div className="flex bg-black/60 p-1.5 rounded-2xl mb-10 border border-zinc-800">
              <button onClick={() => setInputMode('compose')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.25em] transition-all ${inputMode === 'compose' ? 'bg-white text-black shadow-xl shadow-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Отправить
              </button>
              <button onClick={() => setInputMode('decipher')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.25em] transition-all ${inputMode === 'decipher' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Получить
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-bold tracking-[0.3em] text-zinc-600 uppercase">
                  Ваше пожелание
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  <span className="text-[10px] font-mono text-zinc-500">{displayHash}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={inputMode === 'compose' ? "Текст пожелания..." : "Код доступа..."}
                  className="flex-1 bg-black/40 border-b-2 border-zinc-800 focus:border-red-600 px-2 py-4 focus:outline-none transition-all text-2xl font-light placeholder:text-zinc-800"
                />
                <button type="submit" className="bg-red-600 hover:bg-red-500 text-white rounded-full w-16 h-16 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-red-600/20">
                  <Send size={24} />
                </button>
              </div>
            </form>

            {inputMode === 'compose' && messageCode && (
              <div className="mt-10 p-8 bg-zinc-950/50 border border-zinc-800 rounded-[2rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Binary size={40} />
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Бинарный слепок</span>
                  <button onClick={copyToClipboard} className="text-red-500 hover:text-red-400 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Успешно' : 'Копировать'}
                  </button>
                </div>
                <div className="font-mono text-[10px] break-all text-zinc-500 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                  {messageCode}
                </div>
              </div>
            )}

            {inputMode === 'decipher' && (
              <div className="mt-10 p-8 bg-red-600/5 border border-red-600/20 rounded-[2rem] animate-in slide-in-from-top-4 duration-700">
                <span className="text-[9px] font-bold text-red-600 uppercase tracking-[0.4em] block mb-4">Декодирование завершено</span>
                <div className="text-3xl font-serif text-white italic leading-tight">
                  {decodedResult ? `«${decodedResult}»` : <span className="text-zinc-800">Сигнал не найден</span>}
                </div>
              </div>
            )}

            <div className="mt-12 flex flex-wrap gap-4">
              <button onClick={handleRandomize} className="flex-1 flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl py-5 transition-all text-[10px] font-bold uppercase tracking-widest">
                <RefreshCw size={16} /> Другое
              </button>
              <button onClick={decodeEssence} disabled={isAnalyzing} className="flex-1 flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 text-black rounded-2xl py-5 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 shadow-xl shadow-white/5">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Анализ
              </button>
              <button onClick={handleDownload} className="flex items-center justify-center bg-black border border-zinc-800 hover:border-zinc-600 text-white rounded-2xl px-8 py-5 transition-all">
                <Download size={18} />
              </button>
            </div>
          </section>

          {analysis && (
            <section className="bg-zinc-900/20 border-l-4 border-red-600 p-10 rounded-r-3xl shadow-2xl animate-in fade-in duration-1000">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-[1px] flex-1 bg-zinc-800" />
                <h3 className="text-zinc-600 text-[9px] font-bold uppercase tracking-[0.5em]">Quantum Readout</h3>
                <div className="h-[1px] flex-1 bg-zinc-800" />
              </div>
              <p className="text-zinc-300 italic font-serif text-2xl leading-relaxed text-center">«{analysis}»</p>
            </section>
          )}
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center py-6 lg:py-0">
          <SnowflakeCanvas ref={canvasRef} params={snowflakeParams} size={snowflakeSize} />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center scale-75 md:scale-100">
            <div className="w-[80%] h-[80%] border border-zinc-900 rounded-full animate-[spin_60s_linear_infinite]" />
            <div className="w-[95%] h-[95%] border border-red-600/5 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
          </div>
        </div>
      </main>

      <footer className="mt-24 mb-10 text-zinc-800 text-[10px] uppercase tracking-[0.6em] flex items-center gap-8 relative z-10">
        <span className="hover:text-zinc-600 transition-colors cursor-default">libo.libo</span>
        <div className="w-2 h-2 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
        <span className="hover:text-zinc-600 transition-colors cursor-default">snowcrypt.v3</span>
      </footer>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
