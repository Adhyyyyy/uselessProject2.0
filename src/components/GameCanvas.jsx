import { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { CharacterStateMachine } from './CharacterStateMachine.js';
import { PhysicsController } from './PhysicsController.js';
import PoseController from './PoseController.js';
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
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const [bubbleFontSize, setBubbleFontSize] = useState(18);
  const lastBubbleUpdateRef = useRef(0);
  const dialogueRef = useRef('');
  
  // Sky elements state
  const [skyElements, setSkyElements] = useState({ clouds: [], birds: [] });
  const skyAnimationRef = useRef(null);
  const skyElementsRef = useRef({ clouds: [], birds: [] });
  
  // Terms and conditions state
  const [termsAccepted, setTermsAccepted] = useState({
    term1: false,
    term2: false,
    term3: false
  });
  
  const allTermsAccepted = Object.values(termsAccepted).every(Boolean);

  useEffect(() => {
    dialogueRef.current = dialogue;
    // When dialogue just appeared, place bubble near current head position immediately
    if (dialogue && engineRef.current?.characterParts?.head) {
      const head = engineRef.current.characterParts.head;
      setBubblePos({ x: head.position.x + 20, y: head.position.y - 30 });
    }
    // Adjust font size to keep text within bubble
    if (dialogue) {
      const len = dialogue.length;
      let size = 18;
      if (len > 60) size = 14;
      if (len > 90) size = 12;
      if (len > 120) size = 10;
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

    // Initialize sky elements
    const initialClouds = [
      { id: 1, x: 100, y: 80, size: 1, speed: 0.3, opacity: 0.8 },
      { id: 2, x: 300, y: 120, size: 1.2, speed: 0.2, opacity: 0.6 },
      { id: 3, x: 500, y: 60, size: 0.8, speed: 0.4, opacity: 0.7 },
      { id: 4, x: 700, y: 100, size: 1.1, speed: 0.25, opacity: 0.5 },
    ];
    
    const initialBirds = [
      { id: 1, x: 200, y: 150, wingPhase: 0, speed: 1.2, flockOffset: 0 },
      { id: 2, x: 220, y: 160, wingPhase: Math.PI/3, speed: 1.2, flockOffset: 20 },
      { id: 3, x: 240, y: 155, wingPhase: Math.PI*2/3, speed: 1.2, flockOffset: 40 },
      { id: 4, x: 600, y: 120, wingPhase: Math.PI, speed: 0.8, flockOffset: 0 },
      { id: 5, x: 620, y: 130, wingPhase: Math.PI*4/3, speed: 0.8, flockOffset: 20 },
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

    // Sky animation loop - separate from physics for optimal performance
    const animateSky = () => {
      setSkyElements(prevSky => ({
        clouds: prevSky.clouds.map(cloud => ({
          ...cloud,
          x: cloud.x + cloud.speed,
          // Reset cloud position when it goes off screen
          ...(cloud.x > 850 ? { x: -50 } : {})
        })),
        birds: prevSky.birds.map(bird => ({
          ...bird,
          x: bird.x + bird.speed,
          wingPhase: bird.wingPhase + 0.3,
          // Reset bird position when it goes off screen
          ...(bird.x > 850 ? { x: -30 } : {})
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
        { y: 400, height: 100, color: 'rgba(139, 69, 19, 0.3)', points: [0, 100, 150, 80, 300, 120, 450, 70, 600, 110, 750, 90, 800] },
        { y: 450, height: 80, color: 'rgba(101, 67, 33, 0.4)', points: [0, 70, 200, 90, 400, 60, 600, 85, 800] },
        { y: 480, height: 60, color: 'rgba(85, 107, 47, 0.5)', points: [0, 50, 180, 75, 350, 45, 520, 70, 680, 55, 800] }
      ];
      
      hillLayers.forEach(layer => {
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(0, 600); // Start from bottom-left corner
        
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
        
        ctx.lineTo(800, 600); // End at bottom-right corner
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
        for (let x = 0; x < 800; x += 3) {
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
        
        const baseY = 560;
        const swayOffset = Math.sin(time + blade.x * 0.1) * blade.sway;
        
        ctx.beginPath();
        ctx.moveTo(blade.x, baseY);
        ctx.lineTo(blade.x + swayOffset, baseY - blade.height);
        ctx.stroke();
      });
      
      // Add some small flowers/details randomly
      if (!engineRef.current.grassDetails) {
        const details = [];
        for (let i = 0; i < 20; i++) {
          details.push({
            x: Math.random() * 800,
            y: 558 + Math.random() * 4,
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

      // Update speech bubble position (throttled) near the head
      const now = performance.now();
      if (dialogueRef.current && now - lastBubbleUpdateRef.current > 100) {
        const head = characterParts.head;
        if (head) {
          // Offset bubble slightly above and to the right of head
          const bx = head.position.x + 20;
          const by = head.position.y - 30;
          setBubblePos((prev) => {
            if (!prev || Math.abs(prev.x - bx) > 1 || Math.abs(prev.y - by) > 1) {
              return { x: bx, y: by };
            }
            return prev;
          });
          lastBubbleUpdateRef.current = now;
        }
      }
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

  // Modern Hell-Themed Landing Page
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Hell/Danger Background - Canvas Colors */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #4a1a1a 25%, #8b2635 50%, #d2691e 75%, #ffa500 100%)'
          }}
        />
        
        {/* Overlay Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #ff4444 0%, transparent 50%), 
                             radial-gradient(circle at 75% 75%, #ff6b35 0%, transparent 50%)`
          }} />
        </div>
        
        {/* Content Container */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-block p-4 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full mb-6 backdrop-blur-sm border border-red-500/30">
                <div className="text-5xl">💀</div>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent mb-4">
                DESCENT INTO MADNESS
              </h1>
              
              <p className="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
                Watch a determined soul fight the eternal cycle of gravity and hope
              </p>
            </div>
            
            {/* Terms and Conditions - Funny Legal Disclaimer */}
            <div className="bg-black/40 backdrop-blur-sm rounded-3xl p-6 sm:p-8 mb-8 max-w-4xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-red-300 mb-2">
                  ⚖️ TERMS & CONDITIONS ⚖️
                </h2>
                <p className="text-white/90 text-sm sm:text-base font-semibold">
                  MANDATORY AGREEMENT BEFORE WITNESSING THIS CHAOS
                </p>
              </div>
              
              {/* Terms List */}
              <div className="space-y-8">
                
                {/* Term 1 */}
                <div className="flex flex-col items-center text-center space-y-4 p-6 bg-white/5 rounded-xl">
                  <input
                    type="checkbox"
                    id="term1"
                    checked={termsAccepted.term1}
                    onChange={(e) => setTermsAccepted(prev => ({...prev, term1: e.target.checked}))}
                    className="w-6 h-6 text-green-500 bg-transparent border-2 border-green-400 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                  <label htmlFor="term1" className="text-white/95 text-base sm:text-lg leading-relaxed cursor-pointer">
                    <span className="font-bold text-red-300">1. WITNESS SUFFERING:</span><br />
                    Are you ready to witness someone suffer repeatedly?
                  </label>
                </div>
                
                {/* Term 2 */}
                <div className="flex flex-col items-center text-center space-y-4 p-6 bg-white/5 rounded-xl">
                  <input
                    type="checkbox"
                    id="term2"
                    checked={termsAccepted.term2}
                    onChange={(e) => setTermsAccepted(prev => ({...prev, term2: e.target.checked}))}
                    className="w-6 h-6 text-green-500 bg-transparent border-2 border-green-400 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                  <label htmlFor="term2" className="text-white/95 text-base sm:text-lg leading-relaxed cursor-pointer">
                    <span className="font-bold text-orange-300">2. EMOTIONAL STRENGTH:</span><br />
                    Are you emotionally strong enough to handle this?
                  </label>
                </div>
                
                {/* Term 3 */}
                <div className="flex flex-col items-center text-center space-y-4 p-6 bg-white/5 rounded-xl">
                  <input
                    type="checkbox"
                    id="term3"
                    checked={termsAccepted.term3}
                    onChange={(e) => setTermsAccepted(prev => ({...prev, term3: e.target.checked}))}
                    className="w-6 h-6 text-green-500 bg-transparent border-2 border-green-400 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                  />
                  <label htmlFor="term3" className="text-white/95 text-base sm:text-lg leading-relaxed cursor-pointer">
                    <span className="font-bold text-yellow-300">3. WITNESS BAD THINGS:</span><br />
                    You may have to witness very bad things. Are you prepared?
                  </label>
                </div>
              </div>
              
              {/* Legal Footer */}
              <div className="mt-6 pt-4 border-t border-white/20">
                <p className="text-white/70 text-xs text-center leading-relaxed">
                  By checking all boxes above, you hereby waive your right to complain about time wasted, 
                  productivity lost, or any spontaneous urges to jump off furniture to test gravity. 
                  <br />
                  <span className="text-red-300 font-semibold">This agreement is binding in all dimensions where physics applies.</span>
                </p>
              </div>
            </div>
            
            {/* Conditional Start Button */}
            <div className="text-center mt-12">
              {allTermsAccepted ? (
                <div className="relative inline-block">
                  <button
                    onClick={startGame}
                    className="group relative inline-flex items-center justify-center px-12 py-6 text-2xl font-black text-white bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 rounded-full hover:from-red-500 hover:via-orange-400 hover:to-yellow-400 transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-orange-500/60"
                  >
                    <span className="relative z-10 flex items-center gap-4">
                      😈 WATCH HIM SUFFER
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                    <div className="absolute -inset-2 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 rounded-full opacity-0 group-hover:opacity-80 blur-xl transition-opacity duration-300"></div>
                  </button>
                  
                  {/* Floating text around button */}
                  <div className="absolute -top-6 -left-8 text-2xl animate-bounce delay-300">😂</div>
                  <div className="absolute -top-4 -right-8 text-2xl animate-bounce delay-700">🤣</div>
                  <div className="absolute -bottom-6 left-4 text-2xl animate-bounce delay-500">💀</div>
                  
                  {/* Success Message */}
                  <p className="text-green-300 text-base mt-6 font-semibold animate-pulse">
                    ✅ Agreement Complete! You may now proceed to witness the chaos.
                  </p>
                </div>
              ) : (
                <div className="relative inline-block">
                  {/* Disabled Button */}
                  <button
                    disabled
                    className="relative inline-flex items-center justify-center px-12 py-6 text-2xl font-black text-gray-500 bg-gray-600 rounded-full cursor-not-allowed opacity-50"
                  >
                    <span className="flex items-center gap-4">
                      🔒 TERMS REQUIRED
                    </span>
                  </button>
                  
                  {/* Instruction Message */}
                  <p className="text-red-300 text-base mt-6 font-semibold animate-pulse">
                    ⚠️ You must agree to all terms above to proceed with this madness!
                  </p>
                </div>
              )}
            </div>
          </div>
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
       

        {/* Cartoon Dialogue Bubble */}
        {dialogue && bubblePos.x != null && bubblePos.y != null && (
          <div
            className="absolute z-20 pointer-events-none animate-[bubbleIn_0.4s_ease-out]"
            style={{ 
              left: bubblePos.x, 
              top: bubblePos.y, 
              transform: 'translate(-50%, -110%)',
              filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3))'
            }}
          >
            <div 
              className="relative animate-[breathe_3s_ease-in-out_infinite]" 
              style={{ width: 300, height: 150 }}
            >
              {/* Cartoon SVG speech bubble */}
              <svg width="300" height="150" viewBox="0 0 300 150">
                <defs>
                  <clipPath id="speechClip">
                    {/* Bigger, rounder, more cartoon-like bubble */}
                    <path d="M50,85 C30,85 20,65 35,50 C30,25 65,15 85,35 C100,10 140,10 160,35 C180,20 220,30 225,55 C250,55 270,75 260,95 C250,120 210,125 190,110 C170,130 130,130 110,110 C85,125 60,120 50,105 C35,105 25,95 30,85 Z" />
                  </clipPath>
                  <filter id="bubbleShadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.2)" />
                  </filter>
                </defs>
                
                {/* Shadow layer */}
                <path 
                  d="M50,85 C30,85 20,65 35,50 C30,25 65,15 85,35 C100,10 140,10 160,35 C180,20 220,30 225,55 C250,55 270,75 260,95 C250,120 210,125 190,110 C170,130 130,130 110,110 C85,125 60,120 50,105 C35,105 25,95 30,85 Z" 
                  fill="rgba(0,0,0,0.1)" 
                  transform="translate(2,4)"
                />
                
                {/* Main bubble with thick cartoon border */}
                <path 
                  d="M50,85 C30,85 20,65 35,50 C30,25 65,15 85,35 C100,10 140,10 160,35 C180,20 220,30 225,55 C250,55 270,75 260,95 C250,120 210,125 190,110 C170,130 130,130 110,110 C85,125 60,120 50,105 C35,105 25,95 30,85 Z" 
                  fill="#ffffff" 
                  stroke="#1a1a1a" 
                  strokeWidth="6" 
                  strokeLinejoin="round"
                />
                
                {/* Cartoon tail with thick border */}
                <path 
                  d="M85,115 L70,145 L110,120" 
                  fill="#ffffff" 
                  stroke="#1a1a1a" 
                  strokeWidth="6" 
                  strokeLinejoin="round"
                />
                
                {/* Inner highlight for 3D effect */}
                <path 
                  d="M50,85 C30,85 20,65 35,50 C30,25 65,15 85,35 C100,10 140,10 160,35 C180,20 220,30 225,55 C250,55 270,75 260,95" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.6)" 
                  strokeWidth="3" 
                  strokeLinejoin="round"
                />
                
                {/* Text content */}
                <foreignObject x="45" y="35" width="210" height="80" clipPath="url(#speechClip)">
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Comic Neue', 'Baloo 2', cursive, system-ui",
                        fontWeight: 800,
                        color: '#1a1a1a',
                        fontSize: bubbleFontSize + 2,
                        lineHeight: 1.1,
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        hyphens: 'auto',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                      }}
                    >
                      {dialogue}
                    </div>
                  </div>
                </foreignObject>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Game Controls */}
      <div className="mt-4 text-center space-y-2">
       
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
          Throw him again
        </button>
      </div>
    </div>
  );
};

export default GameCanvas;
