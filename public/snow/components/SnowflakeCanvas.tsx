
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SnowflakeParams } from '../types';

interface SnowflakeCanvasProps {
  params: SnowflakeParams;
  size?: number;
}

export interface SnowflakeCanvasHandle {
  download: (filename: string) => void;
}

const SnowflakeCanvas = forwardRef<SnowflakeCanvasHandle, SnowflakeCanvasProps>(({ params, size = 600 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);

  useImperativeHandle(ref, () => ({
    download: (filename: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const downloadCanvas = document.createElement('canvas');
      downloadCanvas.width = canvas.width;
      downloadCanvas.height = canvas.height;
      const dctx = downloadCanvas.getContext('2d');
      if (!dctx) return;

      // Background
      dctx.fillStyle = '#000000';
      dctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
      
      // Draw the snowflake
      dctx.drawImage(canvas, 0, 0);

      // Add branding "LiboLibo"
      const fontSize = Math.round(downloadCanvas.width * 0.025);
      dctx.font = `bold ${fontSize}px sans-serif`;
      dctx.textAlign = 'center';
      dctx.textBaseline = 'bottom';
      
      const brandText = "LiboLibo";
      const x = downloadCanvas.width / 2;
      const y = downloadCanvas.height - (downloadCanvas.height * 0.06);
      
      // Shadow for text depth
      dctx.shadowBlur = 0;
      dctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      dctx.fillText(brandText, x, y);
      
      // Signature Red Dot
      const textWidth = dctx.measureText(brandText).width;
      dctx.fillStyle = '#ef4444';
      dctx.beginPath();
      // Position dot at the end of the text
      dctx.arc(x + (textWidth / 2) + (fontSize * 0.4), y - (fontSize * 0.35), fontSize * 0.15, 0, Math.PI * 2);
      dctx.fill();

      // Download trigger
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = downloadCanvas.toDataURL('image/png');
      link.click();
    }
  }));

  const drawSnowflake = (ctx: CanvasRenderingContext2D, width: number, height: number, pulse: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);

    // Модифицируем параметры для эффекта распушивания
    // pulse идет от 0 до 1
    const animatedBranchLength = params.branchLength * (1 + pulse * 0.15);
    const animatedSubBranchLength = params.subBranchLength * (1 + pulse * 0.25);
    const animatedSubBranchAngle = params.subBranchAngle + (pulse * 5);

    const {
      subBranchDensity,
      lineWidth,
      glowSize,
      color
    } = params;

    const drawNode = (x: number, y: number, r: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    };

    const drawBranch = (len: number, depth: number) => {
      if (depth < 0) return;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -len);
      ctx.stroke();

      if (depth === 0) {
        drawNode(0, -len, lineWidth * (1 + pulse * 0.5));
      }

      const density = depth === 2 ? subBranchDensity : 2;
      for (let i = 1; i <= density; i++) {
        const fraction = i / (density + 1);
        const y = -len * fraction;
        const sLen = animatedSubBranchLength * (1 - fraction * 0.5) * (depth / 2);

        const drawSub = (angle: number) => {
          ctx.save();
          ctx.translate(0, y);
          ctx.rotate(angle * Math.PI / 180);
          drawBranch(sLen, depth - 1);
          ctx.restore();
        };

        drawSub(animatedSubBranchAngle);
        drawSub(-animatedSubBranchAngle);
      }
    };

    const drawOrbits = () => {
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.globalAlpha = 0.2 + (pulse * 0.1);
      for (let r = 0; r <= 1.0; r += 0.3) {
        ctx.beginPath();
        const radius = animatedBranchLength * r;
        for (let i = 0; i <= 6; i++) {
          const angle = (i * 60) * Math.PI / 180;
          const x = Math.cos(angle - Math.PI / 2) * radius;
          const y = Math.sin(angle - Math.PI / 2) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    };

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.shadowBlur = glowSize * (1 + pulse * 0.3);
    ctx.shadowColor = color.includes('239, 68, 68') ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.4)';

    drawOrbits();

    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * 60) * Math.PI / 180);
      drawBranch(animatedBranchLength, 2);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, lineWidth * (3 + pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const animate = (time: number) => {
      // Период 5 секунд (5000 мс)
      // Math.sin дает от -1 до 1, мы переводим в 0..1
      const period = 5000;
      const phase = (time % period) / period;
      const pulse = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      drawSnowflake(ctx, size, size, pulse);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [params, size]);

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-red-600/5 blur-[100px] rounded-full pointer-events-none transition-all duration-1000 group-hover:bg-red-600/15" />
      <div className="absolute inset-0 bg-white/5 blur-[150px] rounded-full pointer-events-none" />
      <canvas 
        ref={canvasRef} 
        className="relative z-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-700 ease-out hover:scale-105 active:scale-95 cursor-crosshair"
      />
    </div>
  );
});

export default SnowflakeCanvas;
