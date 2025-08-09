import { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { CharacterStateMachine } from './CharacterStateMachine.js';
import { PhysicsController } from './PhysicsController.js';
import AnimationController from './AnimationController.js';

const GameCanvas = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const stateMachineRef = useRef(null);
  const physicsControllerRef = useRef(null);
  const [gameState, setGameState] = useState('intro'); // 'intro' or 'playing'
  const [bounceCount, setBounceCount] = useState(0);
  const [isGrounded, setIsGrounded] = useState(false);
  const [characterState, setCharacterState] = useState('falling'); // 'falling', 'bouncing', 'settled', 'standing', 'walking', 'climbing'
  const [dialogue, setDialogue] = useState('');

  const startGame = () => {
    setGameState('playing');
  };

  const goBackToIntro = () => {
    setGameState('intro');
  };

  useEffect(() => {
    // Only initialize game when in playing state
    if (gameState !== 'playing') return;
    
    // Get canvas element
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size explicitly
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    
    console.log('Canvas created:', canvas.width, 'x', canvas.height);

    // Create Matter.js engine with realistic physics
    const engine = Matter.Engine.create();
    engine.world.gravity.y = 1.2; // More realistic gravity
    engine.world.gravity.scale = 0.001;
    
    // Add air resistance for more realistic falling
    engine.world.frictionAir = 0.01;

    // Create renderer
    const render = Matter.Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false,
        background: 'transparent', // Let CSS gradient show through
        showAngleIndicator: false,
        showVelocity: false,
        showDebug: false
      }
    });

    // Create runner
    const runner = Matter.Runner.create();

    // Store refs
    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;

    // Create ground
    const ground = Matter.Bodies.rectangle(400, 580, 800, 40, { 
      isStatic: true,
      render: {
        fillStyle: '#4A5D23', // Dark green ground
        strokeStyle: '#2D3A16',
        lineWidth: 2
      }
    });

    // Create grass texture on top of ground
    const grassLine = Matter.Bodies.rectangle(400, 560, 800, 2, { 
      isStatic: true,
      render: {
        fillStyle: '#5B7C29' // Bright green grass
      }
    });

    // Create Cute Small Ragdoll Character - Much smaller and cuter proportions
    const characterParts = {};
    
    // Starting position - higher up for longer fall
    const startX = 400;
    const startY = 50;
    
    // Head - bigger relative to body for cuteness
    characterParts.head = Matter.Bodies.circle(startX, startY - 8, 6, {
      restitution: 0.4,
      friction: 0.6,
      density: 0.001,
      frictionAir: 0.02,
      render: { fillStyle: '#FFE4B5' }
    });
    
    // Torso - smaller, more compact
    characterParts.torso = Matter.Bodies.rectangle(startX, startY, 10, 16, {
      restitution: 0.3,
      friction: 0.7,
      density: 0.004,
      frictionAir: 0.015,
      render: { fillStyle: '#4169E1' }
    });
    
    // Upper Arms - much smaller
    characterParts.leftUpperArm = Matter.Bodies.rectangle(startX - 8, startY - 2, 3, 10, {
      restitution: 0.3,
      friction: 0.5,
      density: 0.002,
      frictionAir: 0.03,
      render: { fillStyle: '#FFE4B5' }
    });
    
    characterParts.rightUpperArm = Matter.Bodies.rectangle(startX + 8, startY - 2, 3, 10, {
      restitution: 0.3,
      friction: 0.5,
      density: 0.002,
      frictionAir: 0.03,
      render: { fillStyle: '#FFE4B5' }
    });
    
    // Lower Arms (Forearms) - tiny
    characterParts.leftForearm = Matter.Bodies.rectangle(startX - 8, startY + 6, 2.5, 8, {
      restitution: 0.3,
      friction: 0.4,
      density: 0.0015,
      frictionAir: 0.035,
      render: { fillStyle: '#FFE4B5' }
    });
    
    characterParts.rightForearm = Matter.Bodies.rectangle(startX + 8, startY + 6, 2.5, 8, {
      restitution: 0.3,
      friction: 0.4,
      density: 0.0015,
      frictionAir: 0.035,
      render: { fillStyle: '#FFE4B5' }
    });
    
    // Hands - very small
    characterParts.leftHand = Matter.Bodies.circle(startX - 8, startY + 12, 2, {
      restitution: 0.4,
      friction: 0.8,
      density: 0.001,
      frictionAir: 0.04,
      render: { fillStyle: '#FFE4B5' }
    });
    
    characterParts.rightHand = Matter.Bodies.circle(startX + 8, startY + 12, 2, {
      restitution: 0.4,
      friction: 0.8,
      density: 0.001,
      frictionAir: 0.04,
      render: { fillStyle: '#FFE4B5' }
    });
    
    // Upper Legs (Thighs) - shorter and cuter
    characterParts.leftThigh = Matter.Bodies.rectangle(startX - 3, startY + 14, 4, 12, {
      restitution: 0.2,
      friction: 0.6,
      density: 0.003,
      frictionAir: 0.02,
      render: { fillStyle: '#8B4513' }
    });
    
    characterParts.rightThigh = Matter.Bodies.rectangle(startX + 3, startY + 14, 4, 12, {
      restitution: 0.2,
      friction: 0.6,
      density: 0.003,
      frictionAir: 0.02,
      render: { fillStyle: '#8B4513' }
    });
    
    // Lower Legs (Shins) - small
    characterParts.leftShin = Matter.Bodies.rectangle(startX - 3, startY + 24, 3, 10, {
      restitution: 0.2,
      friction: 0.5,
      density: 0.002,
      frictionAir: 0.025,
      render: { fillStyle: '#8B4513' }
    });
    
    characterParts.rightShin = Matter.Bodies.rectangle(startX + 3, startY + 24, 3, 10, {
      restitution: 0.2,
      friction: 0.5,
      density: 0.002,
      frictionAir: 0.025,
      render: { fillStyle: '#8B4513' }
    });
    
    // Feet - small and rounded
    characterParts.leftFoot = Matter.Bodies.rectangle(startX - 3, startY + 31, 6, 3, {
      restitution: 0.1,
      friction: 0.9,
      density: 0.0015,
      frictionAir: 0.03,
      render: { fillStyle: '#000000' }
    });
    
    characterParts.rightFoot = Matter.Bodies.rectangle(startX + 3, startY + 31, 6, 3, {
      restitution: 0.1,
      friction: 0.9,
      density: 0.0015,
      frictionAir: 0.03,
      render: { fillStyle: '#000000' }
    });

    // Create Joint Constraints for Small Cute Ragdoll - More stable and realistic
    const constraints = [];
    
    // Neck (Head to Torso) - stronger for stability
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.head,
      bodyB: characterParts.torso,
      pointA: { x: 0, y: 4 },
      pointB: { x: 0, y: -6 },
      stiffness: 0.9,
      damping: 0.2,
      length: 1
    }));
    
    // Left Shoulder (Torso to Left Upper Arm)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.torso,
      bodyB: characterParts.leftUpperArm,
      pointA: { x: -4, y: -4 },
      pointB: { x: 0, y: -4 },
      stiffness: 0.8,
      damping: 0.15,
      length: 1
    }));
    
    // Right Shoulder (Torso to Right Upper Arm)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.torso,
      bodyB: characterParts.rightUpperArm,
      pointA: { x: 4, y: -4 },
      pointB: { x: 0, y: -4 },
      stiffness: 0.8,
      damping: 0.15,
      length: 1
    }));
    
    // Left Elbow (Upper Arm to Forearm)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.leftUpperArm,
      bodyB: characterParts.leftForearm,
      pointA: { x: 0, y: 4 },
      pointB: { x: 0, y: -3 },
      stiffness: 0.9,
      damping: 0.2,
      length: 0.5
    }));
    
    // Right Elbow (Upper Arm to Forearm)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.rightUpperArm,
      bodyB: characterParts.rightForearm,
      pointA: { x: 0, y: 4 },
      pointB: { x: 0, y: -3 },
      stiffness: 0.9,
      damping: 0.2,
      length: 0.5
    }));
    
    // Left Wrist (Forearm to Hand)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.leftForearm,
      bodyB: characterParts.leftHand,
      pointA: { x: 0, y: 3 },
      pointB: { x: 0, y: 0 },
      stiffness: 0.95,
      damping: 0.25,
      length: 0.5
    }));
    
    // Right Wrist (Forearm to Hand)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.rightForearm,
      bodyB: characterParts.rightHand,
      pointA: { x: 0, y: 3 },
      pointB: { x: 0, y: 0 },
      stiffness: 0.95,
      damping: 0.25,
      length: 0.5
    }));
    
    // Left Hip (Torso to Left Thigh)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.torso,
      bodyB: characterParts.leftThigh,
      pointA: { x: -2, y: 6 },
      pointB: { x: 0, y: -5 },
      stiffness: 0.9,
      damping: 0.15,
      length: 1
    }));
    
    // Right Hip (Torso to Right Thigh)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.torso,
      bodyB: characterParts.rightThigh,
      pointA: { x: 2, y: 6 },
      pointB: { x: 0, y: -5 },
      stiffness: 0.9,
      damping: 0.15,
      length: 1
    }));
    
    // Left Knee (Thigh to Shin)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.leftThigh,
      bodyB: characterParts.leftShin,
      pointA: { x: 0, y: 5 },
      pointB: { x: 0, y: -4 },
      stiffness: 0.85,
      damping: 0.2,
      length: 0.5
    }));
    
    // Right Knee (Thigh to Shin)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.rightThigh,
      bodyB: characterParts.rightShin,
      pointA: { x: 0, y: 5 },
      pointB: { x: 0, y: -4 },
      stiffness: 0.85,
      damping: 0.2,
      length: 0.5
    }));
    
    // Left Ankle (Shin to Foot)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.leftShin,
      bodyB: characterParts.leftFoot,
      pointA: { x: 0, y: 4 },
      pointB: { x: 0, y: 0 },
      stiffness: 0.95,
      damping: 0.3,
      length: 0.5
    }));
    
    // Right Ankle (Shin to Foot)
    constraints.push(Matter.Constraint.create({
      bodyA: characterParts.rightShin,
      bodyB: characterParts.rightFoot,
      pointA: { x: 0, y: 4 },
      pointB: { x: 0, y: 0 },
      stiffness: 0.95,
      damping: 0.3,
      length: 0.5
    }));

    // Create Ladder on left side
    const ladderParts = [];
    const ladderX = 50;
    const ladderHeight = 500;
    const rungs = 8;
    
    // Ladder sides
    const leftSide = Matter.Bodies.rectangle(ladderX - 15, 300, 8, ladderHeight, {
      isStatic: true,
      render: { fillStyle: '#8B4513' }
    });
    
    const rightSide = Matter.Bodies.rectangle(ladderX + 15, 300, 8, ladderHeight, {
      isStatic: true,
      render: { fillStyle: '#8B4513' }
    });
    
    ladderParts.push(leftSide, rightSide);
    
    // Ladder rungs
    for (let i = 0; i < rungs; i++) {
      const rungY = 520 - (i * 60); // Space rungs 60px apart
      const rung = Matter.Bodies.rectangle(ladderX, rungY, 30, 6, {
        isStatic: true,
        render: { fillStyle: '#A0522D' }
      });
      ladderParts.push(rung);
    }

    // Add all parts to world
    const allCharacterBodies = Object.values(characterParts).map(b => ({...b}));
    // Reduce restitution globally to avoid extra micro-bounces
    Object.values(characterParts).forEach(part => {
      part.restitution = 0.05;
      part.frictionAir = 0.02;
    });
    Matter.World.add(engine.world, [ground, grassLine, ...Object.values(characterParts), ...constraints, ...ladderParts]);

    // Physics state management now handled by CharacterStateMachine
    
    // Only add subtle forces during falling phase
    const addSubtleForces = () => {
      const stateMachine = stateMachineRef.current;
      if (stateMachine && stateMachine.getState() === 'falling') {
        Object.values(characterParts).forEach(part => {
          if (part.velocity.y > 0.5) {
            const subtleForce = {
              x: (Math.random() - 0.5) * 0.001,
              y: (Math.random() - 0.5) * 0.0005
            };
            Matter.Body.applyForce(part, part.position, subtleForce);
          }
        });
      }
    };

    // Apply subtle forces only during falling
    const realisticInterval = setInterval(addSubtleForces, 200);

    // Simple collision detection - state management handled by StateMachine
    
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const stateMachine = stateMachineRef.current;
      const physicsController = physicsControllerRef.current;
      
      if (!stateMachine) return;
      
      // Only allow bouncing if in falling or bouncing state
      const currentState = stateMachine.getState();
      if (currentState !== 'falling' && currentState !== 'bouncing') {
        console.log(`🚫 COLLISION IGNORED: Wrong state (${currentState})`);
        return;
      }
      
      const pairs = event.pairs;
      
      for (let pair of pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        // Check if torso hit the ground with significant downward velocity
        const torsoHitGround = 
          (characterParts.torso === bodyA && bodyB === ground) ||
          (characterParts.torso === bodyB && bodyA === ground);
          
        if (torsoHitGround) {
          const currentState = stateMachine.getState();
          console.log(`🎯 COLLISION: velocity=${characterParts.torso.velocity.y.toFixed(2)}, state=${currentState}`);

          // Immediate settlement on first ground hit when falling
          if (currentState === 'falling') {
            console.log('🛬 First ground contact → start settlement (no bounce)');
            stateMachine.startSettlement();
            setIsGrounded(true);
            return;
          }

          setIsGrounded(true);
        }
      }
    });
    
    // Walking is now handled by PhysicsController component

    Matter.Events.on(engine, 'collisionEnd', (event) => {
      const pairs = event.pairs;
      
      for (let pair of pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        // Check if torso left the ground
        const torsoLeftGround = 
          (characterParts.torso === bodyA && bodyB === ground) ||
          (characterParts.torso === bodyB && bodyA === ground);
          
        if (torsoLeftGround) {
          // Only set airborne if character is in falling or bouncing state
          const stateMachine = stateMachineRef.current;
          if (stateMachine) {
            const currentState = stateMachine.getState();
            if (currentState === 'falling' || currentState === 'bouncing') {
              console.log(`🚁 AIRBORNE: Torso left ground, state=${currentState}, bounces=${stateMachine.bounceCount}`);
              setIsGrounded(false);
            }
          }
        }
      }
    });

    // Enhanced rendering for detailed ragdoll sprites
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; // Keep pixels crisp
      
      // Render each body part with enhanced details
      Object.entries(characterParts).forEach(([partName, body]) => {
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        
        // Enhanced sprite rendering based on body part
        switch(partName) {
          case 'head':
            // Cute small head with big eyes
            ctx.fillStyle = '#FFE4B5'; // Skin
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#DDB892';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Big cute eyes
            ctx.fillStyle = '#000000';
            ctx.fillRect(-2.5, -2, 1.5, 1.5); // Left eye
            ctx.fillRect(1, -2, 1.5, 1.5);    // Right eye
            
            // Small smile
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(0, 1, 1.5, 0, Math.PI);
            ctx.stroke();
            break;
            
          case 'torso':
            // Small cute torso
            ctx.fillStyle = '#4169E1';
            ctx.fillRect(-5, -8, 10, 16);
            ctx.strokeStyle = '#1E3A8A';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-5, -8, 10, 16);
            
            // Small shirt buttons
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-0.5, -5, 1, 1);
            ctx.fillRect(-0.5, -1, 1, 1);
            ctx.fillRect(-0.5, 3, 1, 1);
            break;
            
          case 'leftUpperArm':
          case 'rightUpperArm':
            // Small arms
            ctx.fillStyle = '#FFE4B5';
            ctx.fillRect(-1.5, -5, 3, 10);
            ctx.strokeStyle = '#DDB892';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-1.5, -5, 3, 10);
            break;
            
          case 'leftForearm':
          case 'rightForearm':
            // Small forearms
            ctx.fillStyle = '#FFE4B5';
            ctx.fillRect(-1.25, -4, 2.5, 8);
            ctx.strokeStyle = '#DDB892';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-1.25, -4, 2.5, 8);
            break;
            
          case 'leftHand':
          case 'rightHand':
            // Tiny cute hands
            ctx.fillStyle = '#FFE4B5';
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#DDB892';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            break;
            
          case 'leftThigh':
          case 'rightThigh':
            // Small legs
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-2, -6, 4, 12);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-2, -6, 4, 12);
            break;
            
          case 'leftShin':
          case 'rightShin':
            // Small shins
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-1.5, -5, 3, 10);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-1.5, -5, 3, 10);
            break;
            
          case 'leftFoot':
          case 'rightFoot':
            // Tiny cute shoes
            ctx.fillStyle = '#000000';
            ctx.fillRect(-3, -1.5, 6, 3);
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-3, -1.5, 6, 3);
            
            // Small shoe sole
            ctx.fillStyle = '#2F2F2F';
            ctx.fillRect(-3, 1, 6, 0.5);
            break;
        }
        
        ctx.restore();
      });
    });

    // Background is now handled by CSS gradient

    // Start the engine and renderer
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    // Store character parts reference for reset functionality
    engineRef.current.characterParts = characterParts;
    
    // Initialize state machine and controllers
    stateMachineRef.current = new CharacterStateMachine(characterParts, setCharacterState, setDialogue, setBounceCount);
    physicsControllerRef.current = new PhysicsController(characterParts, stateMachineRef.current);
    engineRef.current.animationController = new AnimationController(characterParts);
    
    // Set cross-references
    stateMachineRef.current.setPhysicsController(physicsControllerRef.current);
    if (stateMachineRef.current.setAnimationController) {
      stateMachineRef.current.setAnimationController(engineRef.current.animationController);
    }

    // Cleanup function
    return () => {
      // Clear realistic physics interval
      if (realisticInterval) {
        clearInterval(realisticInterval);
      }
      
      // Cleanup components
      if (stateMachineRef.current) {
        stateMachineRef.current.cleanup();
      }
      if (physicsControllerRef.current) {
        physicsControllerRef.current.cleanup();
      }
      
      if (renderRef.current) {
        Matter.Render.stop(renderRef.current);
        renderRef.current.canvas.remove();
        renderRef.current = null;
      }
      if (runnerRef.current && engineRef.current) {
        Matter.Runner.stop(runnerRef.current);
      }
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world);
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, [gameState]);

  // Intro Page
  if (gameState === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 p-4">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-4xl">
          <div className="text-8xl mb-6">🎭</div>
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-400 mb-4">
            The Eternal Bouncer
          </h1>
          <p className="text-2xl text-gray-300 mb-8">
            Watch our determined hero's endless adventure through pixel paradise!
          </p>
        </div>

        {/* Game Description */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mb-12">
          {/* Story */}
          <div className="bg-black bg-opacity-30 backdrop-blur-sm border border-purple-500 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">📖 The Story</h2>
            <p className="text-gray-300 leading-relaxed">
              Meet our brave little pixel hero - a determined character who never gives up! 
              Watch as they climb the ladder, leap from great heights, bounce off the ground, 
              and triumphantly walk back to try again... and again... and again!
            </p>
          </div>

          {/* Gameplay */}
          <div className="bg-black bg-opacity-30 backdrop-blur-sm border border-purple-500 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">🎮 The Experience</h2>
            <ul className="text-gray-300 space-y-2">
              <li>🧗 <strong>Climb:</strong> Watch rung-by-rung ladder climbing</li>
              <li>🚀 <strong>Jump:</strong> Leap with realistic physics and rotation</li>
              <li>💫 <strong>Bounce:</strong> Experience satisfying ground impacts</li>
              <li>💬 <strong>React:</strong> Hear hilarious dialogue after each fall</li>
              <li>🚶 <strong>Repeat:</strong> Determined walking back for more!</li>
            </ul>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mb-12">
          <div className="text-center bg-black bg-opacity-20 rounded-lg p-6">
            <div className="text-4xl mb-3">🌅</div>
            <h3 className="text-xl font-bold text-orange-400 mb-2">Pixel Art Sunset</h3>
            <p className="text-gray-400 text-sm">Beautiful gradient sky with moving clouds and flying birds</p>
          </div>
          
          <div className="text-center bg-black bg-opacity-20 rounded-lg p-6">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-bold text-orange-400 mb-2">Realistic Physics</h3>
            <p className="text-gray-400 text-sm">Matter.js powered bouncing, rotation, and gravity</p>
          </div>
          
          <div className="text-center bg-black bg-opacity-20 rounded-lg p-6">
            <div className="text-4xl mb-3">🔊</div>
            <h3 className="text-xl font-bold text-orange-400 mb-2">Voice Acting</h3>
            <p className="text-gray-400 text-sm">AI-powered speech with different phrases each fall</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button
            onClick={startGame}
            className="group relative px-12 py-4 text-2xl font-bold text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-full hover:from-orange-400 hover:to-pink-400 transform hover:scale-105 transition-all duration-300 shadow-2xl"
          >
            <span className="relative z-10">🚀 Start the Adventure!</span>
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-red-400 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          </button>
          <p className="text-gray-400 text-sm mt-4">Click to begin the endless bouncing journey!</p>
        </div>
      </div>
    );
  }

  // Game Page
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      {/* Game Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <button
          onClick={goBackToIntro}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          ← Back to Intro
        </button>
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-orange-300 mb-2">
            🎭 The Eternal Bouncer
          </h1>
          <p className="text-gray-300 text-lg">
            Watch our determined hero's endless adventure!
          </p>
        </div>
        
        <div className="w-32"></div> {/* Spacer for center alignment */}
      </div>

      {/* Game Canvas */}
      <div className="relative">
        {/* Gradient Background (fallback) */}
        <div 
          className="absolute inset-0 border-4 border-orange-400 rounded-lg shadow-2xl"
          style={{
            width: '800px',
            height: '600px',
            background: 'linear-gradient(to bottom, #FF6B6B 0%, #FF8E8E 30%, #FFA726 60%, #FFD54F 80%, #FFECB3 100%)'
          }}
        />
        
        <canvas
          ref={canvasRef}
          className="relative z-10 border-4 border-orange-400 rounded-lg shadow-2xl block"
          style={{ 
            imageRendering: 'pixelated', // For crisp pixel art
            width: '800px',
            height: '600px',
            background: 'transparent',
            display: 'block'
          }}
        />
        
        {/* Game Info Overlay */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
          <div className="text-sm space-y-1">
            <div>🌅 Sunset Mode</div>
            <div>🎮 Physics Engine: Active</div>
            <div>💫 Bounces: {bounceCount}/3</div>
            <div>{isGrounded ? '🟢 Grounded' : '🔴 Airborne'}</div>
            <div>🎭 State: {characterState}</div>
          </div>
        </div>

        {/* Dialogue Bubble */}
        {dialogue && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border-4 border-gray-800 rounded-xl p-4 shadow-lg z-20">
            <div className="text-black font-bold text-lg text-center min-w-[200px]">
              💬 "{dialogue}"
            </div>
            {/* Speech bubble tail */}
            <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        )}
      </div>

      {/* Game Controls */}
      <div className="mt-4 text-center space-y-2">
        <div className="text-gray-400 text-sm">
          <p>🎮 COMPLETE GAME LOOP ✅</p>
          <p>Fall → 1 Bounce → Settle → Stand → Speak → Walk to Ladder</p>
          <p>Watch the character's full journey cycle!</p>
        </div>
        <button
          onClick={() => {
            setBounceCount(0);
            setIsGrounded(false);
            setCharacterState('falling');
            setDialogue('');
            
            // Reset via state machine
            if (stateMachineRef.current) {
              stateMachineRef.current.reset();
            }
            
            // Clear any existing intervals - handled by components now
            
            // Reset character position via physics controller
            if (physicsControllerRef.current) {
              physicsControllerRef.current.resetCharacterPosition();
            }
            
            // Add minimal initial variation for natural start
            setTimeout(() => {
              if (engineRef.current?.characterParts) {
                Object.values(engineRef.current.characterParts).forEach(part => {
                  const subtleForce = {
                    x: (Math.random() - 0.5) * 0.003,
                    y: (Math.random() - 0.5) * 0.001
                  };
                  Matter.Body.applyForce(part, part.position, subtleForce);
                });
              }
            }, 100);
          }}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors"
        >
          🔄 Reset Ragdoll
        </button>
      </div>
    </div>
  );
};

export default GameCanvas;
