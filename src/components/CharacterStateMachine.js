/**
 * CharacterStateMachine - Manages character state transitions and timing
 */
import Matter from 'matter-js';

export class CharacterStateMachine {
  constructor(characterParts, setCharacterState, setDialogue, setBounceCount) {
    this.characterParts = characterParts;
    this.setCharacterState = setCharacterState;
    this.setDialogue = setDialogue;
    this.setBounceCount = setBounceCount;
    
    // State tracking
    this.currentState = 'falling';
    this.bounceCount = 0;
    this.timers = [];
    this.physicsController = null; // Will be set later
    this.animationController = null;
    this.defaultCollisionMask = new Map();
    
    // Character dimensions for bounce calculation
    this.characterHeight = 39; // From head (y-8) to feet (y+31)

    // Save default collision masks
    Object.values(this.characterParts).forEach((part) => {
      if (part && part.collisionFilter) {
        this.defaultCollisionMask.set(part.id, part.collisionFilter.mask);
      }
    });
  }

  // Set physics controller reference
  setPhysicsController(physicsController) {
    this.physicsController = physicsController;
  }

  // Set animation controller reference
  setAnimationController(animationController) {
    this.animationController = animationController;
  }

  // Clean up all timers
  cleanup() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
  }

  // Bounce removed per requirement
  handleBounce() { return null; }

  // Start settlement immediately on first landing → stand instantly → walk slowly
  startSettlement() {
    // Idempotent guard: run this once
    if (this.currentState !== 'falling' && this.currentState !== 'bouncing') {
      console.log(`ℹ️ Settlement ignored: already in state ${this.currentState}`);
      return;
    }

    console.log('🛑 Starting settlement sequence...');

    // Instant stop all movement
    Object.values(this.characterParts).forEach(part => {
      Matter.Body.setVelocity(part, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(part, 0);
    });

    // Stand up immediately
    this.currentState = 'standing';
    this.setCharacterState('standing');
    console.log('🧍 Standing up immediately...');
    if (this.animationController) {
      // Freeze bodies for animation and tween full pose (angles + offsets)
      this.animationController.setStaticForAnimation(true);
      this.animationController.tweenToUprightPose(700, () => {
        console.log('✅ Upright pose reached');
      });
    }

    // Hold 2000ms, then dialogue 2000ms, then walk
    const holdTimer = setTimeout(() => {
      this.startDialogue();
    }, 2000);
    this.timers.push(holdTimer);
  }

  // Standing up animation
  startStandingUp() {
    this.currentState = 'standing';
    this.setCharacterState('standing');
    console.log('🧍 Standing up: Straightening legs and torso...');
    
    // Snap to a clean upright pose immediately (prevents wobble)
    if (this.physicsController) {
      if (typeof this.physicsController.animateStandUp === 'function') {
        this.physicsController.animateStandUp(1200);
      } else if (typeof this.physicsController.standUpPose === 'function') {
        this.physicsController.standUpPose();
      }
    }
    
    // Hold standing for 2000 ms, no movement (visible get-up already applied)
    const dialogueTimer = setTimeout(() => {
      this.startDialogue();
    }, 2000);
    
    this.timers.push(dialogueTimer);
  }

  // Apply gentle forces to stand up
  applyStandingForces() {
    const standingInterval = setInterval(() => {
      if (this.currentState !== 'standing') {
        clearInterval(standingInterval);
        return;
      }
      
      // Straighten legs - apply gentle upward forces
      const legForce = { x: 0, y: -0.005 };
      Matter.Body.applyForce(this.characterParts.leftThigh, this.characterParts.leftThigh.position, legForce);
      Matter.Body.applyForce(this.characterParts.rightThigh, this.characterParts.rightThigh.position, legForce);
      Matter.Body.applyForce(this.characterParts.leftShin, this.characterParts.leftShin.position, legForce);
      Matter.Body.applyForce(this.characterParts.rightShin, this.characterParts.rightShin.position, legForce);
      
      // Rotate torso to vertical
      const torsoAngle = this.characterParts.torso.angle;
      if (Math.abs(torsoAngle) > 0.1) {
        Matter.Body.setAngularVelocity(this.characterParts.torso, -torsoAngle * 0.3);
      }
      
      // Straighten head
      const headAngle = this.characterParts.head.angle;
      if (Math.abs(headAngle) > 0.1) {
        Matter.Body.setAngularVelocity(this.characterParts.head, -headAngle * 0.3);
      }
      
    }, 50);
    
    // Stop standing forces after 1 second
    setTimeout(() => clearInterval(standingInterval), 1000);
  }

  // Start dialogue
  startDialogue() {
    this.currentState = 'speaking';
    this.setCharacterState('speaking');
    this.setDialogue('Uh oh, I\'m not dead!');
    console.log('💬 Speaking dialogue...');
    
    // Dialogue → 2000 ms → Start walking
    const walkingTimer = setTimeout(() => {
      this.setDialogue('');
      this.startWalking();
    }, 2000);
    
    this.timers.push(walkingTimer);
  }

  // Start walking
  startWalking() {
    this.currentState = 'walking';
    this.setCharacterState('walking');
    console.log('🚶 Starting to walk (animation)...');
    // Animation-driven walk
    if (this.animationController) {
      this.animationController.playWalk(28, () => {
        this.startClimb();
      });
    }
    
    // No dialogue in simplified flow
  }

  startClimb() {
    this.currentState = 'climbing';
    this.setCharacterState('climbing');
    console.log('🧗 Start climbing...');
    if (this.animationController) {
      // Ladder geometry from GameCanvas: ladderX=50, rungs spacing=60, top ~90
      this.animationController.playClimb({ ladderX: 50, topY: 90, rungSpacing: 60 }, () => {
        this.jumpFromTop();
      });
    }
  }

  jumpFromTop() {
    console.log('🪂 Jumping from ladder top! Restoring physics...');
    if (this.animationController) {
      this.animationController.stopAll();
      this.animationController.restoreDynamic();
    }
    const parts = this.characterParts;
    // Nudge away from ladder and slightly upward to avoid immediate overlap
    Object.values(parts).forEach((p) => {
      if (!p) return;
      Matter.Body.setPosition(p, { x: p.position.x + 6, y: p.position.y - 6 });
      Matter.Body.setVelocity(p, { x: 4, y: -6 });
      Matter.Body.setAngularVelocity(p, (Math.random() - 0.5) * 0.4);
    });

    // Temporarily disable collisions (especially with ladder) to avoid snagging
    this._temporarilyDisableCollisions(500);

    this.currentState = 'falling';
    this.setCharacterState('falling');
    this.bounceCount = 0;
  }

  _temporarilyDisableCollisions(durationMs = 400) {
    const restoreList = [];
    Object.values(this.characterParts).forEach((part) => {
      if (!part || !part.collisionFilter) return;
      restoreList.push({ part, mask: part.collisionFilter.mask });
      part.collisionFilter.mask = 0; // collide with nothing temporarily
    });
    setTimeout(() => {
      restoreList.forEach(({ part, mask }) => {
        if (!part || !part.collisionFilter) return;
        // Restore to original mask if available, else use saved defaults
        const saved = this.defaultCollisionMask.get(part.id);
        part.collisionFilter.mask = saved != null ? saved : mask;
      });
    }, durationMs);
  }

  // Reset for new cycle
  reset() {
    this.cleanup();
    this.currentState = 'falling';
    this.bounceCount = 0;
    this.setBounceCount(0);
    this.setCharacterState('falling');
    this.setDialogue('');
    console.log('🔄 State machine reset');
  }

  // Get current state
  getState() {
    return this.currentState;
  }
}
