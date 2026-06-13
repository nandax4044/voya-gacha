import React, { useState, useEffect, useRef, useMemo } from 'react';
import chestsData from '../data/case_opening.json';
import { Confetti } from './Confetti';
import { SoundEffects } from './SoundEffects';
import {
  Gift, ChevronLeft, Play, RotateCcw, Volume2, VolumeX,
  X, Info, Sparkles, Zap, Crown, Star
} from 'lucide-react';

interface CaseItem {
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  chance: number;
  value: number;
  icon: string;
  color: string;
  image: string;
}

interface Chest {
  id: string;
  name: string;
  price: number;
  icon: string;
  color: string;
  background: string;
  image: string;
  items: CaseItem[];
}

const RARITY = {
  Common:    { text: "Common",    bg: "bg-slate-500/15", border: "border-slate-500/40",   textCol: "text-slate-400",   color: "#a1a1aa", glow: "rgba(161,161,170,0.25)" },
  Rare:      { text: "Rare",      bg: "bg-blue-500/15",  border: "border-blue-500/40",    textCol: "text-blue-400",    color: "#3b82f6", glow: "rgba(59,130,246,0.3)" },
  Epic:      { text: "Epic",      bg: "bg-purple-500/15", border: "border-purple-500/40",  textCol: "text-purple-400",  color: "#a855f7", glow: "rgba(168,85,247,0.35)" },
  Legendary: { text: "Legendary", bg: "bg-yellow-500/15", border: "border-yellow-500/40",  textCol: "text-yellow-400",  color: "#eab308", glow: "rgba(234,179,8,0.4)" },
  Mythic:    { text: "Mythic",    bg: "bg-red-500/15",   border: "border-red-500/40",     textCol: "text-red-400",     color: "#ef4444", glow: "rgba(239,68,68,0.45)" }
};

const ItemImage = ({ item, className = "w-16 h-16 object-contain" }: { item: CaseItem; className?: string }) => {
  const [hasError, setHasError] = useState(false);
  if (!item.image || hasError) {
    return <span className="text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] select-none">{item.icon}</span>;
  }
  return (
    <img src={item.image} alt={item.name} className={`${className} select-none transition-transform duration-300`}
      referrerPolicy="no-referrer" onError={() => setHasError(true)} />
  );
};

export default function CaseOpeningGame() {
  const chests: Chest[] = (chestsData.chests || chestsData) as Chest[];
  const gs = (chestsData as any).gameSettings || {
    defaultSpinDurationMs: 5500, fastSpinDurationMs: 1500,
    spinEasing: "cubic-bezier(0.04, 0.84, 0.12, 1)"
  };

  const [selectedChestId, setSelectedChestId] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isChestShaking, setIsChestShaking] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [spinTranslation, setSpinTranslation] = useState(0);
  const [winningItemResult, setWinningItemResult] = useState<CaseItem | null>(null);
  const [showPrizeOverlay, setShowPrizeOverlay] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [autoSpinMode, setAutoSpinMode] = useState<'off' | 'x3' | 'x10' | 'infinite'>('off');
  const [autoSpinsRemaining, setAutoSpinsRemaining] = useState(0);
  const [fastSkip, setFastSkip] = useState(false);

  const reelContainerRef = useRef<HTMLDivElement>(null);
  const reelItemsRef = useRef<HTMLDivElement>(null);
  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoLoopTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { SoundEffects.setEnabled(!isMuted); }, [isMuted]);
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    };
  }, []);

  // Realtime tick sound synchronizer
  useEffect(() => {
    if (!isSpinning) return;
    let animId: number;
    const itemCardWidth = 152;
    let lastTickIndex = -1;
    const trackTicks = () => {
      if (!reelItemsRef.current || !reelContainerRef.current) { animId = requestAnimationFrame(trackTicks); return; }
      const rect = reelItemsRef.current.getBoundingClientRect();
      const containerRect = reelContainerRef.current.getBoundingClientRect();
      const centerLine = containerRect.left + (containerRect.width / 2);
      const offset = centerLine - rect.left;
      const curTickIdx = Math.floor(offset / itemCardWidth);
      if (curTickIdx !== lastTickIndex && curTickIdx >= 0 && curTickIdx < 65) {
        lastTickIndex = curTickIdx;
        SoundEffects.playTick();
      }
      animId = requestAnimationFrame(trackTicks);
    };
    animId = requestAnimationFrame(trackTicks);
    return () => cancelAnimationFrame(animId);
  }, [isSpinning]);

  const computeWeightedDrop = (items: CaseItem[]): CaseItem => {
    const total = items.reduce((a, i) => a + i.chance, 0);
    let r = Math.random() * total;
    for (const item of items) { if (r < item.chance) return item; r -= item.chance; }
    return items[0];
  };

  const activeChest = chests.find(c => c.id === selectedChestId) || null;

  const startCaseUnboxing = () => {
    if (isSpinning || isChestShaking || !activeChest) return;
    setSpinTranslation(0); setIsSpinning(false); setShowPrizeOverlay(false); setWinningItemResult(null);

    const runReelSpin = () => {
      const winningItem = computeWeightedDrop(activeChest.items);
      const totalTapeSize = 65, targetIdx = 52;
      const newTape: CaseItem[] = [];
      for (let i = 0; i < totalTapeSize; i++) {
        newTape.push(i === targetIdx ? winningItem : computeWeightedDrop(activeChest.items));
      }
      setReelItems(newTape); setWinningItemResult(winningItem); setIsSpinning(true);

      const itemCardWidth = 152;
      const containerWidth = reelContainerRef.current ? reelContainerRef.current.clientWidth : 800;
      const randomVisualOffset = Math.floor(Math.random() * 60) - 30;
      const targetTranslation = -(targetIdx * itemCardWidth) + (containerWidth / 2 - itemCardWidth / 2) + randomVisualOffset;
      setSpinTranslation(targetTranslation);

      const duration = fastSkip ? gs.fastSpinDurationMs : gs.defaultSpinDurationMs;
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        setIsSpinning(false); setShowPrizeOverlay(true); SoundEffects.playFanfare();
        if (winningItem.rarity === 'Legendary' || winningItem.rarity === 'Mythic') {
          setConfettiActive(true); setTimeout(() => setConfettiActive(false), 3000);
        }
        if (autoSpinMode !== 'off') {
          if (autoSpinMode === 'x3' && autoSpinsRemaining > 1) {
            setAutoSpinsRemaining(r => r - 1);
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2400);
          } else if (autoSpinMode === 'x10' && autoSpinsRemaining > 1) {
            setAutoSpinsRemaining(r => r - 1);
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2400);
          } else if (autoSpinMode === 'infinite') {
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2400);
          } else { setAutoSpinMode('off'); setAutoSpinsRemaining(0); }
        }
      }, duration);
    };

    if (fastSkip) { runReelSpin(); }
    else {
      setIsChestShaking(true); SoundEffects.playChestShake();
      setTimeout(() => { setIsChestShaking(false); runReelSpin(); }, 1200);
    }
  };

  const stopAutoSpin = () => {
    setAutoSpinMode('off'); setAutoSpinsRemaining(0);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
  };

  const configureAutoSpin = (mode: 'x3' | 'x10' | 'infinite') => {
    if (isSpinning || isChestShaking) return;
    setAutoSpinMode(mode);
    setAutoSpinsRemaining(mode === 'x3' ? 3 : mode === 'x10' ? 10 : 999999);
    setTimeout(startCaseUnboxing, 100);
  };

  // Ambient floating particles for chest selection
  const ambientParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      size: 2 + Math.random() * 3,
      duration: 2.5 + Math.random() * 2,
    })), []);

  /* ── Reel card renderer ── */
  const renderReelCard = (item: CaseItem, idx: number, isIdle: boolean) => {
    const r = RARITY[item.rarity];
    const isSuperRare = item.rarity === 'Legendary' || item.rarity === 'Mythic';
    return (
      <div key={idx}
        className="w-[152px] h-40 shrink-0 flex flex-col items-center justify-between p-3 relative select-none overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Background gradient tint */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: `linear-gradient(180deg, ${r.color}15 0%, ${r.color}30 100%)` }} />
        {/* Shimmer sweep on rare items */}
        {isSuperRare && <div className="absolute inset-0 shimmer-sweep overflow-hidden" />}
        {/* Item image container */}
        <div className="w-[72px] h-[72px] bg-black/40 border border-white/[0.06] rounded-xl flex items-center justify-center mt-5 relative z-10"
          style={isSuperRare ? { boxShadow: `0 0 16px ${r.glow}` } : undefined}>
          <ItemImage item={item} className="w-12 h-12 object-contain" />
        </div>
        {/* Item name */}
        <p className="text-[10px] font-black font-sans leading-none text-slate-200 truncate w-full text-center mt-2 px-1.5 z-10">{item.name}</p>
        {/* Bottom rarity bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: r.color, opacity: 0.7 }} />
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6" id="case-opening-view">
      <Confetti active={confettiActive} />

      {selectedChestId === null ? (
        /* ═══════════════════ CHEST SELECTION GRID ═══════════════════ */
        <div className="flex flex-col gap-8 animate-fade-in px-2 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col gap-2 border-b border-white/5 pb-5 text-center sm:text-left">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-500 font-display uppercase tracking-tight flex items-center gap-3">
              <Crown className="w-7 h-7 text-yellow-400" />
              PILIH CHEST UNTUK DIBUKA
            </h2>
            <p className="text-sm text-slate-400 font-sans leading-relaxed">
              Pilih salah satu dari 9 Kategori Chest premium eksklusif. Semua hadiah menggunakan gambar PNG dan drop rates berbasis weighted RNG!
            </p>
          </div>

          {/* Ambient floating particles */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {ambientParticles.map(p => (
              <div key={p.id} className="absolute rounded-full bg-purple-400/30 animate-float-up"
                style={{ left: `${p.left}%`, bottom: '10%', width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
            ))}
          </div>

          {/* Chest Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {chests.map((chest) => (
              <div key={chest.id} onClick={() => setSelectedChestId(chest.id)}
                className="relative bg-[#141224]/80 hover:bg-[#1a1730]/90 border border-white/[0.08] hover:border-purple-500/50 rounded-3xl p-7 flex flex-col cursor-pointer transition-all duration-500 transform hover:-translate-y-2 hover:shadow-[0_24px_60px_rgba(168,85,247,0.25)] group select-none overflow-hidden shimmer-sweep">
                {/* Ambient glow orb */}
                <div className={`absolute -right-16 -top-16 w-64 h-64 bg-gradient-to-br ${chest.color} rounded-full blur-3xl transition-all duration-700 animate-card-glow group-hover:scale-125`} />
                {/* Top accent line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Chest Image */}
                <div className="w-full flex flex-col items-center gap-5 relative z-10">
                  <div className="relative w-52 h-52 flex items-center justify-center mt-2">
                    <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/15 rounded-full blur-2xl transition-all duration-500" />
                    <img src={chest.image} alt={chest.name}
                      className="w-48 h-48 object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.7)] group-hover:scale-110 group-hover:drop-shadow-[0_20px_40px_rgba(168,85,247,0.3)] transition-all duration-500 relative z-10"
                      referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex flex-col text-center">
                    <h3 className="text-xl font-black text-slate-100 group-hover:text-purple-300 transition-colors tracking-wide font-display">
                      {chest.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-sans mt-1">Koleksi Chest Eksklusif Premium</p>
                  </div>
                </div>

                {/* Item count badge */}
                <div className="flex items-center justify-center gap-1.5 mt-3 relative z-10">
                  <Star className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-mono font-bold text-slate-400">{chest.items.length} Items</span>
                </div>

                {/* CTA Button */}
                <div className="w-full mt-5 bg-[#0f0e1d] group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 text-slate-300 group-hover:text-white border border-white/[0.06] group-hover:border-transparent py-3.5 rounded-2xl text-center text-sm font-black transition-all duration-300 transform group-hover:scale-[1.02] relative z-10">
                  BUKA SEKARANG
                </div>
              </div>
            ))}
          </div>

          {/* Info block */}
          <div className="bg-[#141224]/40 border border-white/[0.06] p-5 rounded-2xl flex items-start gap-4 text-xs font-sans text-slate-400">
            <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-bold block mb-0.5">Drop Rates & Keadilan RNG:</span>
              Chest Opening Game bertipe simulasi. Setiap chest berisi item unik yang diurutkan berdasarkan kelangkaan. Buka semua chest secara bebas tanpa batas!
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════ SPIN / UNBOXING INTERFACE ═══════════════════ */
        <div className="flex flex-col gap-5 animate-fade-in">

          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { stopAutoSpin(); setSelectedChestId(null); setShowPrizeOverlay(false); }}
                className="p-2.5 bg-[#141224]/60 border border-white/[0.06] hover:border-purple-500/40 text-slate-400 hover:text-white rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <img src={activeChest?.image} alt={activeChest?.name}
                  className="w-11 h-11 object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" referrerPolicy="no-referrer" />
                <div className="flex flex-col">
                  <span className="text-lg font-black text-slate-100 font-display tracking-wide">{activeChest?.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">CASE UNBOXING</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsMuted(p => !p)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                !isMuted ? 'bg-purple-950/30 border-purple-500/20 text-purple-400' : 'bg-slate-900/40 border-white/5 text-slate-500'}`}>
              {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* ═══ REEL TAPE ENGINE ═══ */}
          <div className="w-full relative bg-[#100E1C]/95 border border-white/[0.06] rounded-2xl py-8 px-3 overflow-hidden shadow-2xl select-none"
            style={{ backgroundImage: activeChest?.background, backgroundSize: 'cover', backgroundPosition: 'center' }}>

            {/* Center pointer needle */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[3px] z-30 transform -translate-x-1/2 pointer-events-none animate-pointer-glow"
              style={{ background: 'linear-gradient(180deg, #facc15 0%, rgba(250,204,21,0.3) 30%, rgba(250,204,21,0.3) 70%, #facc15 100%)' }}>
              {/* Top arrow */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-400" />
              {/* Bottom arrow */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[14px] border-l-transparent border-r-transparent border-b-yellow-400" />
              {/* Center glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-400/20 blur-md" />
            </div>

            {/* Left/Right edge fade gradients */}
            <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-[#100E1C] to-transparent z-20 pointer-events-none" />
            <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[#100E1C] to-transparent z-20 pointer-events-none" />

            {/* Reel Container */}
            <div ref={reelContainerRef}
              className="w-full h-[170px] flex items-center overflow-hidden relative rounded-xl bg-black/60 border border-white/[0.04] shadow-inner">

              {/* Chest Shaking Overlay */}
              {isChestShaking && activeChest && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col items-center justify-center animate-fade-in pointer-events-none overflow-hidden">
                  {/* Radial glow behind chest */}
                  <div className="absolute w-52 h-52 rounded-full blur-3xl opacity-40 animate-glow-pulse"
                    style={{ background: `radial-gradient(circle, ${activeChest?.items[activeChest.items.length - 1]?.color || '#a855f7'} 0%, transparent 70%)` }} />
                  {/* Spinning ring */}
                  <div className="absolute w-40 h-40 border-2 border-dashed border-purple-500/20 rounded-full animate-spin" style={{ animationDuration: '4s' }} />
                  <div className="absolute w-48 h-48 border border-dashed border-yellow-500/10 rounded-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
                  {/* Shaking chest image */}
                  <div className="relative animate-shake-chest">
                    <img src={activeChest.image} alt={activeChest.name}
                      className="w-28 h-28 object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.85)]" referrerPolicy="no-referrer" />
                  </div>
                  <p className="mt-5 text-[11px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 font-mono tracking-[0.2em] animate-pulse flex items-center gap-2 z-10">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                    UNLOCKING {activeChest.name.toUpperCase()}...
                  </p>
                </div>
              )}

              {/* Reel tape items */}
              <div ref={reelItemsRef}
                className="flex items-center absolute left-0 will-change-transform"
                style={{
                  transform: `translate3d(${spinTranslation}px, 0, 0)`,
                  transition: isSpinning
                    ? `transform ${fastSkip ? gs.fastSpinDurationMs : gs.defaultSpinDurationMs}ms ${gs.spinEasing}`
                    : 'none',
                  width: `${65 * 152}px`
                }}>
                {reelItems.length === 0 ? (
                  Array.from({ length: 12 }).map((_, idx) => {
                    const tempItem = activeChest?.items[idx % (activeChest.items.length)] || activeChest?.items[0];
                    if (!tempItem) return null;
                    return renderReelCard(tempItem, idx, true);
                  })
                ) : (
                  reelItems.map((item, idx) => renderReelCard(item, idx, false))
                )}
              </div>
            </div>
          </div>

          {/* ═══ CONTROLS & PRIZE REVEAL ═══ */}
          <div className="bg-[#141224]/50 border border-white/[0.06] p-5 rounded-2xl flex flex-col gap-4">

            {/* Auto spin indicator */}
            {autoSpinMode !== 'off' && (
              <div className="flex items-center justify-between bg-purple-950/20 px-4 py-2.5 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-400">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-ping" />
                  <span>Auto Spin ({autoSpinMode.toUpperCase()}) — Sisa: {autoSpinMode === 'infinite' ? '∞' : autoSpinsRemaining}</span>
                </div>
                <button onClick={stopAutoSpin}
                  className="px-2.5 py-0.5 bg-red-500 hover:bg-red-400 text-white font-mono rounded text-[10px] transition cursor-pointer">
                  STOP
                </button>
              </div>
            )}

            {/* Prize Reveal Modal */}
            {showPrizeOverlay && winningItemResult && (() => {
              const wr = RARITY[winningItemResult.rarity];
              const isSuperRare = winningItemResult.rarity === 'Legendary' || winningItemResult.rarity === 'Mythic';
              return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowPrizeOverlay(false); }}>
                  <div className="relative w-full max-w-lg animate-scale-up-reveal" onClick={(e) => e.stopPropagation()}>
                    {/* Outer glow frame */}
                    <div className="absolute -inset-[2px] rounded-3xl opacity-60" style={{ background: `linear-gradient(135deg, ${wr.color}, transparent, ${wr.color})` }} />
                    {/* Modal body */}
                    <div className="relative bg-[#13111f] border border-white/[0.08] rounded-3xl p-8 flex flex-col items-center text-center overflow-hidden">
                      {/* Rarity flash background */}
                      <div className="absolute inset-0 animate-rarity-flash pointer-events-none"
                        style={{ background: `radial-gradient(circle at center, ${wr.color}40 0%, transparent 65%)` }} />
                      {/* Animated sparkles for super rare */}
                      {isSuperRare && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="absolute animate-float-up"
                              style={{ left: `${10 + Math.random() * 80}%`, bottom: '20%', animationDelay: `${i * 0.3}s`, animationDuration: '2.5s' }}>
                              <Sparkles className="w-3 h-3" style={{ color: wr.color, opacity: 0.6 }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Crown icon */}
                      {isSuperRare && <Crown className="w-6 h-6 text-yellow-400 mb-2 animate-bounce relative z-10" />}
                      {/* Prize image with dramatic entry animation */}
                      <div className="relative z-10 mb-4">
                        <div className="w-32 h-32 rounded-2xl flex items-center justify-center border-2 animate-prize-entry"
                          style={{ borderColor: wr.color, boxShadow: `0 0 40px ${wr.glow}, 0 0 80px ${wr.glow}`, background: 'rgba(0,0,0,0.5)' }}>
                          <ItemImage item={winningItemResult} className="w-20 h-20 object-contain" />
                        </div>
                        {isSuperRare && <div className="absolute -inset-3 rounded-3xl animate-glow-pulse pointer-events-none" style={{ boxShadow: `0 0 50px ${wr.glow}` }} />}
                      </div>
                      {/* Item name */}
                      <h4 className="relative z-10 text-2xl font-black text-white font-display tracking-tight mb-4">{winningItemResult.name}</h4>
                      {/* Action buttons */}
                      <div className="relative z-10 flex items-center gap-3 w-full">
                        <button onClick={startCaseUnboxing} disabled={isSpinning || isChestShaking}
                          className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-900/40 cursor-pointer flex items-center justify-center gap-2">
                          <RotateCcw className="w-4 h-4" /> Buka Lagi
                        </button>
                        <button onClick={() => setShowPrizeOverlay(false)}
                          className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/[0.06] text-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer">
                          Tutup
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Trigger buttons row */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-2.5 items-center justify-center sm:justify-start w-full lg:w-auto">
                {/* Main BUKA button */}
                <button disabled={isSpinning || isChestShaking} onClick={startCaseUnboxing}
                  className="px-7 py-4 bg-gradient-to-r from-red-500 to-orange-500 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed hover:from-red-400 hover:to-orange-400 text-white font-black font-display text-sm rounded-xl tracking-wide select-none cursor-pointer border border-orange-400/20 shadow-lg shadow-red-950/40 hover:shadow-red-500/25 transition-all flex items-center justify-center gap-2 active:scale-95">
                  {isSpinning ? (
                    <><RotateCcw className="w-4 h-4 animate-spin text-white" /><span>UNBOXING...</span></>
                  ) : isChestShaking ? (
                    <><Sparkles className="w-4 h-4 animate-pulse text-yellow-400" /><span>UNLOCKING...</span></>
                  ) : (
                    <><Play className="w-4 h-4" /><span>BUKA CHEST (FREE)</span></>
                  )}
                </button>
                {/* Auto spin buttons */}
                <div className="flex items-center bg-black/40 border border-white/[0.06] rounded-xl p-1 shrink-0">
                  {(['x3', 'x10', 'infinite'] as const).map((mode, i) => (
                    <React.Fragment key={mode}>
                      {i > 0 && <div className="w-px h-4 bg-white/10" />}
                      <button disabled={isSpinning || isChestShaking} onClick={() => configureAutoSpin(mode)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          autoSpinMode === mode ? 'bg-purple-600/30 text-purple-300' : 'text-slate-300 hover:bg-[#1f1a3a]'
                        } disabled:opacity-50`}>
                        {mode === 'infinite' ? 'Auto ∞' : `Auto ${mode}`}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-slate-300">
                  <input type="checkbox" checked={fastSkip} onChange={(e) => setFastSkip(e.target.checked)}
                    className="w-4 h-4 accent-red-500 rounded border-white/10 bg-black/40 cursor-pointer" />
                  <span>Skip Animasi (Instant)</span>
                </label>
                {autoSpinMode !== 'off' && (
                  <button onClick={stopAutoSpin}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer">
                    <X className="w-3.5 h-3.5" /> Stop
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══ ITEMS LIST SHOWROOM ═══ */}
          <div className="bg-[#141224]/30 border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-4">
            <h3 className="text-sm font-black text-slate-300 font-mono tracking-wider uppercase flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" />
              <span>Daftar Item Di Dalam Chest</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {activeChest?.items.map((item, idx) => {
                const r = RARITY[item.rarity];
                const isSR = item.rarity === 'Legendary' || item.rarity === 'Mythic';
                return (
                  <div key={idx}
                    className="bg-black/30 border border-white/[0.04] hover:border-white/[0.12] p-4 rounded-2xl flex flex-col items-center text-center relative overflow-hidden group select-none transition-all duration-300 hover:scale-[1.04] hover:-translate-y-0.5 shimmer-sweep">
                    <div className="absolute inset-0 opacity-[0.08]" style={{ background: `linear-gradient(180deg, ${r.color}20, ${r.color}40)` }} />
                    {/* Super rare glow */}
                    {isSR && <div className="absolute inset-0 animate-glow-pulse rounded-2xl pointer-events-none" style={{ boxShadow: `inset 0 0 20px ${r.glow}` }} />}
                    <div className="w-16 h-16 flex items-center justify-center mt-1 relative z-10">
                      <ItemImage item={item} className="w-14 h-14 object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <span className="text-xs font-black text-slate-200 mt-3 truncate w-full px-1 relative z-10">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
