import Matter from 'matter-js';

export class AnimationController {
  constructor(characterParts) {
    this.characterParts = characterParts;
    this.walkInterval = null;
    this.approachInterval = null;
    this.climbInterval = null;
  }

  setStaticForAnimation(isStatic) {
    Object.values(this.characterParts).forEach((part) => {
      if (!part) return;
      Matter.Body.setVelocity(part, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(part, 0);
      Matter.Body.setStatic(part, isStatic);
    });
  }

  restoreDynamic() {
    Object.values(this.characterParts).forEach((part) => {
      if (!part) return;
      Matter.Body.setStatic(part, false);
    });
  }

  stopAll() {
    if (this.walkInterval) {
      clearInterval(this.walkInterval);
      this.walkInterval = null;
    }
    if (this.approachInterval) {
      clearInterval(this.approachInterval);
      this.approachInterval = null;
    }
    if (this.climbInterval) {
      clearInterval(this.climbInterval);
      this.climbInterval = null;
    }
  }

  tweenAngles(targetAngles, durationMs = 600, onDone) {
    const parts = this.characterParts;
    const keys = Object.keys(targetAngles);
    const startAngles = {};
    keys.forEach((k) => {
      const body = parts[k];
      startAngles[k] = body ? body.angle : 0;
    });

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const steps = Math.max(8, Math.floor(durationMs / 16));
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      const t = clamp(i / steps, 0, 1);
      keys.forEach((k) => {
        const body = parts[k];
        if (!body) return;
        const a0 = startAngles[k];
        const a1 = targetAngles[k];
        const a = a0 + (a1 - a0) * t;
        Matter.Body.setAngle(body, a);
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
      });
      if (i >= steps) {
        clearInterval(id);
        if (onDone) onDone();
      }
    }, Math.max(16, Math.floor(durationMs / steps)));
  }

  // Compute current local offsets of each part relative to torso
  _computeLocalOffsets() {
    const parts = this.characterParts;
    const torso = parts.torso;
    const base = torso ? torso.position : { x: 0, y: 0 };
    const offsets = {};
    Object.entries(parts).forEach(([name, body]) => {
      if (!body) return;
      offsets[name] = {
        x: body.position.x - base.x,
        y: body.position.y - base.y,
      };
    });
    return { base, offsets };
  }

  // Tween both angles and offsets to a target pose relative to torso
  tweenPose(targetPose, durationMs = 700, onDone) {
    const parts = this.characterParts;
    const { base, offsets: startOffsets } = this._computeLocalOffsets();
    const startAngles = {};
    Object.keys(parts).forEach((k) => {
      const body = parts[k];
      startAngles[k] = body ? body.angle : 0;
    });

    const keys = Object.keys(targetPose);
    const steps = Math.max(8, Math.floor(durationMs / 16));
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      const t = Math.min(1, i / steps);
      keys.forEach((k) => {
        const spec = targetPose[k];
        const body = parts[k];
        if (!body || !spec) return;
        const targetAngle = spec.angle != null ? spec.angle : startAngles[k];
        const startAngle = startAngles[k];
        const a = startAngle + (targetAngle - startAngle) * t;
        Matter.Body.setAngle(body, a);

        // Interpolate offset relative to torso
        const so = startOffsets[k] || { x: 0, y: 0 };
        const to = spec.offset || so;
        const ox = so.x + (to.x - so.x) * t;
        const oy = so.y + (to.y - so.y) * t;
        Matter.Body.setPosition(body, { x: base.x + ox, y: base.y + oy });
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
      });

      if (i >= steps) {
        clearInterval(id);
        if (onDone) onDone();
      }
    }, Math.max(16, Math.floor(durationMs / steps)));
  }

  // Convenience: upright pose matching initial spawn layout and desired angles
  tweenToUprightPose(durationMs = 700, onDone) {
    const pose = {
      torso: { angle: 0, offset: { x: 0, y: 0 } },
      head: { angle: 0, offset: { x: 0, y: -8 } },
      leftUpperArm: { angle: 0.05, offset: { x: -8, y: -2 } },
      rightUpperArm: { angle: -0.05, offset: { x: 8, y: -2 } },
      leftForearm: { angle: 0, offset: { x: -8, y: 6 } },
      rightForearm: { angle: 0, offset: { x: 8, y: 6 } },
      leftHand: { angle: 0, offset: { x: -8, y: 12 } },
      rightHand: { angle: 0, offset: { x: 8, y: 12 } },
      leftThigh: { angle: 0.06, offset: { x: -3, y: 14 } },
      rightThigh: { angle: -0.06, offset: { x: 3, y: 14 } },
      leftShin: { angle: -0.03, offset: { x: -3, y: 24 } },
      rightShin: { angle: 0.03, offset: { x: 3, y: 24 } },
      leftFoot: { angle: 0, offset: { x: -3, y: 31 } },
      rightFoot: { angle: 0, offset: { x: 3, y: 31 } },
    };
    this.tweenPose(pose, durationMs, onDone);
  }

  hold(durationMs = 1000, onDone) {
    setTimeout(() => onDone && onDone(), durationMs);
  }

  playWalk(speedPxPerSec = 30, onReachedLadder) {
    // Stop existing
    if (this.walkInterval) {
      clearInterval(this.walkInterval);
      this.walkInterval = null;
    }
    const parts = this.characterParts;
    const torso = parts.torso;
    const startTime = Date.now();
    const periodMs = 800; // one full gait cycle

    // Cache upright offsets so rig stays coherent during walk
    const { offsets: baseOffsets } = this._computeLocalOffsets();
    // Ground clamp
    const groundTopY = 560;
    const footHalf = 1.5; // matches foot height 3
    const targetFootCenterY = groundTopY - footHalf;

    this.walkInterval = setInterval(() => {
      const now = Date.now();
      const phase = ((now - startTime) % periodMs) / periodMs; // 0..1
      const swing = Math.sin(phase * Math.PI * 2);
      // Angles (subtle swing)
      const angles = {
        leftThigh: 0.12 * swing,
        rightThigh: -0.12 * swing,
        leftShin: -0.06 * swing,
        rightShin: 0.06 * swing,
        leftFoot: 0.015 * swing,
        rightFoot: -0.015 * swing,
        leftUpperArm: -0.08 * swing,
        rightUpperArm: 0.08 * swing,
        leftForearm: 0,
        rightForearm: 0,
        leftHand: 0,
        rightHand: 0,
        head: 0,
        torso: 0,
      };
      Object.entries(angles).forEach(([k, a]) => {
        const b = parts[k];
        if (!b) return;
        Matter.Body.setAngle(b, a);
      });

      // Compute new torso base position and reconstruct all parts from upright offsets
      const dt = 0.016; // ~60 FPS
      const dx = -speedPxPerSec * dt;
      const baseX = torso ? torso.position.x + dx : 0;
      // Clamp vertical so feet stay on ground
      const leftFootOffY = baseOffsets.leftFoot ? baseOffsets.leftFoot.y : 31;
      const rightFootOffY = baseOffsets.rightFoot ? baseOffsets.rightFoot.y : 31;
      const avgFootOffY = (leftFootOffY + rightFootOffY) / 2;
      const baseY = targetFootCenterY - avgFootOffY;

      Object.entries(parts).forEach(([name, body]) => {
        if (!body) return;
        const off = baseOffsets[name] || { x: 0, y: 0 };
        Matter.Body.setPosition(body, { x: baseX + off.x, y: baseY + off.y });
      });

      // Stop near ladder
      if (torso && torso.position.x <= 120) {
        clearInterval(this.walkInterval);
        this.walkInterval = null;
        if (onReachedLadder) onReachedLadder();
      }
    }, 16);
  }

  // Simple rung-by-rung climb: move to ladder X, then step torso and limbs up by rungSpacing until topY
  playClimb({ ladderX = 50, topY = 90, rungSpacing = 60 } = {}, onDone) {
    // Ensure static animation mode
    this.setStaticForAnimation(true);
    const parts = this.characterParts;
    const torso = parts.torso;
    if (!torso) return;

    // Move horizontally to ladder first
    if (this.approachInterval) clearInterval(this.approachInterval);
    console.log(`🏁 Climb approach: moving to ladder x=${ladderX}`);
    this.approachInterval = setInterval(() => {
      const x = torso.position.x;
      if (x <= ladderX) {
        clearInterval(this.approachInterval);
        this.approachInterval = null;
        this._climbUp({ ladderX, topY, rungSpacing }, onDone);
      } else {
        const dx = -3; // move left
        Object.values(parts).forEach((p) => {
          if (!p) return;
          Matter.Body.setPosition(p, { x: p.position.x + dx, y: p.position.y });
        });
      }
    }, 16);
  }

  _climbUp({ ladderX, topY, rungSpacing }, onDone) {
    const parts = this.characterParts;
    const getBase = () => ({ x: ladderX, y: parts.torso ? parts.torso.position.y : 300 });
    console.log(`🧗 Climb start: target topY=${topY}, rungSpacing=${rungSpacing}`);
    const cycle = [
      // Left hand/foot up
      {
        deltas: {
          leftUpperArm: { angle: -0.4 }, rightUpperArm: { angle: 0.1 },
          leftThigh: { angle: -0.2 }, rightThigh: { angle: 0.05 },
        }, dy: -rungSpacing / 2
      },
      // Right hand/foot up
      {
        deltas: {
          leftUpperArm: { angle: 0.1 }, rightUpperArm: { angle: -0.4 },
          leftThigh: { angle: 0.05 }, rightThigh: { angle: -0.2 },
        }, dy: -rungSpacing / 2
      }
    ];

    let step = 0;
    if (this.climbInterval) clearInterval(this.climbInterval);
    this.climbInterval = setInterval(() => {
      const torso = parts.torso;
      if (!torso) { clearInterval(stepInterval); return; }
      if (torso.position.y <= topY) {
        console.log('🏔️ Reached ladder top');
        clearInterval(this.climbInterval);
        this.climbInterval = null;
        if (onDone) onDone();
        return;
      }

      const base = getBase();
      const phase = cycle[step % cycle.length];
      // Apply small pose changes
      Object.entries(phase.deltas).forEach(([name, spec]) => {
        const body = parts[name];
        if (!body || spec.angle == null) return;
        Matter.Body.setAngle(body, spec.angle);
      });
      // Move the whole rig up by dy and snap x to ladderX
      const dy = phase.dy;
      Object.values(parts).forEach((p) => {
        if (!p) return;
        Matter.Body.setPosition(p, { x: ladderX, y: p.position.y + dy });
      });

      step += 1;
    }, 250);
  }
}

export default AnimationController;


