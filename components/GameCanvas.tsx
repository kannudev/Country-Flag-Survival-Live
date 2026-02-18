import React, { useEffect, useRef, useState } from 'react';
import { COUNTRIES, PHYSICS_CONFIG } from '../constants';
import { GameState, Country } from '../types';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  gameState: GameState;
  onGameStateChange: (state: GameState) => void;
  setWinner: (country: Country | null) => void;
  setRemainingCount: (count: number) => void;
  onReady: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  onGameStateChange,
  setWinner,
  setRemainingCount,
  onReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs to store engine instance to avoid closures issues in loop
  const engineRef = useRef<any>(null);
  const runnerRef = useRef<any>(null);
  const renderLoopRef = useRef<number>(0);
  const flagsRef = useRef<Map<number, Country>>(new Map());
  const ringBodyRef = useRef<any>(null);
  
  // Confetti particles
  const particlesRef = useRef<Array<{x: number, y: number, vx: number, vy: number, color: string, life: number}>>([]);

  useEffect(() => {
    // Initial Setup
    const Matter = window.Matter;
    if (!Matter) {
      console.error("Matter.js not loaded");
      return;
    }

    const { Engine, Runner, Render, World, Bodies, Composite, Events, Body, Vector } = Matter;

    // Create engine
    const engine = Engine.create();
    engine.gravity.y = 1; // Standard gravity
    engineRef.current = engine;

    // Create runner
    const runner = Runner.create();
    runnerRef.current = runner;

    // Handle Resize
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      
      // If we were to implement responsive ring resizing, we'd do it here,
      // but restarting the game is usually safer for physics stability.
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size

    // Collision Events for Sound
    Events.on(engine, 'collisionStart', (event: any) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // Only play sound for significant collisions between flags or flag-wall
            // We use speed as a proxy for impact force
            const speed = Math.max(bodyA.speed, bodyB.speed);
            if (speed > 5) {
                audioService.playBoing(speed);
            }
        }
    });

    // Game Loop (Update Logic)
    Events.on(engine, 'beforeUpdate', () => {
        if (!ringBodyRef.current) return;
        
        // Rotate the ring
        Composite.rotate(ringBodyRef.current, PHYSICS_CONFIG.RING_ROTATION_SPEED, {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        });
    });

    // Custom Render Loop
    const render = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Clear canvas
        ctx.fillStyle = '#0f172a'; // Background color matching Tailwind slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Stars (Background)
        // (Simplified for performance: static random noise could be pre-rendered)
        ctx.fillStyle = '#ffffff';
        for(let i=0; i<50; i++) {
             // Use a pseudo-random based on index to keep stars in same place without state
             const x = (Math.sin(i * 123) * 0.5 + 0.5) * canvas.width;
             const y = (Math.cos(i * 456) * 0.5 + 0.5) * canvas.height;
             ctx.fillRect(x, y, 1.5, 1.5);
        }

        // Draw Physics Bodies
        const bodies = Composite.allBodies(engine.world);
        
        ctx.lineWidth = 1;

        bodies.forEach((body: any) => {
            if (body.render.visible === false) return;

            ctx.beginPath();
            
            // Vertices for shapes
            const vertices = body.vertices;
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let j = 1; j < vertices.length; j += 1) {
                ctx.lineTo(vertices[j].x, vertices[j].y);
            }
            ctx.lineTo(vertices[0].x, vertices[0].y);

            // Ring Segments
            if (body.label === 'Wall') {
                 ctx.fillStyle = '#475569';
                 ctx.strokeStyle = '#94a3b8';
                 ctx.fill();
                 ctx.stroke();
            } 
            // Flags
            else if (body.label === 'Flag') {
                const country = flagsRef.current.get(body.id);
                
                ctx.save();
                ctx.translate(body.position.x, body.position.y);
                ctx.rotate(body.angle);

                // Draw Circle Background
                ctx.beginPath();
                ctx.arc(0, 0, PHYSICS_CONFIG.FLAG_RADIUS, 0, 2 * Math.PI);
                ctx.fillStyle = country ? country.color : '#fff';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw Emoji
                if (country) {
                    ctx.font = `${PHYSICS_CONFIG.FLAG_RADIUS * 1.4}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#fff';
                    // Check if emoji is supported or fallback to code
                    ctx.fillText(country.emoji, 0, 1); // slight offset for visual center
                }

                ctx.restore();
            }
        });

        // Check for eliminations (Outside of bounds)
        // We do this in render loop or a separate interval to keep physics loop clean, 
        // though typically safest in 'afterUpdate'. Doing here for simplicity of access to React refs.
        const allBodies = Composite.allBodies(engine.world);
        const activeFlags = allBodies.filter((b: any) => b.label === 'Flag');
        
        // Report remaining count
        if (gameState === GameState.PLAYING) {
            setRemainingCount(activeFlags.length);
        }

        activeFlags.forEach((body: any) => {
            const isOut = 
                body.position.y > canvas.height + 100 || 
                body.position.x < -100 || 
                body.position.x > canvas.width + 100;
            
            if (isOut) {
                World.remove(engine.world, body);
                flagsRef.current.delete(body.id);
                audioService.playElimination();

                if (activeFlags.length - 1 === 1) {
                   // One left!
                   const winnerBody = activeFlags.find((b: any) => b.id !== body.id);
                   if (winnerBody) {
                       const winner = flagsRef.current.get(winnerBody.id);
                       if (winner) handleWin(winner);
                   }
                }
            }
        });

        // Render Confetti if won
        if (particlesRef.current.length > 0) {
            particlesRef.current.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1; // gravity
                p.life -= 0.01;
                
                ctx.globalAlpha = Math.max(p.life, 0);
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 5, 5);
                ctx.globalAlpha = 1.0;

                if (p.life <= 0) {
                    particlesRef.current.splice(i, 1);
                }
            });
        }

        renderLoopRef.current = requestAnimationFrame(render);
    };

    renderLoopRef.current = requestAnimationFrame(render);
    onReady();

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(renderLoopRef.current);
        Runner.stop(runner);
        Engine.clear(engine);
    };
  }, []); // Only run once on mount

  // Watch for GameState changes to trigger Start/Restart logic
  useEffect(() => {
    if (gameState === GameState.PLAYING && engineRef.current) {
        startGame();
    }
  }, [gameState]);

  const createRing = (x: number, y: number, radius: number) => {
      const Matter = window.Matter;
      const { Bodies, Composite, Body } = Matter;
      
      const segments = [];
      const segmentCount = 40;
      const segmentWidth = (radius * 2 * Math.PI) / segmentCount;
      const segmentHeight = PHYSICS_CONFIG.WALL_THICKNESS;

      // Calculate gap indices
      // Gap at bottom (90 degrees / PI/2)
      // Total circle is 2PI. 
      // We want a gap of roughly 60 degrees.
      // 60 deg is approx 1/6 of circle.
      const gapAngleStart = Math.PI / 2 - (PHYSICS_CONFIG.GAP_SIZE_DEGREES * Math.PI / 180) / 2;
      const gapAngleEnd = Math.PI / 2 + (PHYSICS_CONFIG.GAP_SIZE_DEGREES * Math.PI / 180) / 2;

      for (let i = 0; i < segmentCount; i++) {
          const angle = (i / segmentCount) * 2 * Math.PI;
          
          // Skip if within gap angle (normalized 0 to 2PI handling needed ideally, but simple check works for bottom gap)
          // Normalizing angle to be 0 at right, PI/2 at bottom.
          // Let's simpler approach: Check if angle is within the "bottom" sector.
          
          let shouldSkip = false;
          if (angle > gapAngleStart && angle < gapAngleEnd) shouldSkip = true;

          if (!shouldSkip) {
            const sx = x + Math.cos(angle) * radius;
            const sy = y + Math.sin(angle) * radius;
            
            const segment = Bodies.rectangle(sx, sy, segmentWidth * 1.05, segmentHeight, {
                isStatic: true,
                angle: angle + Math.PI / 2, // Perpendicular to radius
                label: 'Wall',
                friction: 0.5,
                restitution: 0.2,
                render: { fillStyle: '#ffffff' }
            });
            segments.push(segment);
          }
      }

      const ringComposite = Composite.create({
          bodies: segments
      });
      return ringComposite;
  };

  const startGame = () => {
      const Matter = window.Matter;
      const { World, Bodies, Composite, Runner } = Matter;
      const engine = engineRef.current;
      const runner = runnerRef.current;

      // Reset World
      World.clear(engine.world, false); // Keep engine, clear bodies
      flagsRef.current.clear();
      particlesRef.current = [];
      setWinner(null);

      // Dimensions
      const width = window.innerWidth;
      const height = window.innerHeight;
      const minDim = Math.min(width, height);
      const ringRadius = minDim * PHYSICS_CONFIG.RING_RADIUS_FACTOR;

      // Create Ring
      const ring = createRing(width / 2, height / 2, ringRadius);
      ringBodyRef.current = ring;
      World.add(engine.world, ring);

      // Create Flags
      const flagBodies: any[] = [];
      
      // Shuffle countries
      const shuffledCountries = [...COUNTRIES].sort(() => 0.5 - Math.random());
      
      shuffledCountries.forEach((country, index) => {
           // Spawn in a cluster in the center
           const offsetX = (Math.random() - 0.5) * ringRadius * 0.5;
           const offsetY = (Math.random() - 0.5) * ringRadius * 0.5;
           
           const body = Bodies.circle(
               (width / 2) + offsetX, 
               (height / 2) + offsetY, 
               PHYSICS_CONFIG.FLAG_RADIUS, 
               {
                   restitution: 0.9, // Very Bouncy
                   friction: 0.005,  // Low friction (slippery)
                   frictionAir: 0.001,
                   density: 0.002,
                   label: 'Flag',
               }
           );
           
           flagsRef.current.set(body.id, country);
           flagBodies.push(body);
      });

      World.add(engine.world, flagBodies);
      
      setRemainingCount(flagBodies.length);
      
      // Start Physics Runner
      Runner.run(runner, engine);
  };

  const handleWin = (country: Country) => {
      onGameStateChange(GameState.GAME_OVER);
      setWinner(country);
      audioService.playWin();

      // Spawn confetti
      for (let i = 0; i < 200; i++) {
          particlesRef.current.push({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              color: `hsl(${Math.random() * 360}, 100%, 50%)`,
              life: 2.0 + Math.random()
          });
      }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default GameCanvas;