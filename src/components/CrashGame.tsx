import React, { useState, useEffect, useRef } from 'react';
import { PngEmoji } from '../App';
import { 
  Play, RotateCcw, TrendingUp, TrendingDown, HelpCircle, 
  Award, Users, Sparkles, Volume2, VolumeX, Layers, ShieldAlert 
} from 'lucide-react';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface FuelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

interface GameHistoryItem {
  id: string;
  crashPoint: number;
  betAmount: number;
  outcome: 'WIN' | 'LOSE' | 'CRASH';
  profit: number;
  mode: 'manual' | 'pick';
  timestamp: string;
}


// Sound synthesizer using Web Audio API
class CrashAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playTick(frequencyMultiplier: number) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      // Pitch goes up as multiplier grows
      const freq = Math.min(1000, 200 + frequencyMultiplier * 60);
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {
      // Audio context block safeguard
    }
  }

  playCashout() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.5, this.ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 0.4);
      osc2.stop(this.ctx.currentTime + 0.4);
    } catch (e) {
      // Audio context block safeguard
    }
  }

  playCrash() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      // Explosion effect using white noise dynamic filter
      const bufferSize = this.ctx.sampleRate * 0.4; // 0.4s
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.38);
      
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noiseNode.start();
      
      // Add heavy sine sub rumble
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + 0.3);
      
      oscGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (e) {
      // Audio context block safeguard
    }
  }
}

const soundManager = new CrashAudio();

export default function CrashGame() {
  // State
  const [betInput] = useState<string>('100');
  const mode = 'pick';
  
  // Mode manual and auto variables are removed to keep focus purely on prediction target
  const [pickMultiplier, setPickMultiplierInner] = useState<string>('2.00');
  
  // Game state
  const [gameState, setGameStateInner] = useState<'idle' | 'countdown' | 'playing' | 'crashed' | 'win'>('idle');
  const [countdownNum, setCountdownNum] = useState<string>('');
  const [currentMultiplier, setCurrentMultiplierInner] = useState<number>(1.00);
  const [crashPointValue, setCrashPointValue] = useState<number | null>(null);
  const [history, setHistory] = useState<GameHistoryItem[]>(() => {
    const saved = localStorage.getItem('crash_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, date: string}[]>(() => {
    const saved = localStorage.getItem('crash_leaderboard');
    return saved ? JSON.parse(saved) : [
      { name: "Sutan_Gacor", score: 8540, date: "2026-05-28" },
      { name: "Dewajitu", score: 4320, date: "2026-05-28" },
      { name: "Zeus⚡Jackpot", score: 3200, date: "2026-05-28" }
    ];
  });
  
  // Target win tracker states
  const [hasPassedTarget, setHasPassedTarget] = useState<boolean>(false);
  const hasPassedTargetRef = useRef<boolean>(false);
  const [winningSpark, setWinningSpark] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Refs for tracking animation loops and particle systems (continuous smooth 60fps render)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const gameStartRealTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isCashedOutRef = useRef<boolean>(false);
  const finalMultValueRef = useRef<number>(1.00);
  const lastSoundTickRef = useRef<number>(1.00);

  // Smooth background continuous animation refs
  const gameStateRef = useRef<string>('idle');
  const currentMultiplierRef = useRef<number>(1.00);
  const pickMultiplierRef = useRef<number>(2.00);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<FuelParticle[]>([]);
  const canvasDimensionsRef = useRef({ width: 620, height: 350 });

  // Sync wrappers to update both react state and raw rendering thread refs immediately
  const setGameState = (s: 'idle' | 'countdown' | 'playing' | 'crashed' | 'win') => {
    setGameStateInner(s);
    gameStateRef.current = s;
  };

  const setCurrentMultiplier = (m: number) => {
    setCurrentMultiplierInner(m);
    currentMultiplierRef.current = m;
  };

  const setPickMultiplier = (v: string) => {
    setPickMultiplierInner(v);
    pickMultiplierRef.current = parseFloat(v) || 2.00;
  };

  // Sync game history
  useEffect(() => {
    localStorage.setItem('crash_history', JSON.stringify(history));
  }, [history]);

  // Sync leaderboard
  useEffect(() => {
    localStorage.setItem('crash_leaderboard', JSON.stringify(leaderboard));
  }, [leaderboard]);

  // Sound manager setting sync
  useEffect(() => {
    soundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  // Handle auto resize for canvas
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 620, height: 350 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rocketImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/rocket.png';
    img.onload = () => {
      rocketImageRef.current = img;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // set height dynamically
        const calcHeight = Math.max(240, Math.min(365, width * 0.55));
        setCanvasDimensions({ width, height: calcHeight });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate crash point using user's rules:
  // 50% early: 1.00 - 2.99x
  // 30% medium: 3.00 - 6.00x
  // 15% high: 6.00 - 9.00x
  // 5% jackpot: 9.00 - 10.00x
  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.50) {
      return 1.00 + Math.random() * 1.99;
    } else if (r < 0.80) {
      return 3.00 + Math.random() * 3.00;
    } else if (r < 0.95) {
      return 6.00 + Math.random() * 3.00;
    } else {
      return 9.00 + Math.random() * 1.00;
    }
  };

  // Multiplier calculation over time
  const calcMultiplier = (elapsedMs: number) => {
    return Math.pow(Math.E, 0.00012 * elapsedMs);
  };

  // Synchronize canvasDimensions with its ref for high-speed continuous drawing
  useEffect(() => {
    canvasDimensionsRef.current = canvasDimensions;
  }, [canvasDimensions]);

  // Initialize random cosmic starry background once on mount
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 75; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 500,
        size: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 0.25 + 0.08,
        opacity: Math.random() * 0.7 + 0.3
      });
    }
    starsRef.current = stars;
  }, []);

  // Continuous high performance 60fps requestAnimationFrame loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    
    const renderLoop = (time: number) => {
      const delta = Math.min(50, time - lastTime); // cap delta to prevent warp jumps during tab backgrounding
      lastTime = time;
      
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderLoop);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderLoop);
        return;
      }
      
      const w = canvasDimensionsRef.current.width;
      const h = canvasDimensionsRef.current.height;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      
      // Draw cosmic nebula background space gradient (semi-transparent to showcase celestial castle background)
      ctx.clearRect(0, 0, w, h);
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, 'rgba(12, 11, 24, 0.45)');
      bgGrad.addColorStop(1, 'rgba(19, 17, 36, 0.55)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
      
      const stateStr = gameStateRef.current;
      const mult = currentMultiplierRef.current;
      
      // 1. Particle warp cosmic starfield movement
      // Drifts backwards faster as the rocket climbs
      const starSpeedModifier = stateStr === 'playing' ? Math.min(15, 1 + (mult - 1) * 2.5) : 0.8;
      starsRef.current.forEach((star) => {
        star.x -= star.speed * starSpeedModifier * (delta / 16.6);
        if (star.x < -10) {
          star.x = w + 10;
          star.y = Math.random() * h;
        }
        
        ctx.save();
        ctx.globalAlpha = star.opacity * (0.6 + Math.sin(time * 0.0035 + star.y) * 0.4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      
      // 2. Draw soft space radar/grid lines
      ctx.strokeStyle = 'rgba(124, 92, 252, 0.04)';
      ctx.lineWidth = 1;
      const horizontalGridLines = 5;
      for (let i = 1; i <= horizontalGridLines; i++) {
        const yVal = h - (h / (horizontalGridLines + 1)) * i;
        ctx.beginPath();
        ctx.moveTo(0, yVal);
        ctx.lineTo(w, yVal);
        ctx.stroke();
      }
      
      // Determine projection curve grids dynamically
      const maxScaleX = Math.max(5000, 1000 + (mult - 1) * 3500); 
      const maxScaleY = Math.max(2.0, mult * 1.25);
      
      // If crashed, pulse red overlay screen safely
      if (stateStr === 'crashed') {
        const pulseAlpha = 0.03 + Math.sin(time * 0.01) * 0.02;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }
      
      // Draw reference predict multiplier target threshold line
      const targetLineVal = pickMultiplierRef.current;
      if (targetLineVal) {
        const targetY = h - ((targetLineVal - 1.0) / (maxScaleY - 1.0)) * (h - 70) - 35;
        if (targetY > 10 && targetY < h) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, targetY);
          ctx.lineTo(w, targetY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`TARGET: ${targetLineVal.toFixed(2)}x`, 15, targetY - 6);
        }
      }
      
      // 3. Compute rocket trajectory curve
      const points: { x: number; y: number }[] = [];
      const step = 50;
      const pointsCount = Math.floor(maxScaleX / step);
      
      for (let i = 0; i <= pointsCount; i++) {
        const pointTime = i * step;
        const pointMult = Math.pow(Math.E, 0.00012 * pointTime);
        if (pointMult > mult) break;
        
        const px = (pointTime / maxScaleX) * (w - 80) + 40;
        const py = h - ((pointMult - 1.0) / (maxScaleY - 1.0)) * (h - 70) - 35;
        points.push({ x: px, y: py });
      }
      
      const rX = (Math.max(0, mult - 1.0) === 0) ? 40 : (Math.log(mult) / 0.00012) / maxScaleX * (w - 80) + 40;
      const rY = h - ((mult - 1.0) / (maxScaleY - 1.0)) * (h - 70) - 35;
      points.push({ x: rX, y: rY });
      
      // 4. Draw rocket trajectory line
      if (points.length > 1) {
        ctx.lineWidth = 4.5;
        
        // Multi-color neon laser gradient path
        const lineGrad = ctx.createLinearGradient(40, h, rX, rY);
        if (stateStr === 'crashed') {
          lineGrad.addColorStop(0, '#581c1c');
          lineGrad.addColorStop(1, '#ef4444');
        } else if (stateStr === 'win') {
          lineGrad.addColorStop(0, '#064e3b');
          lineGrad.addColorStop(1, '#10b981');
        } else {
          lineGrad.addColorStop(0, '#a855f7');  // purple
          lineGrad.addColorStop(0.5, '#c084fc'); // bright violet
          lineGrad.addColorStop(1, '#e9d5ff');   // white-violet
        }
        
        ctx.strokeStyle = lineGrad;
        ctx.shadowBlur = 12;
        ctx.shadowColor = stateStr === 'crashed' ? '#ef4444' : stateStr === 'win' ? '#10b981' : '#a855f7';
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // disable shadow for content areas
        
        // Translucent neon glow drop shadow under rocket curve
        ctx.lineTo(rX, h);
        ctx.lineTo(points[0].x, h);
        ctx.closePath();
        
        const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
        if (stateStr === 'crashed') {
          fillGrad.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
          fillGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        } else if (stateStr === 'win') {
          fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
          fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        } else {
          fillGrad.addColorStop(0, 'rgba(168, 85, 247, 0.1)');
          fillGrad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
        }
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }
      
      // 5. Emit exhaust flame fire particles
      if (stateStr === 'playing' && Math.random() < 0.85) {
        particlesRef.current.push({
          x: rX - 12,
          y: rY + (Math.random() * 6 - 3),
          vx: -(2.5 + Math.random() * 3.5),
          vy: Math.random() * 2 - 1,
          size: Math.random() * 4.5 + 1.5,
          alpha: 1.0,
          color: Math.random() < 0.5 ? '#f59e0b' : '#ef4444' // orange/red
        });
      }
      
      // Draw & recycle active particle sparks
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx * (delta / 16.6);
        p.y += p.vy * (delta / 16.6);
        p.alpha -= 0.04 * (delta / 16.6);
        
        if (p.alpha <= 0) {
          particlesRef.current.splice(idx, 1);
          return;
        }
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 1.5;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      
      // 6. Draw speed limit labels
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('1.00x', w - 45, h - 25);
      ctx.fillText(`${maxScaleY.toFixed(2)}x`, w - 45, 30);
      
      // 7. Draw the beautiful shuttle ship at curve tip with 3D wings
      if (stateStr === 'playing' || stateStr === 'win' || stateStr === 'crashed') {
        ctx.save();
        ctx.translate(rX, rY);
        
        // Tilt rotation logic
        const angle = stateStr === 'crashed' ? 0.35 : -0.21;
        ctx.rotate(angle);
        
        // Ship shadow glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = stateStr === 'crashed' ? '#ef4444' : stateStr === 'win' ? '#10b981' : '#c084fc';
        
        // Load and render PNG rocket
        if (rocketImageRef.current && rocketImageRef.current.complete) {
          const size = 42;
          ctx.drawImage(rocketImageRef.current, -size / 2, -size / 2, size, size);
        } else {
          // Fallback elegant vector drawing
          // Rocket main hull
          ctx.fillStyle = stateStr === 'crashed' ? '#f87171' : stateStr === 'win' ? '#34d399' : '#e9d5ff';
          ctx.beginPath();
          ctx.moveTo(15, 0);       // sleek pointy nose
          ctx.lineTo(-6, -7);      // left wing tip
          ctx.lineTo(-2, 0);       // tail burner
          ctx.lineTo(-6, 7);       // right wing tip
          ctx.closePath();
          ctx.fill();
          
          // Window details
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(3, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.shadowBlur = 0; // stop shadow effect
        
        // Interactive fire exhaust inside the thruster
        if (stateStr === 'playing') {
          const flameLength = 12 + Math.random() * 8;
          ctx.beginPath();
          ctx.moveTo(-10, -3);
          ctx.lineTo(-10 - flameLength, 0);
          ctx.lineTo(-10, 3);
          ctx.closePath();
          
          const flameGrad = ctx.createLinearGradient(0, 0, -flameLength, 0);
          flameGrad.addColorStop(0, '#ffffff');
          flameGrad.addColorStop(0.3, '#f59e0b');
          flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = flameGrad;
          ctx.fill();
        }
        ctx.restore();
        
        // Core plasma glow tip circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(rX, rY, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = stateStr === 'crashed' ? 'rgba(239, 68, 68, 0.45)' : stateStr === 'win' ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 18;
        ctx.shadowColor = stateStr === 'crashed' ? '#ef4444' : stateStr === 'win' ? '#22c55e' : '#a855f7';
        ctx.fill();
        ctx.restore();
      }
      
      animId = requestAnimationFrame(renderLoop);
    };
    
    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handle Play trigger button
  const handlePlayGame = () => {
    if (gameState !== 'idle') return;

    setWinningSpark(false);
    isCashedOutRef.current = false;
    lastSoundTickRef.current = 1.00;
    hasPassedTargetRef.current = false;
    setHasPassedTarget(false);

    // Initialise countdown loop
    setGameState('countdown');
    let sec = 3;
    setCountdownNum('3');
    
    const countInterval = setInterval(() => {
      sec--;
      if (sec === 2) setCountdownNum('2');
      else if (sec === 1) setCountdownNum('1');
      else if (sec === 0) {
        setCountdownNum('GO!');
        clearInterval(countInterval);
        setTimeout(() => {
          triggerGameLoop();
        }, 350);
      }
    }, 700);
  };

  // Main real-time physics simulation loop
  const triggerGameLoop = () => {
    isPlayingRef.current = true;
    const crashAt = generateCrashPoint();
    setCrashPointValue(crashAt);
    setGameState('playing');
    gameStartRealTimeRef.current = performance.now();

    const loop = (time: number) => {
      if (!isPlayingRef.current) return;

      const elapsed = time - gameStartRealTimeRef.current;
      const mult = calcMultiplier(elapsed);

      // Web Audio dynamic pitch ticker sound (triggers every 0.1x increments)
      if (mult > lastSoundTickRef.current + 0.15) {
        soundManager.playTick(mult);
        lastSoundTickRef.current = mult;
      }

      // Live update state
      const currentMultValue = parseFloat(mult.toFixed(2));
      setCurrentMultiplier(currentMultValue);
      finalMultValueRef.current = mult;

      // Check if rocket has passed the target multiplier
      const target = parseFloat(pickMultiplier);
      if (currentMultValue >= target && !hasPassedTargetRef.current) {
        hasPassedTargetRef.current = true;
        setHasPassedTarget(true);
        soundManager.playCashout(); // Play victory chime when rocket passes pick multiplier target!
      }

      // 1. Check Crash event
      if (mult >= crashAt) {
        triggerCrash(crashAt);
        return;
      }

      frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
  };

  // Trigger game failure/crash
  const triggerCrash = (crashAt: number) => {
    isPlayingRef.current = false;
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    soundManager.playCrash();

    const target = parseFloat(pickMultiplier);
    const wonInPick = crashAt >= target;

    if (wonInPick) {
      setGameState('win');
      setWinningSpark(true);
    } else {
      setGameState('crashed');
    }

    const outcome: GameHistoryItem = {
      id: Date.now().toString(),
      crashPoint: crashAt,
      betAmount: 0,
      outcome: wonInPick ? 'WIN' : 'LOSE',
      profit: wonInPick ? 100 : 0,
      mode,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setHistory((prev) => [outcome, ...prev].slice(0, 10));

    setTimeout(() => {
      setGameState('idle');
      setCurrentMultiplier(1.00);
      setHasPassedTarget(false);
      hasPassedTargetRef.current = false;
    }, 2800);
  };

  const updateLeaderboard = (profit: number) => {
    if (profit <= 0) return;
    setLeaderboard((prev) => {
      const entryName = localStorage.getItem('user_assigned_nickname') || 'Kamu';
      const isExist = prev.some(item => item.name === entryName && item.score >= profit);
      
      if (isExist) return prev;
      
      const updated = [...prev, { name: entryName, score: profit, date: new Date().toISOString().split('T')[0] }];
      return updated.sort((a, b) => b.score - a.score).slice(0, 10);
    });
  };

  // Calculated game metrics details
  const totalGames = history.length;
  const wonGames = history.filter(h => h.outcome === 'WIN').length;
  const winRate = totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0;
  const lastResult = history[0];

  return (
    <div className="w-full flex flex-col gap-6" id="crash-game-view">
      {/* 10 Last Rounds History Horizontal chip bar */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-4 bg-[#141224]/50 backdrop-blur-md border border-white/5 rounded-xl scrollbar-hide select-none">
        <span className="text-[10px] font-mono tracking-widest text-[#94a3b8] font-bold uppercase shrink-0">HISTORY:</span>
        {history.length === 0 ? (
          <span className="text-[10px] font-sans text-slate-500 italic py-1">Belum ada putaran dilakukan.</span>
        ) : (
          history.map((h) => {
            const isWon = h.outcome === 'WIN';
            return (
              <div 
                key={h.id} 
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono shrink-0 transition-transform hover:scale-105 border ${
                  isWon 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                <span>{h.crashPoint.toFixed(2)}x</span>
                {h.profit !== 0 && (
                  <span className="text-[10px] font-normal opacity-75">
                    ({h.profit > 0 ? '+' : ''}{h.profit})
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CHART AREA / CANVAS (COL-7) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className="w-full relative bg-[#121121]/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-2 select-none"
          >
            {/* Countdown Screen Overlay */}
            {gameState === 'countdown' && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center z-20 text-center animate-fade-in">
                <p className="text-slate-400 text-xs tracking-wider uppercase font-bold mb-2">RAN DEWAKRASH DIMULAI DALAM</p>
                <div className="text-7xl font-sans font-extrabold text-[#7c5cfc] tracking-tighter scale-110 drop-shadow-[0_0_30px_rgba(124,92,252,0.5)] animate-bounce select-none">
                  {countdownNum}
                </div>
              </div>
            )}

            {/* Custom Multiplier value indicator layered */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 pointer-events-none mb-6">
              {gameState === 'playing' && (
                <>
                  {mode === 'pick' && currentMultiplier >= parseFloat(pickMultiplier) ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold tracking-widest text-[#10b981] uppercase font-mono bg-emerald-950/40 border border-[#10b981]/20 px-2.5 py-0.5 rounded-full select-none animate-bounce">
                        YOU WIN
                      </span>
                      <span className="text-6xl md:text-7xl font-sans font-extrabold tracking-tighter text-[#10b981] drop-shadow-[0_0_20px_rgba(16,185,129,0.55)] select-none">
                        {currentMultiplier.toFixed(2)}x
                      </span>
                    </div>
                  ) : (
                    <span className={`text-6xl md:text-7xl font-sans font-extrabold tracking-tighter select-none ${
                      currentMultiplier >= 5.0 ? 'text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]' : 'text-slate-100'
                    }`}>
                      {currentMultiplier.toFixed(2)}x
                    </span>
                  )}
                </>
              )}
              {gameState === 'crashed' && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold tracking-widest text-red-500 uppercase font-mono bg-red-950/40 border border-red-500/20 px-2.5 py-0.5 rounded-full select-none">
                    YOU LOSE
                  </span>
                  <span className="text-6xl md:text-7xl font-sans font-extrabold tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.55)] select-none">
                    {finalMultValueRef.current.toFixed(2)}x
                  </span>
                </div>
              )}
              {gameState === 'win' && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase font-mono bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-0.5 rounded-full select-none text-[#10b981]">
                    YOU WIN
                  </span>
                  <span className="text-6xl md:text-7xl font-sans font-extrabold tracking-tighter text-[#10b981] drop-shadow-[0_0_20px_rgba(16,185,129,0.55)] select-none">
                    {finalMultValueRef.current.toFixed(2)}x
                  </span>
                </div>
              )}
              {gameState === 'idle' && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">READY UNTUK PUTARAN BARU</span>
                  <span className="text-5xl font-sans font-extrabold text-slate-600/60 select-none">
                    1.00x
                  </span>
                </div>
              )}
            </div>

            {/* Absolute visual tags badge (top left) */}
            <div className="absolute top-4 left-4 z-10">
              {gameState === 'playing' ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-purple-600 border border-purple-400/40 text-white animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  IN PROGRESS
                </span>
              ) : gameState === 'crashed' ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-red-600 border border-red-400/40 text-white">
                  CRASHED!
                </span>
              ) : gameState === 'win' ? (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-emerald-600 border border-emerald-400/40 text-white animate-bounce">
                  WIN! <PngEmoji src="/images/emoji_celebrate.png" alt="🎉" className="w-3 h-3" />
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-[#1a182a] border border-white/5 text-slate-400">
                  WAITING
                </span>
              )}
            </div>

            {/* Quick sound toggle overlay */}
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              className="absolute top-4 right-4 z-10 p-1.5 text-slate-400 hover:text-white bg-black/40 hover:bg-black/60 rounded-lg cursor-pointer transition border border-white/5"
              title={soundEnabled ? "Nonaktifkan Suara" : "Aktifkan Suara"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Actual Curve Rendering Canvas */}
            <canvas 
              ref={canvasRef}
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              className="block w-full"
            />
          </div>
        </div>

        {/* TARGET & CONTROLS PANEL (COL-4) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Main Predict Controller widget */}
          <div className="bg-[#141224]/50 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            
            {/* Header with Title and balance */}
            <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
              <span className="text-xs font-bold text-[#c084fc] font-mono tracking-wider uppercase flex items-center gap-1">
                <PngEmoji src="/images/emoji_target.png" alt="🎯" className="w-3.5 h-3.5" /> TARGET MULTIPLIER
              </span>
              <p className="text-[11px] text-slate-400">Pilih multiplier target Anda. Jika roket terbang melampaui target ini, Anda menang!</p>
            </div>

            {/* Target Multiplier Configuration */}
            <div className="flex flex-col gap-3 bg-[#0d0c15] p-3 border border-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 font-sans">Target Multiplier</span>
                <span className="text-[10px] font-mono font-bold text-amber-500">Pick Mode</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="1.05"
                max="15.0"
                disabled={gameState !== 'idle'}
                value={pickMultiplier}
                onChange={(e) => setPickMultiplier(e.target.value)}
                className="w-full bg-[#161427] border border-white/10 rounded-lg py-2.5 px-3.5 font-mono text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-500/50"
              />

              {/* Preset shortcuts */}
              <div className="grid grid-cols-5 gap-1 select-none">
                {['1.40', '1.60', '2.00', '3.50', '5.00'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={gameState !== 'idle'}
                    onClick={() => setPickMultiplier(val)}
                    className={`py-1.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                      pickMultiplier === val 
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                        : 'bg-[#1b1932]/70 border-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    {val}x
                  </button>
                ))}
              </div>
            </div>

            {/* Core game TRIGGER BUTTON */}
            {gameState === 'idle' ? (
              <button
                onClick={handlePlayGame}
                className="w-full py-3 px-4 bg-[#7c5cfc] hover:bg-[#8d71ff] text-white rounded-xl font-sans font-bold text-sm tracking-wide select-none cursor-pointer border border-[#8d71ff]/40 shadow-[0_0_20px_rgba(124,92,252,0.3)] transition flex items-center justify-center gap-1.5"
              >
                <PngEmoji src="/images/emoji_rocket.png" alt="🚀" className="w-4 h-4" /> MULAI GAME
              </button>
            ) : gameState === 'playing' ? (
              <button
                disabled
                className="w-full py-3 px-4 bg-slate-800 text-slate-400 rounded-xl font-sans font-bold text-sm select-none cursor-not-allowed border border-white/5"
              >
                Menunggu Hasil... ({currentMultiplier.toFixed(2)}x)
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3 px-4 bg-slate-800 text-slate-500 rounded-xl font-sans font-bold text-sm select-none cursor-not-allowed border border-white/5"
              >
                Menyiapkan Arena...
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
