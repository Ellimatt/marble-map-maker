// Shared contact behavior for the editor and race. Time is simulation time.
export function attachMarbleTeleports(Matter, engine, portals, marbles) {
  const { Body, Events, Query } = Matter;
  const byBody = new Map(portals.map(portal => [portal.body.id, portal]));
  const marbleSet = new Set(marbles), blocked = new WeakSet(), nextAllowed = new WeakMap();
  const sensors = portals.map(portal => portal.body);
  const beforeUpdate = () => {
    for (const marble of marbles) {
      // A destination inside another block cannot cause an endless loop.
      // Re-arm only after leaving all teleport blocks, as well as cooldown.
      if (blocked.has(marble) && !Query.collides(marble, sensors).length) blocked.delete(marble);
    }
  };
  const collide = ({ pairs }) => {
    const now = engine.timing.timestamp;
    for (const pair of pairs) {
      const portal = byBody.get(pair.bodyA.id) || byBody.get(pair.bodyB.id);
      if (!portal) continue;
      const marble = pair.bodyA === portal.body ? pair.bodyB : pair.bodyA;
      if (!marbleSet.has(marble) || marble.plugin.portalFinished || marble.collisionFilter.category === 2 || blocked.has(marble) || now < (nextAllowed.get(marble) ?? 0)) continue;
      const velocity = { ...marble.velocity }, angularVelocity = marble.angularVelocity;
      Body.setPosition(marble, portal.destination);
      Body.setVelocity(marble, velocity);
      Body.setAngularVelocity(marble, angularVelocity);
      // Clear solver corrections from the marble's old location.
      marble.positionImpulse.x = marble.positionImpulse.y = 0;
      // Detection happened at the entry location. Do not solve old wall
      // contacts against the newly teleported position in this same step.
      for (const oldPair of engine.pairs.list) {
        if (oldPair.bodyA === marble || oldPair.bodyB === marble) oldPair.isActive = false;
      }
      marble.plugin.teleportedAt = now;
      blocked.add(marble); nextAllowed.set(marble, now + 300);
    }
  };
  Events.on(engine, "beforeUpdate", beforeUpdate);
  Events.on(engine, "collisionStart", collide);
  Events.on(engine, "collisionActive", collide);
  return () => {
    Events.off(engine, "beforeUpdate", beforeUpdate);
    Events.off(engine, "collisionStart", collide);
    Events.off(engine, "collisionActive", collide);
  };
}
