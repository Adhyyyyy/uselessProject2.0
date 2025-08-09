import { useEffect, useRef, useState } from 'react';
import { Engine, Render, World, Bodies, Body, Runner, Events } from 'matter-js';

const GameCanvas = () => {
  const canvasRef = useRef();
  const engineRef = useRef();
  const renderRef = useRef();
  const runnerRef = useRef();
  const basketRef = useRef();
  const fallingObjectRef = useRef();
  const [gameState, setGameState] = useState({
    bounceCount: 0,
    gameActive: true,
    mousePosition: { x: 0, y: 0 }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    // Create engine
    const engine = Engine.create();
    engineRef.current = engine;

    // Create renderer
    const render = Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: width,
        height: height,
        background: '#1a1a2e',
        wireframes: false,
        showAngleIndicator: false,
        showVelocity: false
      }
    });
    renderRef.current = render;

    // Create runner
    const runner = Runner.create();
    runnerRef.current = runner;

    // Add boundaries (invisible walls)
    const ground = Bodies.rectangle(width / 2, height - 10, width, 20, { 
      isStatic: true,
      render: { fillStyle: '#8B5A2B' }
    });
    const leftWall = Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true });
    const rightWall = Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true });
    const ceiling = Bodies.rectangle(width / 2, -10, width, 20, { isStatic: true });

    // Create basket (player-controlled)
    const basket = Bodies.rectangle(width / 2, height - 100, 120, 20, {
      isStatic: true,
      render: {
        fillStyle: '#DAA520',
        strokeStyle: '#B8860B',
        lineWidth: 2
      }
    });
    basketRef.current = basket;

    // Create falling object (ball)
    const createFallingObject = () => {
      const randomX = Math.random() * (width - 100) + 50; // Random X position
      const ball = Bodies.circle(randomX, 50, 25, {
        restitution: 0.8, // Bounciness
        render: {
          fillStyle: '#FF6B6B',
          strokeStyle: '#D63031',
          lineWidth: 2
        }
      });
      fallingObjectRef.current = ball;
      World.add(engine.world, ball);
      return ball;
    };

    // Create initial falling object
    createFallingObject();

    // Collision detection
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        // Check if ball hit basket
        if ((bodyA === basket && bodyB === fallingObjectRef.current) || 
            (bodyB === basket && bodyA === fallingObjectRef.current)) {
          setGameState(prev => ({ 
            ...prev, 
            bounceCount: prev.bounceCount + 1 
          }));
        }
        
        // Check if ball hit ground (game over)
        if ((bodyA === ground && bodyB === fallingObjectRef.current) || 
            (bodyB === ground && bodyA === fallingObjectRef.current)) {
          setGameState(prev => ({ 
            ...prev, 
            gameActive: false 
          }));
        }
      });
    });

    World.add(engine.world, [ground, leftWall, rightWall, ceiling, basket]);

    // Start the engine and renderer
    Runner.run(runner, engine);
    Render.run(render);

    // Add mouse tracking
    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      setGameState(prev => ({
        ...prev,
        mousePosition: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        }
      }));
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      Render.stop(render);
      Runner.stop(runner);
      World.clear(engine.world);
      Engine.clear(engine);
    };
  }, []);

  // Update basket position based on mouse movement with smooth interpolation
  useEffect(() => {
    if (!basketRef.current || !gameState.gameActive) return;

    const basket = basketRef.current;
    const targetX = gameState.mousePosition.x;
    const currentX = basket.position.x;
    
    // Smooth interpolation factor (0.1 = very smooth, 0.5 = responsive)
    const lerpFactor = 0.2;
    const newX = currentX + (targetX - currentX) * lerpFactor;
    
    // Keep basket within canvas bounds (accounting for basket width)
    const basketWidth = 60; // Half width of basket
    const canvas = canvasRef.current;
    const canvasWidth = canvas ? canvas.offsetWidth : 800;
    const clampedX = Math.max(basketWidth, Math.min(canvasWidth - basketWidth, newX));
    
    Body.setPosition(basket, { x: clampedX, y: basket.position.y });
  }, [gameState.mousePosition, gameState.gameActive]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (renderRef.current) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        
        renderRef.current.canvas.width = width;
        renderRef.current.canvas.height = height;
        renderRef.current.options.width = width;
        renderRef.current.options.height = height;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-black p-4">
      {/* Game UI */}
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">The Inevitable Bounce</h1>
        <div className="text-white text-xl">
          Bounces: <span className="text-yellow-400 font-bold">{gameState.bounceCount}</span>
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Mouse Position: ({Math.round(gameState.mousePosition.x)}, {Math.round(gameState.mousePosition.y)})
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative border-4 border-yellow-600 rounded-lg shadow-2xl">
        <canvas
          ref={canvasRef}
          className="block"
          width={800}
          height={600}
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            background: 'linear-gradient(to bottom, #1a1a2e, #16213e)'
          }}
        />
        
        {/* Game Status Overlay */}
        {!gameState.gameActive && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Game Over</h2>
              <p className="text-xl mb-4">Final Score: {gameState.bounceCount}</p>
              <button 
              className="px-6 py-3 bg-yellow-600 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
              onClick={() => {
                // Reset game state
                setGameState(prev => ({ 
                  ...prev, 
                  gameActive: true, 
                  bounceCount: 0 
                }));
                
                // Remove old ball and create new one
                if (fallingObjectRef.current && engineRef.current) {
                  World.remove(engineRef.current.world, fallingObjectRef.current);
                  
                  // Create new ball
                  const canvas = canvasRef.current;
                  const width = canvas ? canvas.offsetWidth : 800;
                  const randomX = Math.random() * (width - 100) + 50;
                  const ball = Bodies.circle(randomX, 50, 25, {
                    restitution: 0.8,
                    render: {
                      fillStyle: '#FF6B6B',
                      strokeStyle: '#D63031',
                      lineWidth: 2
                    }
                  });
                  fallingObjectRef.current = ball;
                  World.add(engineRef.current.world, ball);
                }
              }}
            >
              Play Again
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-gray-400 max-w-md">
        <p className="text-sm">
          Move your mouse to control the basket. Keep the falling objects bouncing as long as possible!
        </p>
      </div>
    </div>
  );
};

export default GameCanvas;
