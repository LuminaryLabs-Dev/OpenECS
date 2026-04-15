const DEFAULT_PHASES = Object.freeze(["input", "simulate", "resolve", "cleanup"]);

function defineNamedType(kind, name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError(`${kind} name must be a non-empty string.`);
  }

  return Object.freeze({ kind, name });
}

function assertDefinition(definition, kind, factoryName) {
  if (!definition || definition.kind !== kind || typeof definition.name !== "string") {
    throw new TypeError(`${factoryName} expected a ${kind} definition.`);
  }
}

function createStoreAccessor(kind, storeMap) {
  return function ensureStore(definition) {
    assertDefinition(definition, kind, "OpenECS");

    if (!storeMap.has(definition.name)) {
      storeMap.set(definition.name, kind === "event" ? [] : new Map());
    }

    return storeMap.get(definition.name);
  };
}

function assertSystemFactoryConfig(definitions, keys, factoryName) {
  for (const [key, kind] of Object.entries(keys)) {
    assertDefinition(definitions[key], kind, factoryName);
  }
}

function assertPolicyMethod(policy, methodName, factoryName) {
  if (policy[methodName] !== undefined && typeof policy[methodName] !== "function") {
    throw new TypeError(`${factoryName} policy.${methodName} must be a function when provided.`);
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(vector) {
  const x = Number(vector?.x ?? 0);
  const y = Number(vector?.y ?? 0);
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function cloneVector(vector) {
  return { x: Number(vector?.x ?? 0), y: Number(vector?.y ?? 0) };
}

function applyPosition(position, nextPosition) {
  position.x = nextPosition.x;
  position.y = nextPosition.y;
}

function applyVelocity(velocity, nextVelocity) {
  velocity.x = nextVelocity.x;
  velocity.y = nextVelocity.y;
}

function defaultCollisionIntersection({ aPosition, aCollider, bPosition, bCollider }) {
  const dx = aPosition.x - bPosition.x;
  const dy = aPosition.y - bPosition.y;
  const combinedRadius = Number(aCollider.radius ?? 0) + Number(bCollider.radius ?? 0);
  return dx * dx + dy * dy <= combinedRadius * combinedRadius;
}

function defaultCollisionEvent({ aEntity, bEntity }) {
  return { pair: [aEntity, bEntity] };
}

export function defineComponent(name) {
  return defineNamedType("component", name);
}

export function defineResource(name) {
  return defineNamedType("resource", name);
}

export function defineEvent(name) {
  return defineNamedType("event", name);
}

export function createWorld() {
  const entities = new Set();
  const componentStores = new Map();
  const resourceValues = new Map();
  const eventQueues = new Map();
  let nextEntityId = 1;

  const ensureComponentStore = createStoreAccessor("component", componentStores);
  const ensureEventQueue = createStoreAccessor("event", eventQueues);

  function assertEntity(entity) {
    if (!entities.has(entity)) {
      throw new Error(`Unknown entity: ${entity}`);
    }
  }

  return {
    addEntity() {
      const entity = nextEntityId++;
      entities.add(entity);
      return entity;
    },

    removeEntity(entity) {
      if (!entities.delete(entity)) {
        return false;
      }

      for (const store of componentStores.values()) {
        store.delete(entity);
      }

      return true;
    },

    setComponent(entity, component, value) {
      assertEntity(entity);
      const store = ensureComponentStore(component);
      store.set(entity, value);
      return value;
    },

    getComponent(entity, component) {
      assertEntity(entity);
      return ensureComponentStore(component).get(entity);
    },

    hasComponent(entity, component) {
      assertEntity(entity);
      return ensureComponentStore(component).has(entity);
    },

    removeComponent(entity, component) {
      assertEntity(entity);
      return ensureComponentStore(component).delete(entity);
    },

    setResource(resource, value) {
      assertDefinition(resource, "resource", "OpenECS");
      resourceValues.set(resource.name, value);
      return value;
    },

    getResource(resource) {
      assertDefinition(resource, "resource", "OpenECS");
      return resourceValues.get(resource.name);
    },

    hasResource(resource) {
      assertDefinition(resource, "resource", "OpenECS");
      return resourceValues.has(resource.name);
    },

    removeResource(resource) {
      assertDefinition(resource, "resource", "OpenECS");
      return resourceValues.delete(resource.name);
    },

    emit(event, payload) {
      ensureEventQueue(event).push(payload);
      return payload;
    },

    readEvents(event) {
      return ensureEventQueue(event).slice();
    },

    clearEvents(event) {
      ensureEventQueue(event).length = 0;
    },

    clearAllEvents() {
      for (const queue of eventQueues.values()) {
        queue.length = 0;
      }
    },

    query(...components) {
      if (components.length === 0) {
        return Array.from(entities);
      }

      return Array.from(entities).filter((entity) =>
        components.every((component) => ensureComponentStore(component).has(entity))
      );
    },

    runSystem(components, handler) {
      if (!Array.isArray(components) || components.length === 0) {
        throw new TypeError("runSystem expects a non-empty component array.");
      }

      if (typeof handler !== "function") {
        throw new TypeError("runSystem expects a handler function.");
      }

      for (const entity of this.query(...components)) {
        const values = components.map((component) => ensureComponentStore(component).get(entity));
        handler(entity, ...values);
      }
    },

    get entityCount() {
      return entities.size;
    }
  };
}

export function createScheduler() {
  const phases = [];
  const systemsByPhase = new Map();

  function addPhase(name) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new TypeError("Scheduler phase name must be a non-empty string.");
    }

    if (!systemsByPhase.has(name)) {
      phases.push(name);
      systemsByPhase.set(name, []);
    }

    return scheduler;
  }

  const scheduler = {
    addPhase,

    addSystem(phaseName, system) {
      if (!systemsByPhase.has(phaseName)) {
        throw new Error(`Unknown phase: ${phaseName}`);
      }

      if (typeof system !== "function") {
        throw new TypeError("Scheduler systems must be functions.");
      }

      systemsByPhase.get(phaseName).push(system);
      return scheduler;
    },

    run(world) {
      if (!world || typeof world.clearAllEvents !== "function") {
        throw new TypeError("Scheduler requires a world created by createWorld().");
      }

      for (const phaseName of phases) {
        for (const system of systemsByPhase.get(phaseName)) {
          system(world);
        }
      }

      world.clearAllEvents();
      return world;
    },

    get phases() {
      return phases.slice();
    }
  };

  for (const phaseName of DEFAULT_PHASES) {
    addPhase(phaseName);
  }

  return scheduler;
}

export function createInputSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    InputIntent: "component",
    InputState: "resource"
  }, "createInputSystem");
  assertPolicyMethod(policy, "resolveIntent", "createInputSystem");

  const { InputIntent, InputState, ActorTag } = definitions;
  const queryComponents = ActorTag ? [InputIntent, ActorTag] : [InputIntent];

  return function inputSystem(world) {
    const inputState = world.getResource(InputState) ?? {};

    for (const entity of world.query(...queryComponents)) {
      const currentIntent = world.getComponent(entity, InputIntent);
      const actorTag = ActorTag ? world.getComponent(entity, ActorTag) : undefined;
      const nextIntent = policy.resolveIntent
        ? policy.resolveIntent({
            world,
            entity,
            inputState,
            currentIntent,
            actorTag
          })
        : cloneVector(inputState.intent);

      world.setComponent(entity, InputIntent, cloneVector(nextIntent));
    }
  };
}

export function createMovementSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    Position: "component",
    Velocity: "component",
    InputIntent: "component",
    Time: "resource",
    WorldBounds: "resource"
  }, "createMovementSystem");
  assertPolicyMethod(policy, "resolveVelocity", "createMovementSystem");
  assertPolicyMethod(policy, "integrate", "createMovementSystem");
  assertPolicyMethod(policy, "clampPosition", "createMovementSystem");

  const {
    Position,
    Velocity,
    InputIntent,
    Time,
    WorldBounds,
    MovementStats
  } = definitions;
  const queryComponents = MovementStats
    ? [Position, Velocity, InputIntent, MovementStats]
    : [Position, Velocity, InputIntent];

  return function movementSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 };
    const worldBounds = world.getResource(WorldBounds) ?? null;

    for (const entity of world.query(...queryComponents)) {
      const position = world.getComponent(entity, Position);
      const velocity = world.getComponent(entity, Velocity);
      const inputIntent = world.getComponent(entity, InputIntent);
      const movementStats = MovementStats ? world.getComponent(entity, MovementStats) : {};
      const normalizedIntent = normalizeVector(inputIntent);
      const nextVelocity = policy.resolveVelocity
        ? policy.resolveVelocity({
            world,
            entity,
            position,
            velocity,
            inputIntent,
            normalizedIntent,
            movementStats,
            time,
            worldBounds
          })
        : {
            x: normalizedIntent.x * Number(movementStats.speed ?? 0),
            y: normalizedIntent.y * Number(movementStats.speed ?? 0)
          };
      const integratedPosition = policy.integrate
        ? policy.integrate({
            world,
            entity,
            position,
            velocity,
            nextVelocity,
            movementStats,
            time,
            worldBounds
          })
        : {
            x: position.x + nextVelocity.x * Number(time.delta ?? 1),
            y: position.y + nextVelocity.y * Number(time.delta ?? 1)
          };
      const clampedPosition = policy.clampPosition
        ? policy.clampPosition({
            world,
            entity,
            position,
            velocity,
            nextVelocity,
            nextPosition: integratedPosition,
            movementStats,
            time,
            worldBounds
          })
        : worldBounds
          ? {
              x: clampNumber(integratedPosition.x, worldBounds.minX, worldBounds.maxX),
              y: clampNumber(integratedPosition.y, worldBounds.minY, worldBounds.maxY)
            }
          : integratedPosition;

      applyVelocity(velocity, cloneVector(nextVelocity));
      applyPosition(position, cloneVector(clampedPosition));
    }
  };
}

export function createCollisionSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    Position: "component",
    Collider: "component",
    CollisionEvent: "event"
  }, "createCollisionSystem");
  assertPolicyMethod(policy, "shouldCollide", "createCollisionSystem");
  assertPolicyMethod(policy, "intersects", "createCollisionSystem");
  assertPolicyMethod(policy, "buildEvent", "createCollisionSystem");
  assertPolicyMethod(policy, "resolveCollision", "createCollisionSystem");

  const { Position, Collider, CollisionEvent } = definitions;

  return function collisionSystem(world) {
    const entities = world.query(Position, Collider);

    for (let index = 0; index < entities.length; index += 1) {
      const aEntity = entities[index];
      const aPosition = world.getComponent(aEntity, Position);
      const aCollider = world.getComponent(aEntity, Collider);

      for (let otherIndex = index + 1; otherIndex < entities.length; otherIndex += 1) {
        const bEntity = entities[otherIndex];
        const bPosition = world.getComponent(bEntity, Position);
        const bCollider = world.getComponent(bEntity, Collider);
        const context = {
          world,
          aEntity,
          bEntity,
          aPosition,
          aCollider,
          bPosition,
          bCollider
        };

        if (policy.shouldCollide && policy.shouldCollide(context) === false) {
          continue;
        }

        const intersects = policy.intersects
          ? policy.intersects(context)
          : defaultCollisionIntersection(context);

        if (!intersects) {
          continue;
        }

        if (policy.resolveCollision) {
          policy.resolveCollision(context);
        }

        const eventPayload = policy.buildEvent
          ? policy.buildEvent(context)
          : defaultCollisionEvent(context);

        if (eventPayload) {
          world.emit(CollisionEvent, eventPayload);
        }
      }
    }
  };
}

export function createDamageSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    Health: "component",
    DamageOnContact: "component",
    CollisionEvent: "event",
    DamageEvent: "event"
  }, "createDamageSystem");
  assertPolicyMethod(policy, "shouldApplyDamage", "createDamageSystem");
  assertPolicyMethod(policy, "buildDamageEvents", "createDamageSystem");
  assertPolicyMethod(policy, "applyDamage", "createDamageSystem");

  const { Health, DamageOnContact, CollisionEvent, DamageEvent } = definitions;

  return function damageSystem(world) {
    for (const collision of world.readEvents(CollisionEvent)) {
      const [aEntity, bEntity] = collision.pair ?? [];
      const pairs = [
        { source: aEntity, target: bEntity },
        { source: bEntity, target: aEntity }
      ];

      for (const { source, target } of pairs) {
        if (!source || !target) {
          continue;
        }

        const sourceDamage = world.hasComponent(source, DamageOnContact)
          ? world.getComponent(source, DamageOnContact)
          : null;
        const targetHealth = world.hasComponent(target, Health)
          ? world.getComponent(target, Health)
          : null;

        if (!sourceDamage || !targetHealth) {
          continue;
        }

        const context = {
          world,
          collision,
          source,
          target,
          sourceDamage,
          targetHealth
        };

        if (policy.shouldApplyDamage && policy.shouldApplyDamage(context) === false) {
          continue;
        }

        const events = policy.buildDamageEvents
          ? policy.buildDamageEvents(context)
          : [{
              source,
              target,
              amount: Number(sourceDamage.amount ?? 0),
              type: "contact"
            }];

        for (const damageEvent of events) {
          if (!damageEvent || damageEvent.amount <= 0) {
            continue;
          }

          world.emit(DamageEvent, damageEvent);

          if (policy.applyDamage) {
            policy.applyDamage({
              world,
              damageEvent,
              targetHealth: world.getComponent(damageEvent.target, Health)
            });
          } else {
            const health = world.getComponent(damageEvent.target, Health);
            health.current -= Number(damageEvent.amount);
          }
        }
      }
    }
  };
}

export function createDeathSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    Health: "component",
    PendingDespawn: "component",
    DeathEvent: "event"
  }, "createDeathSystem");
  assertPolicyMethod(policy, "isDead", "createDeathSystem");
  assertPolicyMethod(policy, "buildDeathEvent", "createDeathSystem");
  assertPolicyMethod(policy, "markForDespawn", "createDeathSystem");

  const { Health, PendingDespawn, DeathEvent } = definitions;

  return function deathSystem(world) {
    for (const entity of world.query(Health)) {
      const health = world.getComponent(entity, Health);

      if (world.hasComponent(entity, PendingDespawn)) {
        continue;
      }

      const isDead = policy.isDead
        ? policy.isDead({ world, entity, health })
        : Number(health.current ?? 0) <= 0;

      if (!isDead) {
        continue;
      }

      const eventPayload = policy.buildDeathEvent
        ? policy.buildDeathEvent({ world, entity, health })
        : { entity };

      if (eventPayload) {
        world.emit(DeathEvent, eventPayload);
      }

      if (policy.markForDespawn) {
        policy.markForDespawn({ world, entity, health });
      } else {
        world.setComponent(entity, PendingDespawn, { reason: "health-depleted" });
      }
    }
  };
}

export function createDespawnSystem(definitions, policy = {}) {
  assertSystemFactoryConfig(definitions, {
    PendingDespawn: "component"
  }, "createDespawnSystem");
  assertPolicyMethod(policy, "shouldDespawn", "createDespawnSystem");
  assertPolicyMethod(policy, "beforeRemove", "createDespawnSystem");

  const { PendingDespawn } = definitions;

  return function despawnSystem(world) {
    for (const entity of world.query(PendingDespawn)) {
      const marker = world.getComponent(entity, PendingDespawn);
      const shouldDespawn = policy.shouldDespawn
        ? policy.shouldDespawn({ world, entity, marker })
        : true;

      if (!shouldDespawn) {
        continue;
      }

      if (policy.beforeRemove) {
        policy.beforeRemove({ world, entity, marker });
      }

      world.removeEntity(entity);
    }
  };
}

export { DEFAULT_PHASES };
