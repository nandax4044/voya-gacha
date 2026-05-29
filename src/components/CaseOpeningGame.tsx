import React, { useState, useEffect, useRef } from 'react';
import chestsData from '../data/case_opening.json';
import { Confetti } from './Confetti';
import { SoundEffects } from './SoundEffects';
import { 
  Gift, 
  ChevronLeft, 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  X, 
  Info,
  Sparkles
} from 'lucide-react';

// Interfaces matching configurations
interface CaseItem {
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  chance: number; // Drop rate chance in weighted percentage
  value: number;  // Cosmetic coin value
  icon: string;   // Emoji fallback symbol
  color: string;  // Visual theme hex color
  image: string;  // Asset path or dynamic URL
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

const RARITY_HIERARCHY = {
  Common: { text: "Common", bg: "bg-slate-500/10", border: "border-slate-500/40", textCol: "text-slate-400", glow: "shadow-slate-500/5", color: "#a1a1aa" },
  Rare: { text: "Rare", bg: "bg-blue-500/10", border: "border-blue-500/40", textCol: "text-blue-400", glow: "shadow-blue-500/10", color: "#3b82f6" },
  Epic: { text: "Epic", bg: "bg-purple-500/10", border: "border-purple-500/40", textCol: "text-purple-400", glow: "shadow-purple-500/15", color: "#a855f7" },
  Legendary: { text: "Legendary", bg: "bg-yellow-500/10", border: "border-yellow-500/40", textCol: "text-yellow-400", glow: "shadow-yellow-500/25", color: "#eab308" },
  Mythic: { text: "Mythic", bg: "bg-red-500/10", border: "border-red-500/40", textCol: "text-red-400", glow: "shadow-red-500/35", color: "#ef4444" }
};

// Resilient Item Image Renderer Component
const ItemImage = ({ item, className = "w-16 h-16 object-contain" }: { item: CaseItem; className?: string }) => {
  const [hasError, setHasError] = useState(false);

  if (!item.image || hasError) {
    return <span className="text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] select-none">{item.icon}</span>;
  }

  return (
    <img 
      src={item.image} 
      alt={item.name} 
      className={`${className} select-none transition-all duration-300 hover:scale-110`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};

export default function CaseOpeningGame() {
  // Load configuration from dynamic JSON config Safely
  const chests: Chest[] = (chestsData.chests || chestsData) as Chest[];
  const gameSettings = (chestsData as any).gameSettings || {
    defaultSpinDurationMs: 5500,
    fastSpinDurationMs: 1500,
    soundTickFrequencyHz: 220,
    pointerShadowGlowHex: "#ea580c",
    spinEasing: "cubic-bezier(0.04, 0.84, 0.12, 1)"
  };

  // --- Persistent Settings & Configurations ---
  const [selectedChestId, setSelectedChestId] = useState<string | null>(null);

  // --- Animation and Reels parameters ---
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isChestShaking, setIsChestShaking] = useState<boolean>(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [spinTranslation, setSpinTranslation] = useState<number>(0);
  const [winningItemResult, setWinningItemResult] = useState<CaseItem | null>(null);
  const [showPrizeOverlay, setShowPrizeOverlay] = useState<boolean>(false);
  const [confettiActive, setConfettiActive] = useState<boolean>(false);
  
  // Auto mode settings
  const [autoSpinMode, setAutoSpinMode] = useState<'off' | 'x3' | 'x10' | 'infinite'>('off');
  const [autoSpinsRemaining, setAutoSpinsRemaining] = useState<number>(0);
  const [fastSkip, setFastSkip] = useState<boolean>(false);

  // Refs
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const reelItemsRef = useRef<HTMLDivElement>(null);
  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoLoopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of sound enabled state
  useEffect(() => {
    SoundEffects.setEnabled(!isMuted);
  }, [isMuted]);

  // Clean timeouts on component unmount
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    };
  }, []);

  // --- Realtime Sound Tick synchronizer using requestAnimationFrame querying ---
  useEffect(() => {
    if (!isSpinning) return;

    let animId: number;
    const itemCardWidth = 145;
    let lastTickIndex = -1;

    const trackTicks = () => {
      if (!reelItemsRef.current || !reelContainerRef.current) {
        animId = requestAnimationFrame(trackTicks);
        return;
      }
      
      const reelDom = reelItemsRef.current;
      const rect = reelDom.getBoundingClientRect();
      const containerRect = reelContainerRef.current.getBoundingClientRect();
      
      // Compute the pixel centerline pointing directly under the gold selector needle
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

  // Weighted RNG logic module based on drop rate
  const computeWeightedDrop = (itemsList: CaseItem[]): CaseItem => {
    const totalWeight = itemsList.reduce((acc, item) => acc + item.chance, 0);
    let rand = Math.random() * totalWeight;
    
    for (const item of itemsList) {
      if (rand < item.chance) {
        return item;
      }
      rand -= item.chance;
    }
    return itemsList[0];
  };

  // Find active chest config
  const activeChest = chests.find(c => c.id === selectedChestId) || null;

  // Handle Initiating Case Opening Unboxing sequence
  const startCaseUnboxing = () => {
    if (isSpinning || isChestShaking || !activeChest) return;
    
    // Reset translation to starting offset immediately with no animation
    setSpinTranslation(0);
    setIsSpinning(false);
    setShowPrizeOverlay(false);
    setWinningItemResult(null);

    const runReelSpin = () => {
      // Compute winning item using cumulative RNG drop rates
      const winningItem = computeWeightedDrop(activeChest.items);

      // Build the tape reel of 65 items (The winning item resides at index 52)
      const totalTapeSize = 65;
      const targetIdx = 52;
      const newTape: CaseItem[] = [];

      for (let i = 0; i < totalTapeSize; i++) {
        if (i === targetIdx) {
          newTape.push(winningItem);
        } else {
          newTape.push(computeWeightedDrop(activeChest.items));
        }
      }

      setReelItems(newTape);
      setWinningItemResult(winningItem);
      setIsSpinning(true);

      // Decelerating CSS 3D Translate to center the winning card precisely under the needle
      const itemCardWidth = 145;
      const containerWidth = reelContainerRef.current ? reelContainerRef.current.clientWidth : 800;
      // Random offset to make the final stopping coordinate asymmetrical and highly realistic (+/- 30px from card center)
      const randomVisualOffset = Math.floor(Math.random() * 60) - 30;
      const targetTranslation = - (targetIdx * itemCardWidth) + (containerWidth / 2 - itemCardWidth / 2) + randomVisualOffset;

      setSpinTranslation(targetTranslation);

      const duration = fastSkip ? gameSettings.fastSpinDurationMs : gameSettings.defaultSpinDurationMs;

      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        setIsSpinning(false);
        setShowPrizeOverlay(true);
        SoundEffects.playFanfare();

        // Trigger visual confetti bursts on Rare, Legendary, or Mythic pulls
        if (winningItem.rarity === 'Legendary' || winningItem.rarity === 'Mythic') {
          setConfettiActive(true);
          setTimeout(() => setConfettiActive(false), 2600);
        }

        // Loop auto spin if configured
        if (autoSpinMode !== 'off') {
          if (autoSpinMode === 'x3' && autoSpinsRemaining > 1) {
            setAutoSpinsRemaining(r => r - 1);
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2200);
          } else if (autoSpinMode === 'x10' && autoSpinsRemaining > 1) {
            setAutoSpinsRemaining(r => r - 1);
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2200);
          } else if (autoSpinMode === 'infinite') {
            if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = setTimeout(startCaseUnboxing, 2200);
          } else {
            setAutoSpinMode('off');
            setAutoSpinsRemaining(0);
          }
        }
      }, duration);
    };

    if (fastSkip) {
      runReelSpin();
    } else {
      setIsChestShaking(true);
      SoundEffects.playChestShake();
      setTimeout(() => {
        setIsChestShaking(false);
        runReelSpin();
      }, 1000);
    }
  };

  // Turn off auto spinning routines instantly
  const stopAutoSpin = () => {
    setAutoSpinMode('off');
    setAutoSpinsRemaining(0);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
  };

  // Set limits for auto spin queues
  const configureAutoSpin = (modeType: 'x3' | 'x10' | 'infinite') => {
    if (isSpinning || isChestShaking) return;
    setAutoSpinMode(modeType);
    if (modeType === 'x3') {
      setAutoSpinsRemaining(3);
    } else if (modeType === 'x10') {
      setAutoSpinsRemaining(10);
    } else {
      setAutoSpinsRemaining(999999);
    }
    setTimeout(startCaseUnboxing, 100);
  };

  return (
    <div className="w-full flex flex-col gap-6" id="case-opening-view">
      
      {/* Confetti overlay for legendary pulls */}
      <Confetti active={confettiActive} />

      {/* 2. CHOOSE CHEST MAIN SCREEN IF NOT SELECTED */}
      {selectedChestId === null ? (
        <div className="flex flex-col gap-8 animate-fade-in px-2 max-w-7xl mx-auto w-full">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-5 text-center sm:text-left">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-yellow-500 font-display uppercase tracking-tight">
              PILIH CHEST UNTUK DIBUKA
            </h2>
            <p className="text-sm text-slate-400 font-sans leading-relaxed">
              Pilih salah satu dari 9 Kategori Chest premium eksklusif di bawah ini. Semua hadiah di dalam chest sudah menggunakan gambar PNG interaktif dan drop rates murni berbasis algoritma weighted RNG!
            </p>
          </div>

          {/* LARGE GRID VIEW ENLARGED: Renders big chest cards with real high-resolution PNG images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {chests.map((chest) => (
              <div
                key={chest.id}
                onClick={() => setSelectedChestId(chest.id)}
                className="bg-[#141224]/75 hover:bg-[#1c1932]/90 border-2 border-white/10 hover:border-purple-500/75 rounded-[36px] p-8 flex flex-col justify-between cursor-pointer transition-all duration-500 transform hover:-translate-y-3 hover:shadow-[0_20px_55px_rgba(168,85,247,0.3)] group select-none relative overflow-hidden min-h-[500px]"
              >
                {/* Decorative glow background colored according to the chest properties */}
                <div className={`absolute -right-20 -top-20 w-72 h-72 bg-gradient-to-br ${chest.color} opacity-[0.08] group-hover:opacity-[0.2] rounded-full blur-3xl transition-all duration-500`} />
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-[4px] bg-transparent group-hover:bg-gradient-to-r group-hover:from-purple-500 group-hover:to-pink-500 rounded-full transition-all duration-300" />

                {/* Upper segment: PNG image (enlarged) & Name */}
                <div className="w-full flex flex-col items-center gap-6">
                  <div className="relative w-56 h-56 flex items-center justify-center mt-4">
                    <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/20 rounded-full blur-3xl transition-all duration-300 scale-100" />
                    <img 
                      src={chest.image} 
                      alt={chest.name}
                      className="w-52 h-52 object-contain filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.7)] group-hover:scale-112 group-hover:rotate-3 transition-all duration-500 relative z-10" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="flex flex-col text-center mt-3">
                    <h3 className="text-2xl font-black text-slate-100 group-hover:text-purple-300 transition-colors tracking-wide font-display">
                      {chest.name}
                    </h3>
                    <p className="text-sm text-slate-400 font-sans mt-1">
                      Koleksi Chest Eksklusif Premium
                    </p>
                  </div>
                </div>

                

                {/* Open command action badge */}
                <div className="w-full mt-6 bg-[#0f0e1d] group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 text-slate-300 group-hover:text-white border border-white/10 group-hover:border-transparent py-4 rounded-2xl text-center text-sm font-black transition-all duration-300 transform group-hover:scale-[1.02]">
                  BUKA SEKARANG 
                </div>

              </div>
            ))}
          </div>

          {/* Quick instructions / Info block */}
          <div className="bg-[#141224]/30 border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 mt-2 text-xs font-sans text-slate-400 shadow-xl">
            <Info className="w-6 h-6 text-purple-400 shrink-0" />
            <div>
              <span className="text-slate-200 font-bold block mb-0.5">Informasi Drop Rates & Keadilan RNG:</span> Chest Opening Game bertipe simulasi. Setiap chest berisi item-item unik yang diurutkan berdasarkan kelangkaan. Anda dapat membuka semua chest secara bebas secara tidak terbatas dengan unboxing simulator ini!
            </div>
          </div>
        </div>
      ) : (
        // 3. TARGET SPIN CASE PAGE WITH BUTTERY SMOOTH ROLETTE TAPE REEL FILTER
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Header Action Row */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  stopAutoSpin();
                  setSelectedChestId(null);
                  setShowPrizeOverlay(false);
                }}
                className="p-3 bg-[#141224]/60 border border-white/5 hover:border-purple-500/40 text-slate-400 hover:text-white rounded-2xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <img 
                  src={activeChest?.image} 
                  alt={activeChest?.name}
                  className="w-12 h-12 object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-xl font-black text-slate-100 font-display tracking-wide">{activeChest?.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">CASE UNBOXING INTERFACE</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Sound Toggle */}
              <button
                onClick={() => setIsMuted(prev => !prev)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                  !isMuted 
                    ? 'bg-purple-950/30 border-purple-500/20 text-purple-400 hover:bg-purple-900/40' 
                    : 'bg-slate-900/40 border-white/5 text-slate-500 hover:bg-slate-800/40'
                }`}
              >
                {!isMuted ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* CHASE ROLETTE TAPE ENGINE BOX */}
          <div 
            className="w-full relative bg-[#100E1C]/95 border border-white/10 rounded-3xl py-10 px-4 overflow-hidden shadow-2xl select-none"
            style={{ 
              backgroundImage: activeChest?.background,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Horizontal pointer target needle line (exactly centered in viewport box) */}
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-yellow-400 z-30 shadow-[0_0_20px_#eab308] transform -translate-x-1/2 pointer-events-none">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 border-spacing-2 border-[14px] border-t-yellow-400 border-x-transparent border-b-transparent w-0 h-0" />
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 border-spacing-2 border-[14px] border-b-yellow-400 border-x-transparent border-t-transparent w-0 h-0" />
            </div>

            {/* Reel Container tape window viewport */}
            <div 
              ref={reelContainerRef}
              className="w-full h-44 flex items-center overflow-hidden relative rounded-2xl bg-black/75 border border-white/5 backdrop-blur-md shadow-inner"
            >
              {/* Premium Shaking Chest Animation Overlay before the tape start scrolling */}
              {isChestShaking && activeChest && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-45 flex flex-col items-center justify-center animate-fade-in pointer-events-none">
                  <div className={`absolute w-44 h-44 bg-gradient-to-br ${activeChest.color} rounded-full blur-2xl opacity-35 animate-pulse`} />
                  <div className="relative animate-shake-chest flex flex-col items-center justify-center">
                    <img 
                      src={activeChest.image} 
                      alt={activeChest.name} 
                      className="w-28 h-28 object-contain filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -inset-4 border-2 border-dashed border-purple-500/30 rounded-full animate-spin scale-110" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="mt-4 z-10">
                    <p className="text-xs font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 font-mono tracking-widest animate-pulse flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>UNLOCKING {activeChest.name}...</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Hardware Accelerated, smooth translation reel container with custom dynamic deceleration */}
              <div 
                ref={reelItemsRef}
                className="flex items-center absolute left-0 will-change-transform animate-fade-in"
                style={{
                  transform: `translate3d(${spinTranslation}px, 0px, 0px)`,
                  transition: isSpinning 
                    ? `transform ${fastSkip ? gameSettings.fastSpinDurationMs : gameSettings.defaultSpinDurationMs}ms ${gameSettings.spinEasing}`
                    : 'none',
                  width: `${65 * 145}px` // 65 items * 145px sizing width
                }}
              >
                {reelItems.length === 0 ? (
                  // Initial idle reel showing standard content before starting the spin
                  Array.from({length: 12}).map((_, idx) => {
                    const tempItem = activeChest?.items[idx % (activeChest.items.length)] || activeChest?.items[0];
                    if (!tempItem) return null;
                    const rConf = RARITY_HIERARCHY[tempItem.rarity];
                    return (
                      <div 
                        key={idx}
                        className="w-[145px] h-36 shrink-0 flex flex-col items-center justify-between p-3 border-r border-[#15132d]/40 relative bg-gradient-to-b from-black/20 to-black/50 select-none group"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-b ${rConf.bg} opacity-20`} />
                        <span className={`text-[9px] font-bold ${rConf.textCol} tracking-wider font-mono absolute top-2 left-3`}>{rConf.text}</span>
                        <div className="w-[85px] h-[85px] flex items-center justify-center text-4.5xl drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)] mt-4">
                          <ItemImage item={tempItem} className="w-16 h-16 object-contain filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.65)] group-hover:scale-110" />
                        </div>
                        <div className="w-full text-center mt-2">
                          <p className="text-[10px] font-black font-sans leading-tight text-slate-200 truncate px-1">{tempItem.name}</p>
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-[4px]`} style={{ backgroundColor: rConf.color }} />
                      </div>
                    );
                  })
                ) : (
                  // Active generated spinning tape showing complete customized arrays with PNG templates
                  reelItems.map((item, idx) => {
                    const rConf = RARITY_HIERARCHY[item.rarity];
                    return (
                      <div 
                        key={idx}
                        className="w-[145px] h-36 shrink-0 flex flex-col items-center justify-between p-3 border-r border-[#15132d]/40 relative bg-[#0e0c1b]/95 select-none"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-b ${rConf.bg} opacity-[0.3]`} />
                        
                        {/* Shimmer overlay effect on super rare cards */}
                        {(item.rarity === 'Legendary' || item.rarity === 'Mythic') && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-pulse" />
                        )}

                        <span className={`text-[9px] font-bold ${rConf.textCol} tracking-wider font-mono absolute top-2 left-3`}>{rConf.text}</span>
                        
                        {/* Graphic PNG image / Emoji of the drop item */}
                        <div className="w-16 h-16 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center drop-shadow-[0_6px_12px_rgba(0,0,0,0.55)] mt-4">
                          <ItemImage item={item} className="w-12 h-12 object-contain" />
                        </div>

                        <div className="w-full text-center mt-2 z-10">
                          <p className="text-[10px] font-black font-sans leading-none text-slate-100 truncate px-1">{item.name}</p>
                        </div>

                        <div className={`absolute bottom-0 left-0 right-0 h-[3px]`} style={{ backgroundColor: rConf.color }} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 4. MAIN ACTION TRIGGER ROW CONTROLS */}
          <div className="bg-[#141224]/50 border border-white/10 p-6 rounded-3xl flex flex-col gap-4">
            
            {/* Spinning/Auto indicator details when running */}
            {autoSpinMode !== 'off' && (
              <div className="flex items-center justify-between bg-purple-950/20 px-4 py-2.5 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-400">
                <span className="flex h-2.5 w-2.5 rounded-full bg-purple-500 animate-ping" />
                <span>Auto Spin Active ({autoSpinMode.toUpperCase()}) - Spin sisa: {autoSpinMode === 'infinite' ? '∞' : autoSpinsRemaining}</span>
                <button 
                  onClick={stopAutoSpin}
                  className="px-2.5 py-0.5 bg-red-500 hover:bg-red-400 text-white font-mono rounded text-[10px] transition cursor-pointer"
                >
                  HALT QUEUE
                </button>
              </div>
            )}

            {/* Instant Victory Prize Reveal Overlay Screen with Customizable Reward PNG */}
            {showPrizeOverlay && winningItemResult && (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 animate-scale-up-sm relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-[0.15] pointer-events-none" 
                  style={{ background: `radial-gradient(circle, ${RARITY_HIERARCHY[winningItemResult.rarity].color} 0%, transparent 70%)` }}
                />

                <div className="flex items-center gap-5 z-10 text-center sm:text-left flex-col sm:flex-row">
                  <div className="w-24 h-24 bg-black/60 rounded-2xl border-2 flex items-center justify-center shadow-2xl animate-bounce shrink-0" style={{ borderColor: RARITY_HIERARCHY[winningItemResult.rarity].color }}>
                    <ItemImage item={winningItemResult} className="w-16 h-16 object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded ${RARITY_HIERARCHY[winningItemResult.rarity].bg} ${RARITY_HIERARCHY[winningItemResult.rarity].textCol} border ${RARITY_HIERARCHY[winningItemResult.rarity].border} font-mono shadow-md`}>
                        {winningItemResult.rarity}
                      </span>
                      <span className="text-[10px] bg-white/5 text-slate-300 font-mono px-2 py-0.5 rounded border border-white/5">
                        Weighted RNG Success
                      </span>
                    </div>
                    <h4 className="text-2xl font-black text-white mt-2 leading-tight font-display tracking-tight">{winningItemResult.name}</h4>
                    <p className="text-xs text-slate-400 font-sans mt-1">Chances / Peluang Drop: <span className="text-yellow-400 font-black font-mono">{winningItemResult.chance}%</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 z-10 w-full sm:w-auto justify-center shrink-0">
                  <button 
                    onClick={startCaseUnboxing}
                    disabled={isSpinning || isChestShaking}
                    className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-900/40 cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Buka Lagi</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowPrizeOverlay(false);
                    }}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {/* Standard trigger command line */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              
              {/* Trigger Single and Auto opening buttons */}
              <div className="flex flex-wrap gap-2.5 items-center justify-center sm:justify-start w-full lg:w-auto">
                <button
                  disabled={isSpinning || isChestShaking}
                  onClick={startCaseUnboxing}
                  className="px-7 py-4 bg-gradient-to-r from-red-500 to-orange-500 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed hover:from-red-400 hover:to-orange-400 text-white font-black font-display text-sm rounded-xl tracking-wide select-none cursor-pointer border border-orange-400/20 shadow-lg shadow-red-950/45 hover:shadow-red-500/25 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                  {isSpinning ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin text-white" />
                      <span>UNBOXING CASE...</span>
                    </>
                  ) : isChestShaking ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse text-yellow-400" />
                      <span>UNLOCKING CASE...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>BUKA CHEST (FREE)</span>
                    </>
                  )}
                </button>

                {/* Auto triggers collection */}
                <div className="flex items-center bg-black/40 border border-white/5 rounded-xl p-1 shrink-0">
                  <button
                    disabled={isSpinning || isChestShaking}
                    onClick={() => configureAutoSpin('x3')}
                    className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-[#1f1a3a] disabled:opacity-50 disabled:hover:bg-transparent rounded-lg cursor-pointer transition-all"
                  >
                    Auto x3
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  <button
                    disabled={isSpinning || isChestShaking}
                    onClick={() => configureAutoSpin('x10')}
                    className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-[#1f1a3a] disabled:opacity-50 disabled:hover:bg-transparent rounded-lg cursor-pointer transition-all"
                  >
                    Auto x10
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  <button
                    disabled={isSpinning || isChestShaking}
                    onClick={() => configureAutoSpin('infinite')}
                    className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-[#1f1a3a] disabled:opacity-50 disabled:hover:bg-transparent rounded-lg cursor-pointer transition-all"
                  >
                    Auto ∞
                  </button>
                </div>
              </div>

              {/* Fast Skip & Stop Auto */}
              <div className="flex items-center gap-4 shrink-0 justify-between w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={fastSkip}
                    onChange={(e) => setFastSkip(e.target.checked)}
                    className="w-4 h-4 accent-red-500 rounded border-white/10 bg-black/40 focus:ring-0 outline-none cursor-pointer"
                  />
                  <span>Skip Animasi (Instant)</span>
                </label>
                
                {autoSpinMode !== 'off' && (
                  <button 
                    onClick={stopAutoSpin}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Stop Auto
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* 5. CHEST INTERNAL ITEMS LIST SHOWROOM (ENLARGED) */}
          <div className="bg-[#141224]/30 border border-white/5 p-6 rounded-3xl flex flex-col gap-4">
            <h3 className="text-sm font-black text-slate-300 font-mono tracking-wider uppercase flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" />
              <span>Daftar Item Di Dalam Chest Ini</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {activeChest?.items.map((item, idx) => {
                const rh = RARITY_HIERARCHY[item.rarity];
                return (
                  <div 
                    key={idx}
                    className="bg-black/35 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex flex-col items-center text-center relative overflow-hidden group select-none transition-all duration-300 hover:scale-[1.03]"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-b ${rh.bg} opacity-[0.1]`} />
                    <span className="w-16 h-16 flex items-center justify-center mt-2">
                      <ItemImage item={item} className="w-14 h-14 object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] group-hover:scale-110" />
                    </span>
                    <span className="text-xs font-black text-slate-200 mt-3.5 truncate w-full px-1">{item.name}</span>
                    <div className="w-full flex items-center justify-between gap-2 border-t border-white/5 mt-3 pt-2">
                      <span className={`text-[10px] font-bold ${rh.textCol} font-mono uppercase`}>{rh.text}</span>
                      <span className="text-[10px] font-bold text-teal-400 font-mono">{item.chance}%</span>
                    </div>
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
