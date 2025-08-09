import Matter from 'matter-js';

// PoseController: Hybrid IK using invisible targets + constraints to drive the same ragdoll
export class PoseController {
  constructor(characterParts, world) {
    this.parts = characterParts;
    this.world = world;
    this.targets = {}; // name -> target body
    this.constraints = {}; // name -> constraint to target
    this.active = false;
    this.walkInterval = null;
    this.approachInterval = null;
    this.climbInterval = null;
    this.originalFrictionAir = new Map();
    this.baseOffsets = null; // local offsets from torso for each part
  }

  // Utility: compute local offsets from torso
  computeLocalOffsets() {
    const torso = this.parts.torso;
    const base = torso ? torso.position : { x: 0, y: 0 };
    const offsets = {};
    Object.entries(this.parts).forEach(([name, body]) => {
      if (!body) return;
      offsets[name] = { x: body.position.x - base.x, y: body.position.y - base.y };
    });
    return offsets;
  }

  // Enter animation mode: create static targets and constraints, increase damping
  enter() {
    if (this.active) return;
    this.baseOffsets = this.computeLocalOffsets();
    Object.values(this.parts).forEach((p) => {
      if (!p) return;
      this.originalFrictionAir.set(p.id, p.frictionAir ?? 0.02);
      p.frictionAir = 0.08;
    });

    Object.entries(this.parts).forEach(([name, body]) => {
      if (!body) return;
      const t = Matter.Bodies.circle(body.position.x, body.position.y, 1, {
        isStatic: true,
        collisionFilter: { mask: 0 },
        render: { visible: false }
      });
      this.targets[name] = t;
      const c = Matter.Constraint.create({
        bodyA: body,
        bodyB: t,
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: 0 },
        length: 0,
        stiffness: 0.98,
        damping: 0.4,
      });
      this.constraints[name] = c;
      Matter.World.add(this.world, [t, c]);
    });
    this.active = true;
  }

  // Leave animation mode: remove targets/constraints and restore damping
  leave() {
    if (!this.active) return;
    this.stopAll();
    Object.values(this.constraints).forEach((c) => c && Matter.World.remove(this.world, c));
    Object.values(this.targets).forEach((t) => t && Matter.World.remove(this.world, t));
    this.constraints = {};
    this.targets = {};
    this.active = false;
    Object.values(this.parts).forEach((p) => {
      if (!p) return;
      const prev = this.originalFrictionAir.get(p.id);
      p.frictionAir = prev != null ? prev : 0.02;
    });
  }

  stopAll() {
    if (this.walkInterval) { clearInterval(this.walkInterval); this.walkInterval = null; }
    if (this.approachInterval) { clearInterval(this.approachInterval); this.approachInterval = null; }
    if (this.climbInterval) { clearInterval(this.climbInterval); this.climbInterval = null; }
  }

  // Set all target positions from a base torso (x,y) and this.baseOffsets
  setRigBase(x, y) {
    if (!this.active || !this.baseOffsets) return;
    Object.entries(this.targets).forEach(([name, t]) => {
      const off = this.baseOffsets[name] || { x: 0, y: 0 };
      Matter.Body.setPosition(t, { x: x + off.x, y: y + off.y });
    });
  }

  // Directly set angles on real parts (angles are not constrained by target constraints)
  setAngles(angles) {
    Object.entries(angles).forEach(([name, a]) => {
      const body = this.parts[name];
      if (!body) return;
      Matter.Body.setAngle(body, a);
      Matter.Body.setAngularVelocity(body, 0);
    });
  }

  // Tween upright: move targets to upright offsets (matching initial design) and set upright angles
  tweenUpright(durationMs = 700, groundTopY = 560) {
    if (!this.active) return;
    // Desired upright offsets (from earlier small rig design)
    const uprightOffsets = {
      torso: { x: 0, y: 0 },
      head: { x: 0, y: -8 },
      leftUpperArm: { x: -8, y: -2 }, rightUpperArm: { x: 8, y: -2 },
      leftForearm: { x: -8, y: 6 }, rightForearm: { x: 8, y: 6 },
      leftHand: { x: -8, y: 12 }, rightHand: { x: 8, y: 12 },
      leftThigh: { x: -3, y: 14 }, rightThigh: { x: 3, y: 14 },
      leftShin: { x: -3, y: 24 }, rightShin: { x: 3, y: 24 },
      leftFoot: { x: -3, y: 31 }, rightFoot: { x: 3, y: 31 },
    };

    // Compute base Y so feet sit on ground
    const avgFootOffY = (uprightOffsets.leftFoot.y + uprightOffsets.rightFoot.y) / 2;
    const baseY = groundTopY - 1.5 - avgFootOffY;
    const torso = this.parts.torso;
    const baseX0 = torso ? torso.position.x : 400;
    const baseY0 = torso ? torso.position.y : 300;

    const steps = Math.max(8, Math.floor(durationMs / 16));
    let i = 0;
    this.walkInterval && clearInterval(this.walkInterval);
    const startOffsets = this.baseOffsets || this.computeLocalOffsets();
    this.walkInterval = setInterval(() => {
      i += 1;
      const t = Math.min(1, i / steps);
      // interpolate base towards (baseX0, baseY)
      const bx = baseX0;
      const by = baseY0 + (baseY - baseY0) * t;
      // interpolate offsets
      Object.entries(this.targets).forEach(([name, tgt]) => {
        const so = startOffsets[name] || { x: 0, y: 0 };
        const to = uprightOffsets[name] || so;
        const ox = so.x + (to.x - so.x) * t;
        const oy = so.y + (to.y - so.y) * t;
        Matter.Body.setPosition(tgt, { x: bx + ox, y: by + oy });
      });
      // set angles upright
      this.setAngles({
        torso: 0, head: 0, leftUpperArm: 0.05, rightUpperArm: -0.05,
        leftForearm: 0, rightForearm: 0, leftHand: 0, rightHand: 0,
        leftThigh: 0.06, rightThigh: -0.06, leftShin: -0.03, rightShin: 0.03,
        leftFoot: 0, rightFoot: 0,
      });
      if (i >= steps) {
        clearInterval(this.walkInterval);
        this.walkInterval = null;
        // Snap baseOffsets to upright so later run/climb use the same rig layout
        this.baseOffsets = uprightOffsets;
        // Ensure targets are exactly at upright pose
        Object.entries(this.targets).forEach(([name, tgt]) => {
          const off = uprightOffsets[name] || { x: 0, y: 0 };
          Matter.Body.setPosition(tgt, { x: bx + off.x, y: by + off.y });
        });
      }
    }, 16);
  }

  // Animation-driven run using targets for position and angles on real parts
  playRun(speedPxPerSec = 95, onReachedLadder, groundTopY = 560) {
    if (!this.active) return;
    if (this.walkInterval) { clearInterval(this.walkInterval); this.walkInterval = null; }
    const torso = this.parts.torso;
    const startTime = Date.now();
    const periodMs = 480;
    const footHalf = 1.5;
    const targetFootCenterY = groundTopY - footHalf;
    const baseOffsets = this.baseOffsets || this.computeLocalOffsets();
    this.walkInterval = setInterval(() => {
      const now = Date.now();
      const t = ((now - startTime) % periodMs) / periodMs * Math.PI * 2;
      // Gait
      const A_thigh = 0.32, A_shin = 0.18, A_foot = 0.05, A_arm = 0.22;
      const angles = {
        leftThigh: A_thigh * Math.sin(t),
        rightThigh: -A_thigh * Math.sin(t),
        leftShin: -A_shin * Math.sin(t + Math.PI / 2) - 0.04,
        rightShin: A_shin * Math.sin(t + Math.PI / 2) + 0.04,
        leftFoot: A_foot * Math.sin(t + Math.PI / 2),
        rightFoot: -A_foot * Math.sin(t + Math.PI / 2),
        leftUpperArm: -A_arm * Math.sin(t),
        rightUpperArm: A_arm * Math.sin(t),
        leftForearm: 0, rightForearm: 0, leftHand: 0, rightHand: 0,
        head: 0, torso: -0.12 + 0.03 * Math.sin(t),
      };
      this.setAngles(angles);
      // Move base left, clamp feet to ground
      const dt = 0.016, dx = -speedPxPerSec * dt;
      const baseX = torso ? torso.position.x + dx : 0;
      const lf = (baseOffsets.leftFoot && baseOffsets.leftFoot.y) ?? 31;
      const rf = (baseOffsets.rightFoot && baseOffsets.rightFoot.y) ?? 31;
      const avgFootOffY = (lf + rf) / 2;
      const baseY = targetFootCenterY - avgFootOffY;
      Object.entries(this.targets).forEach(([name, tgt]) => {
        const off = baseOffsets[name] || { x: 0, y: 0 };
        Matter.Body.setPosition(tgt, { x: baseX + off.x, y: baseY + off.y });
      });
      if (torso && torso.position.x <= 120) {
        clearInterval(this.walkInterval);
        this.walkInterval = null;
        onReachedLadder && onReachedLadder();
      }
    }, 16);
  }

  // Climb towards top using targets
  playClimb({ ladderX = 50, topY = 90, rungSpacing = 60 } = {}, onDone) {
    if (!this.active) return;
    const parts = this.parts;
    const baseOffsets = this.baseOffsets || this.computeLocalOffsets();
    // Approach ladder center X
    if (this.approachInterval) { clearInterval(this.approachInterval); this.approachInterval = null; }
    this.approachInterval = setInterval(() => {
      const torso = parts.torso;
      if (!torso) return;
      const x = torso.position.x;
      if (x <= ladderX) {
        clearInterval(this.approachInterval);
        this.approachInterval = null;
        // Start climbing up
        let step = 0;
        if (this.climbInterval) { clearInterval(this.climbInterval); this.climbInterval = null; }
        this.climbInterval = setInterval(() => {
          const torsoNow = parts.torso;
          if (!torsoNow) return;
          if (torsoNow.position.y <= topY) {
            clearInterval(this.climbInterval);
            this.climbInterval = null;
            onDone && onDone();
            return;
          }
          // Rung step
          const phase = step % 2; // alternate
          const armAngle = phase === 0 ? -0.4 : 0.4;
          const legAngle = phase === 0 ? -0.2 : 0.2;
          this.setAngles({
            leftUpperArm: phase === 0 ? armAngle : 0.1,
            rightUpperArm: phase === 1 ? -armAngle : -0.1,
            leftThigh: phase === 0 ? legAngle : 0.05,
            rightThigh: phase === 1 ? -legAngle : -0.05,
            torso: -0.05,
          });
          // Move targets to ladder X and up by rung step
          Object.entries(this.targets).forEach(([name, tgt]) => {
            const off = baseOffsets[name] || { x: 0, y: 0 };
            Matter.Body.setPosition(tgt, { x: ladderX + off.x, y: tgt.position.y - rungSpacing / 2 });
          });
          step += 1;
        }, 220);
      } else {
        // Slide targets towards ladderX keeping ground contact
        const torsoY = parts.torso ? parts.torso.position.y : 300;
        Object.entries(this.targets).forEach(([name, tgt]) => {
          const off = baseOffsets[name] || { x: 0, y: 0 };
          Matter.Body.setPosition(tgt, { x: Math.max(ladderX + off.x, tgt.position.x - 3), y: tgt.position.y });
        });
      }
    }, 16);
  }
}

export default PoseController;


