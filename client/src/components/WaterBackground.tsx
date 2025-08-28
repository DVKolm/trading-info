import React, { useEffect, useRef } from 'react';

interface WaterBackgroundProps {
  className?: string;
}

const WaterBackground: React.FC<WaterBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    // Resize canvas to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Water simulation parameters
    const waves = [
      { amplitude: 30, frequency: 0.02, speed: 0.01, phase: 0 },
      { amplitude: 20, frequency: 0.025, speed: 0.015, phase: Math.PI / 3 },
      { amplitude: 15, frequency: 0.03, speed: 0.008, phase: Math.PI / 2 },
      { amplitude: 25, frequency: 0.018, speed: 0.012, phase: Math.PI },
    ];

    const animate = () => {
      time += 0.016; // ~60fps
      
      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create multiple layers of water effects
      for (let layer = 0; layer < 3; layer++) {
        const layerOpacity = 0.1 + (layer * 0.05);
        const layerOffset = layer * 50;

        // Create gradient for this layer
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        
        gradient.addColorStop(0, `rgba(40, 40, 40, ${layerOpacity * 2})`);
        gradient.addColorStop(0.5, `rgba(60, 60, 60, ${layerOpacity})`);
        gradient.addColorStop(1, 'transparent');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = gradient;

        // Create organic wave patterns
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 2) {
          let y = canvas.height / 2 + layerOffset;
          
          // Combine multiple wave functions for organic movement
          waves.forEach(wave => {
            y += Math.sin(x * wave.frequency + time * wave.speed + wave.phase) * wave.amplitude;
          });
          
          // Add some noise for more organic feel
          y += Math.sin(x * 0.01 + time * 0.02) * Math.sin(x * 0.008 + time * 0.025) * 10;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Complete the shape
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Add floating particles/bubbles
        for (let i = 0; i < 15; i++) {
          const particleX = (i * canvas.width / 15 + time * 20 + i * 50) % canvas.width;
          const particleY = canvas.height / 2 + Math.sin(time * 0.01 + i) * 100;
          const size = 2 + Math.sin(time * 0.02 + i) * 2;
          
          const particleOpacity = (0.1 + Math.sin(time * 0.015 + i) * 0.05) * layerOpacity;
          
          ctx.save();
          ctx.globalAlpha = particleOpacity;
          ctx.fillStyle = `rgba(80, 80, 80, ${particleOpacity})`;
          ctx.beginPath();
          ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Add subtle surface reflections
      const reflectionGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      reflectionGradient.addColorStop(0, 'transparent');
      reflectionGradient.addColorStop(0.3, 'rgba(30, 30, 30, 0.05)');
      reflectionGradient.addColorStop(0.7, 'rgba(50, 50, 50, 0.1)');
      reflectionGradient.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = reflectionGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default WaterBackground;