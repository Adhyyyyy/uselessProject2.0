/**
 * PhysicsController - Handles physics-based movements and forces
 */
import Matter from 'matter-js';

export class PhysicsController {
  constructor(characterParts, stateMachine) {
    this.characterParts = characterParts;
    this.stateMachine = stateMachine;
    this.walkingInterval = null;
  }

  // Snap the ragdoll into an upright standing pose and stabilize briefly
  standUpPose() {
    const {
      head,
      torso,
      leftUpperArm,
      rightUpperArm,
      leftForearm,
      rightForearm,
      leftHand,
      rightHand,
      leftThigh,
      rightThigh,
      leftShin,
      rightShin,
      leftFoot,
      rightFoot,
    } = this.characterParts;

    const zeroAllMotion = (part) => {
      if (!part) return;
      Matter.Body.setVelocity(part, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(part, 0);
    };

    const setAngleSafe = (part, angle) => {
      if (!part) return;
      Matter.Body.setAngle(part, angle);
    };

    // Zero velocities first
    Object.values(this.characterParts).forEach(zeroAllMotion);

    // Pose angles: torso/head upright, legs straight with slight outward thigh angle
    setAngleSafe(torso, 0);
    setAngleSafe(head, 0);
    setAngleSafe(leftUpperArm, 0.05);
    setAngleSafe(rightUpperArm, -0.05);
    setAngleSafe(leftForearm, 0);
    setAngleSafe(rightForearm, 0);
    setAngleSafe(leftHand, 0);
    setAngleSafe(rightHand, 0);
    setAngleSafe(leftThigh, 0.06);
    setAngleSafe(rightThigh, -0.06);
    setAngleSafe(leftShin, -0.03);
    setAngleSafe(rightShin, 0.03);
    setAngleSafe(leftFoot, 0);
    setAngleSafe(rightFoot, 0);

    // Press feet down a bit to ensure contact and reduce jitter
    const footPress = { x: 0, y: 0.04 };
    if (leftFoot) Matter.Body.applyForce(leftFoot, leftFoot.position, footPress);
    if (rightFoot) Matter.Body.applyForce(rightFoot, rightFoot.position, footPress);

    // Temporarily increase air friction to stabilize, then restore
    const originalAir = new Map();
    Object.values(this.characterParts).forEach((part) => {
      if (!part) return;
      originalAir.set(part.id, part.frictionAir ?? 0.02);
      part.frictionAir = 0.08;
    });

    setTimeout(() => {
      Object.values(this.characterParts).forEach((part) => {
        if (!part) return;
        const prev = originalAir.get(part.id);
        part.frictionAir = prev != null ? prev : 0.02;
      });
    }, 800);
  }

  // Gradually stand up over a duration by interpolating limb angles
  animateStandUp(durationMs = 1200) {
    const parts = this.characterParts;
    const getAngle = (p) => (p ? p.angle : 0);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const targets = {
      torso: 0,
      head: 0,
      leftUpperArm: 0.05,
      rightUpperArm: -0.05,
      leftForearm: 0,
      rightForearm: 0,
      leftHand: 0,
      rightHand: 0,
      leftThigh: 0.06,
      rightThigh: -0.06,
      leftShin: -0.03,
      rightShin: 0.03,
      leftFoot: 0,
      rightFoot: 0,
    };

    const starts = {};
    Object.keys(targets).forEach((k) => {
      const body = parts[k];
      starts[k] = body ? getAngle(body) : 0;
    });

    // stabilize
    Object.values(parts).forEach((p) => {
      if (!p) return;
      Matter.Body.setVelocity(p, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(p, 0);
      p.frictionAir = 0.08;
    });

    const steps = Math.max(8, Math.floor(durationMs / 40));
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      const t = clamp(i / steps, 0, 1);
      Object.keys(targets).forEach((k) => {
        const body = parts[k];
        if (!body) return;
        const a0 = starts[k];
        const a1 = targets[k];
        const a = a0 + (a1 - a0) * t;
        Matter.Body.setAngle(body, a);
        Matter.Body.setAngularVelocity(body, 0);
      });

      if (i >= steps) {
        clearInterval(interval);
        // final snap + restore air friction later
        this.standUpPose();
      }
    }, Math.max(16, Math.floor(durationMs / steps)));
  }

  // Apply simple bounce forces
  applyBounceForce(bounceForce) {
    console.log(`🚀 Applying bounce force: ${bounceForce}`);
    
    // Apply upward force primarily to torso, with small assist on legs
    const torso = this.characterParts.torso;
    if (torso) {
      Matter.Body.applyForce(torso, torso.position, { x: 0, y: -bounceForce * 1.2 });
    }
    const legs = ['leftThigh', 'rightThigh', 'leftShin', 'rightShin', 'leftFoot', 'rightFoot'];
    legs.forEach(name => {
      const part = this.characterParts[name];
      if (part) {
        Matter.Body.applyForce(part, part.position, { x: 0, y: -bounceForce * 0.3 });
      }
    });
    // Gentle rotation only
    const all = Object.values(this.characterParts);
    all.forEach(part => {
      const angularForce = (Math.random() - 0.5) * 0.03;
      Matter.Body.setAngularVelocity(part, part.angularVelocity + angularForce);
    });
    
    // Start settlement check after 1st bounce
    if (this.stateMachine.bounceCount === 1) {
      console.log(`🎯 Single bounce completed, settlement will start automatically via timer`);
    }
  }

  // Start walking with the existing 8-step cycle
  startWalking() {
    // Safety check - only start walking if character is in proper state
    if (this.stateMachine.getState() !== 'walking') {
      console.log(`❌ Walking rejected - wrong state: ${this.stateMachine.getState()}`);
      return;
    }
    
    console.log('🚶 PhysicsController: Starting walking animation (slow)...');
    let walkStep = 0;
    
    this.walkingInterval = setInterval(() => {
      const currentX = this.characterParts.torso.position.x;
      
      if (currentX > 120) { // Continue walking until near ladder
        // PROPER HUMAN WALKING: Cycle through leg steps
        walkStep++;
        const cycleStep = walkStep % 8; // 8-step walking cycle
        
        console.log(`🚶 Walk step ${walkStep}, cycle ${cycleStep}`);
        
        // Human-like walking: lean forward, lift leg, step, push off
        if (cycleStep < 4) {
          // LEFT LEG STEP CYCLE
          this.applyLeftLegStep(cycleStep);
          this.applyArmSwing(true); // Right arm forward
        } else {
          // RIGHT LEG STEP CYCLE (4-7)
          this.applyRightLegStep(cycleStep - 4);
          this.applyArmSwing(false); // Left arm forward
        }
        
        // Maintain upright posture (gentle)
        this.maintainPosture();
        
      } else {
        // Reached ladder - stop walking
        this.stopWalking();
        this.startClimbing();
      }
    }, 200);
  }

  // Apply left leg step forces
  applyLeftLegStep(step) {
    if (step === 0) {
      Matter.Body.applyForce(this.characterParts.torso, this.characterParts.torso.position, { x: -0.01, y: -0.002 });
      Matter.Body.applyForce(this.characterParts.leftThigh, this.characterParts.leftThigh.position, { x: -0.004, y: -0.008 });
      Matter.Body.applyForce(this.characterParts.leftShin, this.characterParts.leftShin.position, { x: -0.003, y: -0.006 });
    } else if (step === 1) {
      Matter.Body.applyForce(this.characterParts.leftThigh, this.characterParts.leftThigh.position, { x: -0.01, y: 0 });
      Matter.Body.applyForce(this.characterParts.leftShin, this.characterParts.leftShin.position, { x: -0.007, y: 0.002 });
    } else if (step === 2) {
      Matter.Body.applyForce(this.characterParts.leftFoot, this.characterParts.leftFoot.position, { x: -0.008, y: 0.015 });
      Matter.Body.applyForce(this.characterParts.leftShin, this.characterParts.leftShin.position, { x: -0.006, y: 0.01 });
    } else if (step === 3) {
      Matter.Body.applyForce(this.characterParts.leftFoot, this.characterParts.leftFoot.position, { x: -0.015, y: -0.004 });
      Matter.Body.applyForce(this.characterParts.torso, this.characterParts.torso.position, { x: -0.012, y: 0 });
    }
    
    // Counter-balance with right leg
    Matter.Body.applyForce(this.characterParts.rightFoot, this.characterParts.rightFoot.position, { x: 0, y: 0.01 });
  }

  // Apply right leg step forces
  applyRightLegStep(step) {
    if (step === 0) {
      Matter.Body.applyForce(this.characterParts.torso, this.characterParts.torso.position, { x: -0.01, y: -0.002 });
      Matter.Body.applyForce(this.characterParts.rightThigh, this.characterParts.rightThigh.position, { x: -0.004, y: -0.008 });
      Matter.Body.applyForce(this.characterParts.rightShin, this.characterParts.rightShin.position, { x: -0.003, y: -0.006 });
    } else if (step === 1) {
      Matter.Body.applyForce(this.characterParts.rightThigh, this.characterParts.rightThigh.position, { x: -0.01, y: 0 });
      Matter.Body.applyForce(this.characterParts.rightShin, this.characterParts.rightShin.position, { x: -0.007, y: 0.002 });
    } else if (step === 2) {
      Matter.Body.applyForce(this.characterParts.rightFoot, this.characterParts.rightFoot.position, { x: -0.008, y: 0.015 });
      Matter.Body.applyForce(this.characterParts.rightShin, this.characterParts.rightShin.position, { x: -0.006, y: 0.01 });
    } else if (step === 3) {
      Matter.Body.applyForce(this.characterParts.rightFoot, this.characterParts.rightFoot.position, { x: -0.015, y: -0.004 });
      Matter.Body.applyForce(this.characterParts.torso, this.characterParts.torso.position, { x: -0.012, y: 0 });
    }
    
    // Counter-balance with left leg
    Matter.Body.applyForce(this.characterParts.leftFoot, this.characterParts.leftFoot.position, { x: 0, y: 0.01 });
  }

  // Apply arm swinging
  applyArmSwing(rightArmForward) {
    if (rightArmForward) {
      Matter.Body.applyForce(this.characterParts.rightUpperArm, this.characterParts.rightUpperArm.position, { x: -0.003, y: 0 });
      Matter.Body.applyForce(this.characterParts.leftUpperArm, this.characterParts.leftUpperArm.position, { x: 0.002, y: 0 });
    } else {
      Matter.Body.applyForce(this.characterParts.leftUpperArm, this.characterParts.leftUpperArm.position, { x: -0.003, y: 0 });
      Matter.Body.applyForce(this.characterParts.rightUpperArm, this.characterParts.rightUpperArm.position, { x: 0.002, y: 0 });
    }
  }

  // Maintain upright posture
  maintainPosture() {
    const headTilt = this.characterParts.head.angle;
    if (Math.abs(headTilt) > 0.3) {
      Matter.Body.setAngularVelocity(this.characterParts.head, -headTilt * 0.8);
    }
  }

  // Stop walking
  stopWalking() {
    if (this.walkingInterval) {
      clearInterval(this.walkingInterval);
      this.walkingInterval = null;
    }
  }

  // Start climbing (teleport and reset)
  startClimbing() {
    console.log('🧗 Character reached ladder and will start climbing!');
    
    setTimeout(() => {
      console.log('🚀 Character jumping from ladder top!');
      
      // Reset character to top
      this.resetCharacterPosition();
      
      // Reset state machine
      this.stateMachine.reset();
      
    }, 3000); // Climb for 3 seconds then restart
  }

  // Reset character position to top
  resetCharacterPosition() {
    const startX = 400;
    const startY = 50;
    
    const resetPositions = [
      { part: 'head', x: startX, y: startY - 8 },
      { part: 'torso', x: startX, y: startY },
      { part: 'leftUpperArm', x: startX - 8, y: startY - 2 },
      { part: 'rightUpperArm', x: startX + 8, y: startY - 2 },
      { part: 'leftForearm', x: startX - 8, y: startY + 6 },
      { part: 'rightForearm', x: startX + 8, y: startY + 6 },
      { part: 'leftHand', x: startX - 8, y: startY + 12 },
      { part: 'rightHand', x: startX + 8, y: startY + 12 },
      { part: 'leftThigh', x: startX - 3, y: startY + 14 },
      { part: 'rightThigh', x: startX + 3, y: startY + 14 },
      { part: 'leftShin', x: startX - 3, y: startY + 24 },
      { part: 'rightShin', x: startX + 3, y: startY + 24 },
      { part: 'leftFoot', x: startX - 3, y: startY + 31 },
      { part: 'rightFoot', x: startX + 3, y: startY + 31 }
    ];
    
    resetPositions.forEach(({ part, x, y }) => {
      if (this.characterParts[part]) {
        Matter.Body.setPosition(this.characterParts[part], { x, y });
        Matter.Body.setVelocity(this.characterParts[part], { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(this.characterParts[part], 0);
        Matter.Body.setAngle(this.characterParts[part], 0);
      }
    });
  }

  // Cleanup
  cleanup() {
    this.stopWalking();
  }
}
