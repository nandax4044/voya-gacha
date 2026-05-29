/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Prize, SpinSettings, SpinHistory } from './types';
import { DEFAULT_PRIZES } from './utils/defaults';
import { PrizeWheel } from './components/PrizeWheel';
import { PrizeManager } from './components/PrizeManager';
import { Confetti } from './components/Confetti';
import { SoundEffects } from './components/SoundEffects';
import CrashGame from './components/CrashGame';
import CaseOpeningGame from './components/CaseOpeningGame';
import keysData from './keys.json';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  Settings,
  History,
  Maximize2,
  Minimize2,
  Clock,
  Gauge,
  CheckCircle,
  HelpCircle,
  Gift,
  X,
  TrendingUp
} from 'lucide-react';

export const PngEmoji = ({ src, alt, className = "w-4 h-4 inline-block object-contain" }: { src: string; alt: string; className?: string }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <span className="inline-block font-sans">{alt}</span>;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${className} align-middle inline-block`}
      onError={() => setHasError(true)} 
    />
  );
};

export default function App() {
  // --- Game Authorization Gate states ---
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('authorized_key_passed') === 'true';
  });
  const [keyValue, setKeyValue] = useState<string>('');
  const [keyError, setKeyError] = useState<boolean>(false);

  // --- Game Selection State ---
  const [activeGame, setActiveGame] = useState<'wheel' | 'crash' | 'cases'>('cases');

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyValue.trim();
    if (keysData.validKeys.includes(trimmed)) {
      setIsAuthorized(true);
      sessionStorage.setItem('authorized_key_passed', 'true');
      setKeyError(false);
    } else {
      setKeyError(true);
      setTimeout(() => setKeyError(false), 900);
    }
  };

  // --- 1. State Initialization ---
  const [showSettings, setShowSettings] = useState(false);

  const [prizes, setPrizes] = useState<Prize[]>(() => {
    const saved = localStorage.getItem('wheel_spinner_prizes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Storage corrupt, using defaults');
      }
    }
    return DEFAULT_PRIZES;
  });

  const [settings, setSettings] = useState<SpinSettings>(() => {
    const saved = localStorage.getItem('wheel_spinner_settings');
    if (saved) {
      try {
        return { ...JSON.parse(saved) };
      } catch (e) {}
    }
    return {
      speed: 'normal',
      duration: 6,
      autoRemove: false,
      soundEnabled: true,
    };
  });

  const [history, setHistory] = useState<SpinHistory[]>(() => {
    const saved = localStorage.getItem('wheel_spinner_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // Flow control states
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Prize | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [autoRemoveWn, setAutoRemoveWn] = useState(false); // Modal-specific auto-remove state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard shortcut listener for toggling settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire if typing inside inputs, textareas, or design editors
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || activeEl.hasAttribute('contenteditable')) {
          return;
        }
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync sound setting on load
  useEffect(() => {
    SoundEffects.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Persist arrays to local storage on mutation
  useEffect(() => {
    localStorage.setItem('wheel_spinner_prizes', JSON.stringify(prizes));
  }, [prizes]);

  useEffect(() => {
    localStorage.setItem('wheel_spinner_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('wheel_spinner_history', JSON.stringify(history));
  }, [history]);

  // --- 2. Action Handlers ---
  const handleAddPrize = (newPrize: Omit<Prize, 'id'>) => {
    const fresh: Prize = {
      ...newPrize,
      id: crypto.randomUUID()
    };
    setPrizes((prev) => [...prev, fresh]);
  };

  const handleUpdatePrize = (id: string, updated: Partial<Prize>) => {
    setPrizes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
    );
  };

  const handleDeletePrize = (id: string) => {
    setPrizes((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReorderPrizes = (newPrizes: Prize[]) => {
    setPrizes(newPrizes);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Muat ulang hadiah bawaan pabrik? Data hadiah Anda saat ini akan ditimpa.')) {
      setPrizes(DEFAULT_PRIZES);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua hadiah pada roda?')) {
      setPrizes([]);
    }
  };

  const handleSpinStart = () => {
    setIsSpinning(true);
    setWinner(null);
    setShowWinnerModal(false);
  };

  const handleSpinComplete = (winningPrize: Prize) => {
    setIsSpinning(false);
    setWinner(winningPrize);
    setAutoRemoveWn(settings.autoRemove); // Sync default auto-remove preference
    setShowWinnerModal(true);

    // Append to Local History Logs
    const logItem: SpinHistory = {
      id: crypto.randomUUID(),
      prizeId: winningPrize.id,
      prizeName: winningPrize.name,
      prizeImage: winningPrize.image,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    setHistory((prev) => [logItem, ...prev].slice(0, 10)); // Keep last 10
  };

  // Close winning popup & optionally remove winning slice
  const handleCloseWinnerModal = () => {
    setShowWinnerModal(false);
    if (winner && autoRemoveWn) {
      setPrizes((prev) => prev.filter((p) => p.id !== winner.id));
    }
    setWinner(null);
  };

  const toggleSound = () => {
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const toggleFullscreen = () => {
    const appEl = document.getElementById('outer-shell');
    if (!appEl) return;

    if (!document.fullscreenElement) {
      appEl.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        // Fallback immersive element state toggler
        setIsFullscreen(!isFullscreen);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Fullscreen container check
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const clearHistoryLog = () => {
    if (window.confirm('Kosongkan riwayat spin terakhir?')) {
      setHistory([]);
    }
  };

  // Convert speed values back to legible percentage strings
  const getSpeedLabel = (sp: SpinSettings['speed']) => {
    switch (sp) {
      case 'slow': return 'Lambat';
      case 'normal': return 'Normal';
      case 'fast': return 'Cepat';
      case 'turbo': return 'Turbo ⚡';
    }
  };

  if (!isAuthorized) {
    return (
      <div 
        className="min-h-screen text-slate-100 flex items-center justify-center font-sans p-6 select-none relative overflow-hidden"
        style={{
          background: "linear-gradient(rgba(31, 22, 150, 0.45), rgba(7, 6, 20, 0.7)), url('/background.png') center / cover no-repeat fixed"
        }}
      >
        {/* Ambient background glow orb */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-purple-600/5 blur-[80px] pointer-events-none" />
        
        <form onSubmit={handleKeySubmit} className="flex flex-col items-center gap-5 z-10 bg-[#141224]/80 border border-white/10 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
          <label className="text-sm font-semibold text-slate-400 tracking-wider font-mono">
            MASUKKAN KEY
          </label>
          <input
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            className={`w-64 bg-black/40 border ${
              keyError ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-shake' : 'border-white/10 focus:border-purple-500/50 focus:shadow-[0_0_15px_rgba(124,92,252,0.15)]'
            } rounded-xl py-3 px-4 font-mono text-center text-sm transition-all text-purple-300 placeholder-slate-700 outline-none`}
            placeholder="••••••••"
            autoFocus
          />
        </form>
      </div>
    );
  }

  return (
    <div
      id="outer-shell"
      style={{ 
        fontFamily: "Nunito, sans-serif",
        background: isFullscreen 
          ? "linear-gradient(rgba(10, 10, 16, 0.45), rgba(10, 10, 16, 0.7)), url('/background.png') center / cover no-repeat fixed"
          : "linear-gradient(rgba(15, 15, 26, 0.35), rgba(15, 15, 26, 0.6)), url('/background.png') center / cover no-repeat fixed"
      }}
      className={`min-h-screen text-slate-100 selection:bg-purple-600 selection:text-white flex flex-col relative overflow-x-hidden ${
        isFullscreen ? 'p-6 justify-center' : ''
      }`}
    >
      {/* Dynamic Background visual blur orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-purple-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-red-900/10 blur-[150px] pointer-events-none" />

      {/* Confetti Explosion Layer overlaying viewport */}
      <Confetti active={showWinnerModal} />

      {/* WINNER MODAL DRAWER POPUP */}
      {showWinnerModal && winner && (
        <div
          id="winner-overlay-modal"
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[90] animate-fade-in"
        >
          <div
            id="winner-modal-body"
            className="bg-[#18162e] border border-yellow-400/30 w-full max-w-md p-6 rounded-2xl flex flex-col items-center text-center shadow-[0_0_30px_rgba(234,179,8,0.25)] relative overflow-hidden transition-all duration-300 transform scale-100"
          >
            {/* Blinking gold light border strip */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-500 via-yellow-400 to-indigo-600 animate-pulse" />
            
            {/* Crown Icon */}
            <div className="w-14 h-14 bg-yellow-500/10 rounded-full border border-yellow-400/30 flex items-center justify-center mb-3 animate-bounce">
              <Sparkles className="w-7 h-7 text-yellow-400" />
            </div>

            <h3 className="font-display font-black text-2xl text-yellow-400 mb-1 flex items-center justify-center gap-1.5">
              SELAMAT! <PngEmoji src="/images/emoji_trophy.png" alt="" className="w-6 h-6" />
            </h3>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-sans mb-5">
              Anda memenangkan hadiah berikut:
            </p>

            {/* Winning Image Thumbnail */}
            <div className="relative w-40 h-40 bg-black/60 rounded-2xl p-2 border-2 border-yellow-400/40 shadow-inner flex items-center justify-center overflow-hidden mb-4 group">
              <img
                src={winner.image}
                alt={winner.name}
                className="object-contain w-full h-full transform group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Winning Title Text label */}
            <h4 className="font-display text-xl font-bold text-white mb-4 bg-white/5 py-2 px-6 rounded-lg border border-white/5 shadow-inner">
              {winner.name}
            </h4>

            {/* Dynamic Single-Spin Elimination Toggle Feature */}
            <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/20 rounded-xl p-3 w-full mb-6">
              <input
                id="modal-auto-remove"
                type="checkbox"
                checked={autoRemoveWn}
                onChange={(e) => setAutoRemoveWn(e.target.checked)}
                className="w-4.5 h-4.5 text-purple-600 rounded bg-[#0F0F1A] border-white/10 focus:ring-purple-500 cursor-pointer"
              />
              <div className="text-left">
                <label
                  htmlFor="modal-auto-remove"
                  className="text-xs font-semibold text-slate-200 cursor-pointer select-none font-sans"
                >
                  Hapus hadiah ini dari roda
                </label>
                <p className="text-[10px] text-slate-400 font-sans">
                  Hadiah ini tidak akan keluar lagi di spin berikutnya.
                </p>
              </div>
            </div>

            {/* CTA action button */}
            <button
              onClick={handleCloseWinnerModal}
              className="w-full font-display font-bold py-3 px-6 rounded-xl cursor-pointer bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-[#0F0F1A] shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-1.5"
            >
              Putar Lagi <PngEmoji src="/images/emoji_spin.png" alt="" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER BRAND BAR */}
      {!isFullscreen && (
        <header className="border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center bg-[#0C0C14]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl border border-purple-500/30 flex items-center justify-center">
              <Gift className="w-5.5 h-5.5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg md:text-xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300">
                 Reya Gacha
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                
              </p>
            </div>
          </div>

          {/* Game Selector Tab Navigation */}
          <div className="flex bg-[#0f0e1d] p-1.5 border border-white/5 rounded-2xl select-none mx-2 shrink-0 z-50 overflow-x-auto max-w-full">
            <button
              onClick={() => {
                setActiveGame('cases');
                setShowSettings(false);
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 md:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeGame === 'cases'
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-900/40'
                  : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Gacha Chest</span>
            </button>
            <button
              onClick={() => {
                setActiveGame('wheel');
                setShowSettings(false);
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 md:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeGame === 'wheel'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Gacha Wheel</span>
            </button>
            <button
              onClick={() => {
                setActiveGame('crash');
                setShowSettings(false);
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 md:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeGame === 'crash'
                  ? 'bg-[#7c5cfc] text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-[#7c5cfc]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Crash Game</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick sound toggle layout */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                settings.soundEnabled
                  ? 'bg-purple-950/30 border-purple-500/20 text-purple-400 hover:bg-purple-900/40'
                  : 'bg-slate-900/30 border-white/5 text-slate-500 hover:bg-slate-800/40'
              }`}
              title={settings.soundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
            >
              {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Immersive widget toggle button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl border bg-slate-900/30 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all cursor-pointer"
              title="Mode Fokus / Layar Penuh"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* MAIN LAYOUT BODY */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {activeGame === 'crash' ? (
          <div className="col-span-12 w-full animate-fade-in">
            <CrashGame />
          </div>
        ) : activeGame === 'cases' ? (
          <div className="col-span-12 w-full animate-fade-in">
            <CaseOpeningGame />
          </div>
        ) : (
          <>
            {/* LEFT COLUMN: THE CENTRAL WHEEL VIEWPORT & SPIN TRIGGER PANEL */}
            <section className={`${
              showSettings 
                ? 'lg:col-span-7 xl:col-span-6' 
                : 'col-span-12 lg:col-span-8 lg:col-start-2 xl:col-span-6 xl:col-start-3 mx-auto w-full max-w-xl'
            } flex flex-col items-center justify-center gap-6 bg-[#0C0C14]/40 p-4 md:p-8 rounded-2xl border border-white/5 shadow-2.5xl transition-all duration-300`}>
              
              {isFullscreen && (
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Gift className="w-6 h-6 text-yellow-400" />
                    <h2 className="font-display font-medium text-lg text-white">Prize Spinner Active</h2>
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-slate-900/80 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Minimize2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              )}

              {/* Canvas WebGL/Draw engine widget container */}
              <PrizeWheel
                prizes={prizes}
                isSpinning={isSpinning}
                speed={settings.speed}
                duration={settings.duration}
                onSpinStart={handleSpinStart}
                onSpinComplete={handleSpinComplete}
              />

              {/* Trigger button array row */}
              <div className="w-full max-w-sm flex flex-col gap-3">
                
                {prizes.length < 2 ? (
                  <div className="text-center py-2 px-4 bg-red-950/30 rounded-xl border border-red-500/20 text-xs text-red-300 font-sans flex items-center justify-center gap-1.5">
                    <PngEmoji src="/images/emoji_warning.png" alt="⚠️" className="w-3.5 h-3.5" /> Harap tambahkan minimal 2 hadiah untuk memutar roda!
                  </div>
                ) : null}

                {/* Large glowing main SPIN trigger button */}
                <button
                  onClick={() => setIsSpinning(true)}
                  disabled={isSpinning || prizes.length < 2}
                  className={`w-full font-display font-black text-lg py-4 md:py-5 px-8 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 select-none ${
                    isSpinning
                      ? 'bg-[#151326] border border-white/5 text-slate-500 cursor-not-allowed shadow-none'
                      : prizes.length < 2
                      ? 'bg-purple-950/10 border border-white/5 text-purple-400/40 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 hover:from-yellow-300 hover:via-amber-300 hover:to-orange-400 text-[#0F0F1A] font-extrabold shadow-[0_10px_35px_rgba(245,158,11,0.35)] hover:shadow-[0_12px_45px_rgba(245,158,11,0.5)] active:scale-95 duration-200 animate-pulse-light'
                  }`}
                >
                  <Play className={`w-5 h-5 fill-current ${isSpinning ? 'opacity-30' : ''}`} />
                  {isSpinning ? 'SEDANG MEMUTAR...' : 'PUTAR RODA!'}
                </button>

                {/* Quick action buttons beneath the wheel spinner */}
                <div className="flex gap-2 w-full justify-between mt-1 text-slate-400 text-xs font-sans">
                  <span className="flex items-center gap-1 bg-slate-900/40 border border-white/5 py-1.5 px-3 rounded-lg">
                    <Gauge className="w-3.5 h-3.5 text-purple-400" />
                    <span>Mata: <strong className="text-white">{getSpeedLabel(settings.speed)}</strong></span>
                  </span>
                  <span className="flex items-center gap-1 bg-slate-900/40 border border-white/5 py-1.5 px-3 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Durasi: <strong className="text-white">{settings.duration}s</strong></span>
                  </span>
                </div>
              </div>
            </section>

            {/* RIGHT COLUMN: PRIZE LIST & SETTINGS EDITOR PANELS (Hidden by default / Toggled via 'F') */}
            {showSettings && (
              <section className="lg:col-span-5 xl:col-span-6 flex flex-col gap-8 animate-fade-in">
                
                {/* 1. General Controls Settings Panel */}
                <div className="bg-[#100E1C] p-6 rounded-2xl border border-white/5 flex flex-col gap-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
                      <Settings className="w-4.5 h-4.5 text-purple-400" />
                      <PngEmoji src="/images/emoji_settings.png" alt="🎛️" className="w-4 h-4" /> Pengaturan Spin & Roda
                    </h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition"
                      title="Sembunyikan Pengaturan"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Speed slider block */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-300 font-sans">Kecepatan Putaran</label>
                      <span className="text-xs text-purple-400 font-mono font-bold">
                        {getSpeedLabel(settings.speed)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 bg-[#0F0F1A] p-1 border border-white/5 rounded-lg select-none">
                      {(['slow', 'normal', 'fast', 'turbo'] as const).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, speed: sp }))}
                          className={`cursor-pointer capitalize py-1.5 px-2 rounded-md text-xs font-semibold font-sans transition-all duration-150 ${
                            settings.speed === sp
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                          }`}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration slider */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-300 font-sans">Durasi Berputar (Detik)</label>
                      <span className="text-xs text-sky-400 font-mono font-bold">
                        {settings.duration} Detik
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="3"
                        max="10"
                        step="1"
                        value={settings.duration}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            duration: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-purple-500 h-2 bg-[#0F0F1A] rounded-lg cursor-pointer border border-white/5"
                      />
                    </div>
                  </div>

                  {/* Switch option for default auto-delete */}
                  <div className="flex items-center justify-between gap-3 bg-[#0F0F1A] p-3 border border-white/5 rounded-xl">
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor="auto-remove-switch"
                        className="text-xs font-semibold text-slate-200 cursor-pointer select-none font-sans"
                      >
                        Mode Eliminasi Otomatis
                      </label>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Keluarkan pemenang dari roda secara instan sesudah spin.
                      </span>
                    </div>
                    <input
                      id="auto-remove-switch"
                      type="checkbox"
                      checked={settings.autoRemove}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, autoRemove: e.target.checked }))
                      }
                      className="w-4.5 h-4.5 text-purple-600 rounded bg-[#100E1C] border-white/10 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 2. Prize List Manager Panel section */}
                <div className="bg-[#100E1C] p-6 rounded-2xl border border-white/5 shadow-xl">
                  <PrizeManager
                    prizes={prizes}
                    onAddPrize={handleAddPrize}
                    onUpdatePrize={handleUpdatePrize}
                    onDeletePrize={handleDeletePrize}
                    onReorderPrizes={handleReorderPrizes}
                    onResetToDefault={handleResetToDefault}
                    onClearAll={handleClearAll}
                  />
                </div>

                {/* 3. History Spinner Logs widget */}
                <div className="bg-[#100E1C] p-6 rounded-2xl border border-white/5 flex flex-col gap-4 shadow-xl mb-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-display text-sm font-bold text-slate-200 flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-400" />
                      <PngEmoji src="/images/emoji_history.png" alt="📋" className="w-4 h-4" /> Riwayat Putaran Terakhir
                    </h3>
                    {history.length > 0 && (
                      <button
                        onClick={clearHistoryLog}
                        className="text-[10px] text-slate-400 hover:text-red-400 transition-colors font-sans cursor-pointer"
                      >
                        Clear Log
                      </button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-4 font-sans">
                      Belum ada putaran dilakukan. Klik SPIN untuk memulai!
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                      {history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between bg-[#0F0F1A] border border-white/5 px-3 py-2 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-6 h-6 bg-black rounded p-0.5 flex-shrink-0 flex items-center justify-center">
                              <img
                                src={h.prizeImage}
                                alt={h.prizeName}
                                className="object-contain w-full h-full"
                              />
                            </div>
                            <span className="text-slate-200 truncate max-w-[170px] font-sans font-medium">
                              {h.prizeName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono ml-2">
                            {h.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </section>
            )}
          </>
        )}
      </main>



      {/* FOOTER */}
      {!isFullscreen && (
        <footer className="border-t border-white/5 py-4 text-center text-[10px] text-slate-500 font-mono mt-auto relative z-10">
          Prize Wheel Spinner &copy; 2026 &bull; Private Premium Client Build
        </footer>
      )}
    </div>
  );
}
