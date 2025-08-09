import { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Bird, Play, Volume2, VolumeX, RotateCcw, ChevronRight } from 'lucide-react';
import { CharacterStateMachine } from './CharacterStateMachine.js';
import { PhysicsController } from './PhysicsController.js';
import PoseController from './PoseController.js';
import AnimationController from './AnimationController.js';
import { voiceController } from './VoiceController.js';

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
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const [bubbleFontSize, setBubbleFontSize] = useState(14);
  const lastBubbleUpdateRef = useRef(0);
  const dialogueRef = useRef('');
  
  // Sky elements state
  const [skyElements, setSkyElements] = useState({ clouds: [], birds: [] });
  const skyAnimationRef = useRef(null);
  const skyElementsRef = useRef({ clouds: [], birds: [] });
  
  // No terms/checkboxes needed - direct access

  // Voice control state
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    dialogueRef.current = dialogue;
    // When dialogue just appeared, place bubble at center of canvas
    if (dialogue) {
      // Position bubble at center of canvas accounting for container padding
      const canvasWidth = 600;
      const canvasHeight = 300;
      const containerPadding = 16; // p-4 = 16px padding from container
      
      // Center coordinates relative to the canvas container
      const bubbleX = (canvasWidth / 2) + containerPadding;
      const bubbleY = (canvasHeight / 2) + containerPadding;
      
      setBubblePos({ x: bubbleX, y: bubbleY });
    }
    // Adjust font size to keep text within bubble
    if (dialogue) {
      const len = dialogue.length;
      let size = 14;
      if (len > 40) size = 12;
      if (len > 70) size = 10;
      if (len > 100) size = 8;
      setBubbleFontSize(size);
    }
  }, [dialogue]);

  // Keep sky elements ref in sync with state
  useEffect(() => {
    skyElementsRef.current = skyElements;
  }, [skyElements]);

  const startGame = () => {
    setGameState('playing');
  };

  const goBackToIntro = () => {
    setGameState('intro');
  };

  const toggleVoice = () => {
    const newState = voiceController.toggle();
    setVoiceEnabled(newState);
  };

  useEffect(() => {
    // Only initialize game when in playing state
    if (gameState !== 'playing') return;
    
    // Get canvas element
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size explicitly
    canvas.width = 600;
    canvas.height = 300;
    canvas.style.width = '600px';
    canvas.style.height = '300px';
    
    console.log('Canvas created:', canvas.width, 'x', canvas.height);

    // Initialize sky elements
    const initialClouds = [
      { id: 1, x: 80, y: 50, size: 0.8, speed: 0.3, opacity: 0.8 },
      { id: 2, x: 250, y: 80, size: 1.0, speed: 0.2, opacity: 0.6 },
      { id: 3, x: 450, y: 40, size: 0.7, speed: 0.4, opacity: 0.7 },
      { id: 4, x: 550, y: 65, size: 0.9, speed: 0.25, opacity: 0.5 },
    ];
    
    const initialBirds = [
      { id: 1, x: 150, y: 100, wingPhase: 0, speed: 1.2, flockOffset: 0 },
      { id: 2, x: 170, y: 110, wingPhase: Math.PI/3, speed: 1.2, flockOffset: 20 },
      { id: 3, x: 190, y: 105, wingPhase: Math.PI*2/3, speed: 1.2, flockOffset: 40 },
      { id: 4, x: 450, y: 90, wingPhase: Math.PI, speed: 0.8, flockOffset: 0 },
      { id: 5, x: 470, y: 100, wingPhase: Math.PI*4/3, speed: 0.8, flockOffset: 20 },
    ];
    
    setSkyElements({ clouds: initialClouds, birds: initialBirds });

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
        width: 600,
        height: 300,
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
    const ground = Matter.Bodies.rectangle(300, 280, 600, 40, { 
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
    const ladderHeight = 200;
    const rungs = 5;
    
    // Ladder sides
    const leftSide = Matter.Bodies.rectangle(ladderX - 15, 180, 8, ladderHeight, {
      isStatic: true,
      render: { fillStyle: '#8B4513' }
    });
    
    const rightSide = Matter.Bodies.rectangle(ladderX + 15, 180, 8, ladderHeight, {
      isStatic: true,
      render: { fillStyle: '#8B4513' }
    });
    
    ladderParts.push(leftSide, rightSide);
    
    // Ladder rungs
    for (let i = 0; i < rungs; i++) {
      const rungY = 250 - (i * 40); // Space rungs 40px apart
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

    // Sky animation loop - separate from physics for optimal performance
    const animateSky = () => {
      setSkyElements(prevSky => ({
        clouds: prevSky.clouds.map(cloud => ({
          ...cloud,
          x: cloud.x + cloud.speed,
          // Reset cloud position when it goes off screen
          ...(cloud.x > 650 ? { x: -50 } : {})
        })),
        birds: prevSky.birds.map(bird => ({
          ...bird,
          x: bird.x + bird.speed,
          wingPhase: bird.wingPhase + 0.3,
          // Reset bird position when it goes off screen
          ...(bird.x > 650 ? { x: -30 } : {})
        }))
      }));
    };

    // Start sky animation with 50ms interval (20fps for smooth movement)
    skyAnimationRef.current = setInterval(animateSky, 50);

    // Cloud rendering function
    const renderClouds = (ctx, clouds) => {
      clouds.forEach(cloud => {
        ctx.save();
        ctx.globalAlpha = cloud.opacity;
        ctx.translate(cloud.x, cloud.y);
        ctx.scale(cloud.size, cloud.size);
        
        // Draw fluffy cloud shape with multiple overlapping circles
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        
        // Main cloud body (multiple overlapping circles for fluffy appearance)
        ctx.arc(0, 0, 25, 0, 2 * Math.PI);
        ctx.arc(-15, -5, 20, 0, 2 * Math.PI);
        ctx.arc(15, -5, 20, 0, 2 * Math.PI);
        ctx.arc(-10, -15, 15, 0, 2 * Math.PI);
        ctx.arc(10, -15, 15, 0, 2 * Math.PI);
        ctx.arc(0, -20, 18, 0, 2 * Math.PI);
        
        ctx.fill();
        
        // Add subtle cloud outline for definition
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
      });
    };

    // Bird rendering function with animated wings
    const renderBirds = (ctx, birds) => {
      birds.forEach(bird => {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        
        // Simple bird silhouette with animated wings
        ctx.fillStyle = '#2d2d2d';
        ctx.strokeStyle = '#2d2d2d';
        ctx.lineWidth = 2;
        
        // Bird body (small oval)
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 2, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        // Animated wings using sine wave for natural flapping
        const wingAngle = Math.sin(bird.wingPhase) * 0.5;
        
        // Left wing
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-8, -4 + wingAngle * 3);
        ctx.lineTo(-6, 2 + wingAngle * 2);
        ctx.closePath();
        ctx.fill();
        
        // Right wing
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(8, -4 + wingAngle * 3);
        ctx.lineTo(6, 2 + wingAngle * 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      });
    };

    // Hills rendering function for distant background
    const renderHills = (ctx) => {
      ctx.save();
      
      // Distant hills silhouettes with multiple layers for depth
      const hillLayers = [
        { y: 200, height: 60, color: 'rgba(139, 69, 19, 0.3)', points: [0, 60, 150, 40, 300, 70, 450, 30, 600] },
        { y: 230, height: 50, color: 'rgba(101, 67, 33, 0.4)', points: [0, 40, 200, 55, 400, 35, 600] },
        { y: 250, height: 40, color: 'rgba(85, 107, 47, 0.5)', points: [0, 30, 180, 45, 350, 25, 520, 40, 600] }
      ];
      
      hillLayers.forEach(layer => {
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(0, 300); // Start from bottom-left corner
        
        // Create hill silhouette using smooth curves
        for (let i = 0; i < layer.points.length; i += 2) {
          const x = layer.points[i];
          const y = layer.y - layer.points[i + 1];
          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            // Use quadratic curves for smooth hills
            const prevX = layer.points[i - 2];
            const prevY = layer.y - layer.points[i - 1];
            const cpX = (prevX + x) / 2;
            const cpY = (prevY + y) / 2;
            ctx.quadraticCurveTo(cpX, cpY, x, y);
          }
        }
        
        ctx.lineTo(600, 300); // End at bottom-right corner
        ctx.closePath();
        ctx.fill();
      });
      
      ctx.restore();
    };

    // Grass rendering function for realistic ground texture
    const renderGrass = (ctx) => {
      ctx.save();
      
      // Individual grass blades for realistic texture
      const grassBlades = [];
      
      // Generate grass blades if not already done
      if (!engineRef.current.grassBlades) {
        for (let x = 0; x < 600; x += 3) {
          for (let i = 0; i < 2; i++) {
            grassBlades.push({
              x: x + Math.random() * 3,
              height: 3 + Math.random() * 4,
              sway: Math.random() * 0.3,
              color: Math.random() > 0.7 ? '#7CB342' : '#689F38'
            });
          }
        }
        engineRef.current.grassBlades = grassBlades;
      }
      
      // Render individual grass blades
      const time = Date.now() * 0.001; // For gentle swaying animation
      engineRef.current.grassBlades.forEach(blade => {
        ctx.strokeStyle = blade.color;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        
        const baseY = 260;
        const swayOffset = Math.sin(time + blade.x * 0.1) * blade.sway;
        
        ctx.beginPath();
        ctx.moveTo(blade.x, baseY);
        ctx.lineTo(blade.x + swayOffset, baseY - blade.height);
        ctx.stroke();
      });
      
      // Add some small flowers/details randomly
      if (!engineRef.current.grassDetails) {
        const details = [];
        for (let i = 0; i < 15; i++) {
          details.push({
            x: Math.random() * 600,
            y: 258 + Math.random() * 4,
            type: Math.random() > 0.5 ? 'flower' : 'stone'
          });
        }
        engineRef.current.grassDetails = details;
      }
      
      engineRef.current.grassDetails.forEach(detail => {
        if (detail.type === 'flower') {
          // Small colorful flowers
          ctx.fillStyle = Math.random() > 0.5 ? '#FFD54F' : '#FF7043';
          ctx.beginPath();
          ctx.arc(detail.x, detail.y, 1, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          // Small stones/pebbles
          ctx.fillStyle = '#8D6E63';
          ctx.beginPath();
          ctx.ellipse(detail.x, detail.y, 1.5, 1, 0, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      
      ctx.restore();
    };

    // Enhanced rendering for detailed ragdoll sprites
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; // Keep pixels crisp
      
      // Render background elements in proper order (back to front)
      renderHills(ctx); // Distant hills in background
      renderClouds(ctx, skyElementsRef.current.clouds); // Clouds in middle distance
      renderBirds(ctx, skyElementsRef.current.birds); // Birds in foreground sky
      renderGrass(ctx); // Grass on ground (before character)
      
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

      // Keep speech bubble at center of canvas (no need to update position)
      // Bubble stays fixed at center, so no real-time positioning needed
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
    engineRef.current.poseController = new PoseController(characterParts, engine.world);
    
    // Set cross-references
    stateMachineRef.current.setPhysicsController(physicsControllerRef.current);
    if (stateMachineRef.current.setAnimationController) {
      stateMachineRef.current.setAnimationController(engineRef.current.animationController);
    }
    if (stateMachineRef.current.setPoseController) {
      stateMachineRef.current.setPoseController(engineRef.current.poseController);
    }

    // Cleanup function
    return () => {
      // Clear realistic physics interval
      if (realisticInterval) {
        clearInterval(realisticInterval);
      }
      
      // Clear sky animation interval
      if (skyAnimationRef.current) {
        clearInterval(skyAnimationRef.current);
        skyAnimationRef.current = null;
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

  // Modern Sunset-Themed Landing Page
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen relative overflow-hidden font-['Inter',system-ui,sans-serif]">
        {/* Animated Sunset Background */}
        <div className="absolute inset-0">
        <div 
            className="absolute inset-0 animate-pulse"
          style={{
              background: `
                linear-gradient(135deg, 
                  #FF6B6B 0%, 
                  #FF8E8E 15%, 
                  #FFA726 35%, 
                  #FFD54F 60%, 
                  #FFECB3 80%, 
                  #81C784 90%, 
                  #4FC3F7 100%
                )
              `
            }}
          />
          
          {/* Animated Hills Layers */}
          <div className="absolute bottom-0 left-0 right-0">
            <motion.svg 
              viewBox="0 0 1200 400" 
              className="w-full h-64"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              {/* Back Hills */}
              <motion.path
                d="M0,300 Q200,250 400,280 T800,260 L1200,280 L1200,400 L0,400 Z"
                fill="rgba(139, 69, 19, 0.3)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 3, delay: 0.5 }}
              />
              {/* Middle Hills */}
              <motion.path
                d="M0,320 Q300,280 600,300 T1200,290 L1200,400 L0,400 Z"
                fill="rgba(101, 67, 33, 0.5)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 3, delay: 1 }}
              />
              {/* Front Hills */}
              <motion.path
                d="M0,340 Q150,320 300,330 T600,325 T1200,320 L1200,400 L0,400 Z"
                fill="rgba(85, 107, 47, 0.7)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 3, delay: 1.5 }}
              />
            </motion.svg>
        </div>
        
          {/* Floating Clouds */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-white/70"
                style={{ 
                  left: `${20 + i * 25}%`, 
                  top: `${15 + i * 5}%`,
                  fontSize: `${2 + i * 0.5}rem`
                }}
                animate={{
                  x: [0, 100, 0],
                  y: [0, -20, 0],
                }}
                transition={{
                  duration: 15 + i * 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Cloud size={40 + i * 10} />
              </motion.div>
            ))}
          </div>

          {/* Flying Birds */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-gray-800/60"
                style={{ 
                  left: `${10 + i * 30}%`, 
                  top: `${25 + i * 10}%`
                }}
                animate={{
                  x: [0, 200, 400],
                  y: [0, -30, -10],
                }}
                transition={{
                  duration: 20 + i * 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Bird size={20 + i * 5} />
                </motion.div>
              </motion.div>
            ))}
          </div>
              </div>
              
        {/* Content Container */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-4">
          <motion.div 
            className="w-full max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            
            {/* Ultra Compact Hero Section */}
            <motion.div 
              className="text-center mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <motion.div 
                className="inline-block p-3 bg-white/10 backdrop-blur-lg rounded-full mb-2 border border-white/20 shadow-2xl"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.div 
                  className="text-3xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  🌅
                </motion.div>
              </motion.div>
              
              <motion.h1 
                className="text-3xl md:text-4xl font-black mb-2"
                style={{
                  background: 'linear-gradient(135deg, #FF6B6B, #FFA726, #FFD54F, #81C784)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundSize: '300% 300%',
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{ duration: 5, repeat: Infinity }}
              >
                SUNSET ADVENTURE
              </motion.h1>
              
              <motion.p 
                className="text-base md:text-lg text-white/90 max-w-xl mx-auto leading-snug font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.8 }}
              >
                Watch our brave hero's endless journey through gravity and determination
              </motion.p>
            </motion.div>
            
                        {/* Ultra Compact Adventure Info */}
            <motion.div 
              className="max-w-2xl mx-auto mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              <div className="grid grid-cols-3 gap-2">
                <motion.div 
                  className="text-center p-2 bg-white/8 backdrop-blur-lg rounded-lg"
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  <div className="text-lg mb-1">🎭</div>
                  <h3 className="font-bold text-white text-xs">WITNESS GREATNESS</h3>
                </motion.div>
                
                <motion.div 
                  className="text-center p-2 bg-white/8 backdrop-blur-lg rounded-lg"
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  <div className="text-lg mb-1">💪</div>
                  <h3 className="font-bold text-white text-xs">EMOTIONAL READINESS</h3>
                </motion.div>
                
                <motion.div 
                  className="text-center p-2 bg-white/8 backdrop-blur-lg rounded-lg"
                  whileHover={{ scale: 1.05, y: -2 }}
                >
                  <div className="text-lg mb-1">✨</div>
                  <h3 className="font-bold text-white text-xs">EXPECT WONDER</h3>
                </motion.div>
                </div>
            </motion.div>
            
                        {/* Call to Action */}
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.5 }}
            >
              <motion.button
                    onClick={startGame}
                className="group relative inline-flex items-center gap-2 px-8 py-3 text-lg md:text-xl font-black text-white rounded-full overflow-hidden cursor-pointer mb-2"
                style={{
                  background: 'linear-gradient(135deg, #FF6B6B, #FFA726, #FFD54F)',
                  backgroundSize: '200% 200%',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  backgroundPosition: { duration: 3, repeat: Infinity },
                  scale: { type: "spring", stiffness: 300 }
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Play size={20} />
                </motion.div>
                START ADVENTURE
                <motion.div
                  animate={{ x: [0, 2, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ChevronRight size={20} />
                </motion.div>
                
                {/* Ripple Effect */}
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-full"
                  initial={{ scale: 0, opacity: 1 }}
                  whileHover={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              </motion.button>
              
              {/* Ultra Compact Warning */}
              <motion.p 
                className="text-orange-300 text-xs font-medium max-w-xs mx-auto"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ⚠️ Physics-defying stunts ahead
              </motion.p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Game Page - Modern Design
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #FF6B6B 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, #FFA726 0%, transparent 50%)`
        }} />
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Modern Game Header */}
        <motion.div 
          className="w-full max-w-6xl flex justify-between items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.button
          onClick={goBackToIntro}
            className="flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-lg text-white rounded-xl hover:bg-white/15 transition-all duration-300 border border-white/20 font-medium"
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronRight size={20} className="rotate-180" />
            Back to Adventure
          </motion.button>
          
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.h1 
              className="text-3xl md:text-4xl font-bold mb-2"
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #FFA726, #FFD54F)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
            Sunset Adventure
            </motion.h1>
            
          </motion.div>
          
          <div className="w-48"></div> {/* Spacer for center alignment */}
        </motion.div>

        {/* Modern Game Canvas Container */}
        <motion.div 
          className="relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {/* Elegant Canvas Frame */}
          <div className="relative p-4 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl">
        {/* Gradient Background (fallback) */}
        <div 
            className="absolute inset-4 rounded-2xl shadow-inner"
          style={{
            width: '600px',
              height: '300px',
            background: 'linear-gradient(to bottom, #FF6B6B 0%, #FF8E8E 30%, #FFA726 60%, #FFD54F 80%, #FFECB3 100%)'
          }}
        />
        
        <canvas
          ref={canvasRef}
            className="relative z-10 rounded-2xl shadow-xl block"
          style={{ 
              imageRendering: 'pixelated',
            width: '600px',
              height: '300px',
            background: 'transparent',
            display: 'block'
          }}
        />
          
          {/* Decorative Corner Accents */}
          <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-white/30 rounded-tl-lg"></div>
          <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-white/30 rounded-tr-lg"></div>
          <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-white/30 rounded-bl-lg"></div>
          <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-white/30 rounded-br-lg"></div>
        </div>
        
        {/* Game Info Overlay */}
       

          {/* Enhanced Dialogue Bubble */}
        {dialogue && bubblePos.x != null && bubblePos.y != null && (
            <motion.div
              className="absolute z-20 pointer-events-none"
            style={{ 
              left: bubblePos.x, 
              top: bubblePos.y, 
                transform: 'translate(-50%, -50%)',
            }}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
              <motion.div 
                className="relative" 
              style={{ width: 240, height: 120 }}
                animate={{ 
                  y: [0, -8, 0],
                  rotate: [0, 1, -1, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* Modern SVG speech bubble */}
              <svg width="240" height="120" viewBox="0 0 240 120">
                <defs>
                  <clipPath id="speechClip">
                    <path d="M40,68 C24,68 16,52 28,40 C24,20 52,12 68,28 C80,8 112,8 128,28 C144,16 176,24 180,44 C200,44 216,60 208,76 C200,96 168,100 152,88 C136,104 104,104 88,88 C68,100 48,96 40,84 C28,84 20,76 24,68 Z" />
                  </clipPath>
                    <linearGradient id="bubbleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
                    </linearGradient>
                </defs>
                
                  {/* Glow effect */}
                <path 
                  d="M40,68 C24,68 16,52 28,40 C24,20 52,12 68,28 C80,8 112,8 128,28 C144,16 176,24 180,44 C200,44 216,60 208,76 C200,96 168,100 152,88 C136,104 104,104 88,88 C68,100 48,96 40,84 C28,84 20,76 24,68 Z" 
                    fill="rgba(255,107,107,0.3)" 
                    transform="scale(1.1)"
                    style={{ filter: 'blur(8px)' }}
                />
                
                  {/* Main bubble */}
                <path 
                  d="M40,68 C24,68 16,52 28,40 C24,20 52,12 68,28 C80,8 112,8 128,28 C144,16 176,24 180,44 C200,44 216,60 208,76 C200,96 168,100 152,88 C136,104 104,104 88,88 C68,100 48,96 40,84 C28,84 20,76 24,68 Z" 
                    fill="url(#bubbleGradient)" 
                    stroke="rgba(255,107,107,0.6)" 
                    strokeWidth="2" 
                  strokeLinejoin="round"
                />
                
                  {/* Tail */}
                <path 
                  d="M68,92 L56,116 L88,96" 
                    fill="url(#bubbleGradient)" 
                    stroke="rgba(255,107,107,0.6)" 
                  strokeWidth="2" 
                  strokeLinejoin="round"
                />
                
                {/* Text content */}
                <foreignObject x="36" y="28" width="168" height="64" clipPath="url(#speechClip)">
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                    }}
                  >
                    <div
                      style={{
                          fontFamily: "'Inter', system-ui",
                          fontWeight: 700,
                        color: '#1a1a1a',
                        fontSize: bubbleFontSize,
                          lineHeight: 1.2,
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                      }}
                    >
                      {dialogue}
                    </div>
                  </div>
                </foreignObject>
              </svg>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Modern Game Controls */}
        <motion.div 
          className="mt-8 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
        {/* Voice Toggle Button */}
          <motion.button
          onClick={toggleVoice}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all duration-300 backdrop-blur-lg border ${
            voiceEnabled 
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30' 
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30'
          }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
          </motion.button>
       
          {/* Reset Button */}
          <motion.button
          onClick={() => {
            setBounceCount(0);
            setIsGrounded(false);
            setCharacterState('falling');
            setDialogue('');
            
            // Reset via state machine
            if (stateMachineRef.current) {
              stateMachineRef.current.reset();
            }
            
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
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 text-orange-300 rounded-xl font-semibold transition-all duration-300 backdrop-blur-lg border border-orange-500/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <RotateCcw size={20} />
            </motion.div>
            New Adventure
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default GameCanvas;
