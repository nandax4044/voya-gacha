/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Prize } from '../types';
import { SoundEffects } from './SoundEffects';

interface PrizeWheelProps {
  prizes: Prize[];
  isSpinning: boolean;
  speed: 'slow' | 'normal' | 'fast' | 'turbo';
  duration: number;
  onSpinComplete: (prize: Prize) => void;
  onSpinStart: () => void;
}

export function PrizeWheel({
  prizes,
  isSpinning,
  speed,
  duration,
  onSpinComplete,
  onSpinStart,
}: PrizeWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core spinning physics state
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  const [pointerOffset, setPointerOffset] = useState(0);
  const pointerOffsetRef = useRef(0);
  const velocityRef = useRef(0);

  // Pre-load and cache image assets
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Vibration ticks tracker
  const lastPegIndex = useRef(-1);

  // Prevent consecutive repeats tracker (by ID)
  const lastWinningIdRef = useRef<string | null>(null);

  // Spin values mapping
  const getSpinSpeeds = () => {
    switch (speed) {
      case 'slow': return 4;
      case 'normal': return 7;
      case 'fast': return 11;
      case 'turbo': return 16;
    }
  };

  // Load image helper
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      if (imageCacheRef.current.has(src)) {
        const img = imageCacheRef.current.get(src)!;
        if (img.complete) {
          resolve(img);
          return;
        }
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      img.onload = () => {
        imageCacheRef.current.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        // Fallback for failed image
        resolve(img);
      };
    });
  };

  // Force loading images whenever prizes array changes
  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      const promises = prizes.map((p) => loadImage(p.image));
      await Promise.all(promises);
      if (active) {
        setImagesLoaded((prev) => !prev); // force render update
      }
    };
    loadAll();
    return () => {
      active = false;
    };
  }, [prizes]);

  // Handle Resize of the canvas beautifully using ResizeObserver
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Keep it square based on container width or max height
      const targetSize = Math.max(280, Math.min(width, 550));
      setDimensions({ width: targetSize, height: targetSize });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Spin Controller using Analytical Ease-Out
  const spinStartTime = useRef(0);
  const spinStartAngle = useRef(0);
  const spinTotalRotation = useRef(0);
  const requestFrameId = useRef<number | null>(null);

  // Start spinning function
  const triggerSpin = () => {
    if (requestFrameId.current !== null || prizes.length < 2) return;

    onSpinStart();

    // SoundEffects will be warmed up on first trigger
    SoundEffects.playTick();

    const minTurns = getSpinSpeeds();
    const durationMs = duration * 1000;
    
    // Pick winning slice randomly by angle index, ensuring no consecutive duplicate if possible
    const numSegments = prizes.length;
    let targetSliceIndex = Math.floor(Math.random() * numSegments);

    if (numSegments >= 3 && lastWinningIdRef.current !== null) {
      let attempts = 0;
      while (prizes[targetSliceIndex]?.id === lastWinningIdRef.current && attempts < 15) {
        targetSliceIndex = Math.floor(Math.random() * numSegments);
        attempts++;
      }
    }
    lastWinningIdRef.current = prizes[targetSliceIndex]?.id || null;

    const segmentRad = (2 * Math.PI) / numSegments;

    // We want the wheel pointer (at 0 radians - aligned to Far Right pointer)
    // To land exactly in the center of the random target slice.
    // Positional equation: Winning Slice Angle under pointer at end of spin.
    // If Pointer is at angle 0 (right):
    // The target slice center angle originally resides at:
    const targetSliceCenter = (targetSliceIndex + 0.5) * segmentRad;
    
    // To make targetSliceCenter align exactly at the pointer (0 rad),
    // we need final wheel rotation angle to be:
    // finalAngle = -targetSliceCenter (mod 2pi) + some random jitter within the slice padding.
    const padding = segmentRad * 0.35; // 35% margin from borders to prevent ending on boundary
    const jitter = -padding + Math.random() * (padding * 2);
    
    // Modulo math matches Pointer.
    // To align at 0 (Right), center is: (2 * Math.PI) - targetSliceCenter
    // If pointer is at Top (3*PI/2), we subtract 1.5*PI from final design. Let's make Pointer reside at RIGHT (0 rad, pointing left), which is cleanest.
    const finalWheelAngle = (2 * Math.PI) - targetSliceCenter + jitter;

    spinStartTime.current = performance.now();
    spinStartAngle.current = angleRef.current % (2 * Math.PI);
    
    // Add extra clean turns
    spinTotalRotation.current = (2 * Math.PI * minTurns) + (finalWheelAngle - spinStartAngle.current);

    const animateSpin = (now: number) => {
      const elapsed = now - spinStartTime.current;
      const progress = Math.min(elapsed / durationMs, 1);

      // Quintic Ease-Out: 1 - (1 - x)^5 provides extremely premium long deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 5);
      const currentRotation = spinStartAngle.current + spinTotalRotation.current * easeProgress;
      
      angleRef.current = currentRotation;
      setAngle(currentRotation);

      // Decelerating pointer spring dynamics
      pointerOffsetRef.current = pointerOffsetRef.current * 0.85; // Natural continuous decay feedback

      // Velocity is derivative of (1-(1-x)^5)*R: equals 5*(1-x)^4 * R / duration
      const velocity = (5 * Math.pow(1 - progress, 4) * spinTotalRotation.current) / durationMs; // radians per ms
      velocityRef.current = velocity;

      // Ticking calculations
      const currentSegmentRad = (2 * Math.PI) / prizes.length;
      const roundedProgress = Math.floor(currentRotation / currentSegmentRad);
      if (roundedProgress !== lastPegIndex.current) {
        lastPegIndex.current = roundedProgress;
        SoundEffects.playTick();
        
        // Push pointer up relative to speed!
        const hitEnergy = Math.min(velocity * 12, 1); // Clamp limit
        pointerOffsetRef.current = -25 * hitEnergy;
      }

      setPointerOffset(pointerOffsetRef.current);

      if (progress < 1) {
        requestFrameId.current = requestAnimationFrame(animateSpin);
      } else {
        // Spin finished!
        requestFrameId.current = null;
        pointerOffsetRef.current = 0;
        setPointerOffset(0);
        velocityRef.current = 0;

        const winningAngle = currentRotation % (2 * Math.PI);
        
        // Identify champion segment mathematically relative to Pointer at 0 rad
        // relative point = (0 - winningAngle) mod 2PI
        let relativePoint = -winningAngle % (2 * Math.PI);
        if (relativePoint < 0) relativePoint += 2 * Math.PI;

        const winIdx = Math.floor(relativePoint / currentSegmentRad);
        const actualWinner = prizes[winIdx % prizes.length];

        SoundEffects.playFanfare();
        onSpinComplete(actualWinner);
      }
    };

    requestFrameId.current = requestAnimationFrame(animateSpin);
  };

  useEffect(() => {
    if (isSpinning && requestFrameId.current === null) {
      triggerSpin();
    }
    return () => {
      if (requestFrameId.current !== null) {
        cancelAnimationFrame(requestFrameId.current);
        requestFrameId.current = null;
      }
    };
  }, [isSpinning]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support High DPI devices beautifully
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const radius = (dimensions.width / 2) - 34; // cushion for outer audio visualizer bars

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const numSegments = prizes.length;
    if (numSegments === 0) return;

    const segmentRad = (2 * Math.PI) / numSegments;

    // Draw reactive radial audio visualizer bars (grows, thickens and speeds up frequency with velocity)
    const currentVelocity = velocityRef.current || 0;
    const isActiveVal = currentVelocity > 0.001 || isSpinning;
    const baseVal = isActiveVal ? currentVelocity : 0.0015;
    const ambientMultiplier = !isSpinning ? (0.4 + 0.3 * Math.sin(performance.now() * 0.002)) : 1.0;
    
    const barCount = 72;
    const baseHeight = isSpinning ? (baseVal * 280) : (5 * ambientMultiplier);
    
    for (let j = 0; j < barCount; j++) {
      const barAngle = (j * 2 * Math.PI) / barCount + angle * 0.15;
      
      const freqFactor = 1.2 + Math.sin(j * 0.25) * 0.5;
      const speedFactor = isSpinning ? (0.015 + baseVal * 0.14) : 0.0015;
      const wave = Math.sin(j * 0.5 + performance.now() * speedFactor * freqFactor) * 0.4 
                 + Math.cos(j * 1.1 - performance.now() * speedFactor * 0.8) * 0.3;
                 
      const peakGroup = Math.sin((j / barCount) * Math.PI * 4);
      const heightNoise = Math.abs(wave * (isSpinning ? peakGroup : 1.0));
      const barHeight = Math.max(1.5, baseHeight * (0.35 + 0.65 * heightNoise));
      
      const startR = radius + 8;
      const endR = startR + barHeight;
      
      const startX = cx + Math.cos(barAngle) * startR;
      const startY = cy + Math.sin(barAngle) * startR;
      const endX = cx + Math.cos(barAngle) * endR;
      const endY = cy + Math.sin(barAngle) * endR;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      
      let strokeColor = 'rgba(139, 53, 188, 0.45)';
      if (isSpinning) {
        if (baseVal > 0.07) {
          // High intensity cyan-white highlight
          strokeColor = `hsla(${180 + Math.sin(j * 0.05) * 40}, 100%, 75%, ${0.6 + 0.4 * (barHeight / 30)})`;
        } else if (baseVal > 0.03) {
          // Sizzling magenta-pink neon
          strokeColor = `hsla(${290 + Math.sin(j * 0.05) * 30}, 100%, 68%, ${0.5 + 0.5 * (barHeight / 22)})`;
        } else {
          // Warm glowing violet
          strokeColor = `hsla(${275}, 90%, 62%, ${0.4 + 0.4 * (barHeight / 15)})`;
        }
      } else {
        strokeColor = `rgba(139, 83, 218, ${0.12 + 0.15 * ambientMultiplier})`;
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSpinning ? (2.0 + baseVal * 10) : 1.5;
      ctx.lineCap = 'round';
      
      if (isSpinning && baseVal > 0.03) {
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = Math.min(12, baseVal * 150);
      }
      
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }

    // 1. Draw outermost background shiny border ring
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1D1A2E';
    ctx.fill();
    ctx.shadowColor = 'transparent'; // Reset shadows

    // 2. Draw Wedges
    for (let i = 0; i < numSegments; i++) {
      const prize = prizes[i];
      const startAngle = i * segmentRad + angle;
      const endAngle = (i + 1) * segmentRad + angle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Flat solid wedge fill
      ctx.fillStyle = prize.color;
      ctx.fill();

      // Divider stroke
      ctx.strokeStyle = '#0F0F1A';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Glass shine highlight overlay
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.clip();

      const gradient = ctx.createLinearGradient(cx, cy, cx + radius, cy);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw Images / Placeholders safely
    const imgSize = radius * 0.38; // Slightly larger scaled image relative to wedge size now that circle background is gone!

    for (let i = 0; i < numSegments; i++) {
      const prize = prizes[i];
      const startAngle = i * segmentRad + angle;
      const endAngle = (i + 1) * segmentRad + angle;
      const bisectorAngle = startAngle + segmentRad / 2;

      // Position along bisector radius
      const imgRadius = radius * 0.58; 
      const imgX = cx + Math.cos(bisectorAngle) * imgRadius;
      const imgY = cy + Math.sin(bisectorAngle) * imgRadius;

      ctx.save();
      ctx.translate(imgX, imgY);
      
      // Rotate perpendicular to outer rim (stands perfectly outward)
      ctx.rotate(bisectorAngle + Math.PI / 2);

      const cachedImg = imageCacheRef.current.get(prize.image);

      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth !== 0) {
        // Draw real base64 dynamic image directly - NO background circles, NO circular clipping masks!
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 8;
        ctx.drawImage(cachedImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        ctx.shadowColor = 'transparent';
      } else {
        // High fidelity elegant typography fallback - draw solid backup backing
        ctx.fillStyle = prize.color;
        ctx.beginPath();
        ctx.arc(0, 0, imgSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Fredoka';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Take initials
        const initial = prize.name.trim().substring(0, 2).toUpperCase();
        ctx.fillText(initial, 0, 0);
      }

      ctx.restore();
    }

    // 4. Center hub / golden spinner axis button
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#1D1A2E';
    ctx.fill();

    // Outlined shiny gold/neon ring
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFE000';
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    // Central core cap pulses dynamically with speed
    const pulseFactor = 1 + (velocityRef.current || 0) * 1.5 * Math.sin(performance.now() * 0.05);
    const gradRadius = Math.max(12, 22 * pulseFactor);
    const goldGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, gradRadius);
    goldGrad.addColorStop(0, '#FFFFFF');
    goldGrad.addColorStop(0.3, '#FFD93D');
    goldGrad.addColorStop(1, '#FF9A3C');
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(10, 20 * pulseFactor), 0, Math.PI * 2);
    ctx.fillStyle = goldGrad;
    ctx.fill();

    // 5. Blinking carnival lightbulbs along the rim outer ring!
    const lightbulbCount = 24;
    const isLitAlternate = Math.floor(Date.now() / 250) % 2 === 0;

    for (let k = 0; k < lightbulbCount; k++) {
      const theta = (k * 2 * Math.PI) / lightbulbCount;
      const bulbX = cx + Math.cos(theta) * (radius + 4);
      const bulbY = cy + Math.sin(theta) * (radius + 4);

      ctx.beginPath();
      ctx.arc(bulbX, bulbY, 3.5, 0, Math.PI * 2);

      const isLitGroup = k % 2 === 0;
      const lit = isLitAlternate ? isLitGroup : !isLitGroup;

      if (isSpinning) {
        // High frequency cycle swap that accelerates and decelerates with physical velocity
        const divisor = Math.max(15, 120 - (velocityRef.current || 0) * 800);
        const spinningLit = Math.floor(performance.now() / divisor) % 3 === k % 3;
        ctx.fillStyle = spinningLit ? '#FFF' : '#FFD93D';
        ctx.shadowColor = spinningLit ? '#FFF' : 'transparent';
        ctx.shadowBlur = spinningLit ? 8 : 0;
      } else {
        ctx.fillStyle = lit ? '#FFD93D' : '#6A6487';
        ctx.shadowColor = lit ? '#FFD93D' : 'transparent';
        ctx.shadowBlur = lit ? 6 : 0;
      }
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';

  }, [angle, prizes, dimensions, isSpinning, imagesLoaded]);

  // Dynamic ticking of carnival lights in inactive state to make page feel live
  useEffect(() => {
    let active = true;
    const ticker = () => {
      if (!isSpinning && active) {
        setAngle((prev) => prev); // trigger tiny canvas re-render for lights pulsing
        setTimeout(ticker, 250);
      }
    };
    ticker();
    return () => {
      active = false;
    };
  }, [isSpinning]);

  return (
    <div
      id="wheel-container"
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full max-w-full aspect-square"
    >
      {/* 1. HTML5 Spinning Canvas */}
      <canvas
        id="prize-wheel-canvas"
        ref={canvasRef}
        style={{ width: dimensions.width, height: dimensions.height }}
        className="block touch-none select-none select-none relative z-10"
      />

      {/* 2. Absolute overlay for physical peg boundary clickable Pointer/Needle */}
      <div
        id="wheel-pointer"
        style={{
          transform: `translateY(-50%) rotate(${pointerOffset}deg)`,
        }}
        className="absolute right-1 md:right-3 top-1/2 z-20 pointer-events-none select-none origin-right drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 50 30"
          width="42"
          height="28"
          className="fill-current text-[#FFE000] rotate-180 drop-shadow-[0_0_8px_rgba(255,224,0,0.6)]"
        >
          <path d="M 0 15 L 40 0 L 50 15 L 40 30 Z" />
          <circle cx="42" cy="15" r="4" fill="#FF4B2B" />
        </svg>
      </div>

      {/* 3. Outer glowing futuristic ring reflection */}
      <div
        id="glowing-rim"
        style={{
          width: dimensions.width + 16,
          height: dimensions.height + 16,
          boxShadow: isSpinning 
            ? `inset 0 0 ${40 + (velocityRef.current || 0) * 100}px rgba(168, 85, 247, ${Math.min(0.8, 0.15 + (velocityRef.current || 0) * 3.5)}), 0 0 ${15 + (velocityRef.current || 0) * 200}px rgba(168, 85, 247, ${Math.min(0.7, 0.1 + (velocityRef.current || 0) * 3.0)})`
            : undefined,
          borderColor: isSpinning 
            ? `rgba(253, 224, 71, ${Math.min(0.6, 0.15 + (velocityRef.current || 0) * 2.5)})` 
            : undefined,
        }}
        className={`absolute rounded-full border border-yellow-300/20 pointer-events-none z-0 bg-radial from-transparent via-transparent to-purple-900/10 shadow-[inset_0_0_40px_rgba(147,51,234,0.15)] transition-all duration-75 ${isSpinning ? '' : 'animate-pulse'}`}
      />
    </div>
  );
}
