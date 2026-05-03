import {
  createScheduler,
  createWorld,
  defineComponent,
  defineEvent,
  defineResource
} from "openecs-js";

export const GAMEKIT_SYSTEM_SPECS = Object.freeze([
  Object.freeze({ name: "ControlSystem", phase: "input" }),
  Object.freeze({ name: "SpawnSystem", phase: "input" }),
  Object.freeze({ name: "VelocitySystem", phase: "simulate" }),
  Object.freeze({ name: "AnchorSystem", phase: "simulate" }),
  Object.freeze({ name: "CinemaSystem", phase: "resolve" }),
  Object.freeze({ name: "LightSystem", phase: "resolve" }),
  Object.freeze({ name: "SkyboxSystem", phase: "resolve" }),
  Object.freeze({ name: "BillboardSystem", phase: "resolve" }),
  Object.freeze({ name: "RenderSyncSystem", phase: "resolve" }),
  Object.freeze({ name: "LifetimeSystem", phase: "cleanup" })
]);

export function createGameKitDefinitions() {
  return Object.freeze({
    Transform: defineComponent("gamekit.transform"),
    Velocity: defineComponent("gamekit.velocity"),
    ControlIntent: defineComponent("gamekit.control-intent"),
    SpawnRequest: defineComponent("gamekit.spawn-request"),
    Anchor: defineComponent("gamekit.anchor"),
    CameraRig: defineComponent("gamekit.camera-rig"),
    CinemaShot: defineComponent("gamekit.cinema-shot"),
    LightRig: defineComponent("gamekit.light-rig"),
    SkyboxRef: defineComponent("gamekit.skybox-ref"),
    Billboard: defineComponent("gamekit.billboard"),
    Renderable: defineComponent("gamekit.renderable"),
    Lifetime: defineComponent("gamekit.lifetime"),
    ActiveCamera: defineResource("gamekit.active-camera"),
    InputState: defineResource("gamekit.input-state"),
    SpawnQueue: defineResource("gamekit.spawn-queue"),
    Time: defineResource("gamekit.time")
  });
}

function clampLerp(value) {
  return Math.max(0, Math.min(1, Number(value ?? 0)));
}

function readTransform(world, entity, Transform) {
  return world.getComponent(entity, Transform);
}

export function createControlSystem(definitions, policy = {}) {
  const { ControlIntent, InputState } = definitions;

  return function controlSystem(world) {
    const inputState = world.getResource(InputState) ?? {};

    for (const entity of world.query(ControlIntent)) {
      const currentIntent = world.getComponent(entity, ControlIntent) ?? {};
      const nextIntent = policy.resolveIntent
        ? policy.resolveIntent({ world, entity, inputState, currentIntent })
        : {
            thrust: Number(inputState.thrust ?? 0),
            strafe: Number(inputState.strafe ?? 0),
            lift: Number(inputState.lift ?? 0),
            yaw: Number(inputState.yaw ?? 0),
            pitch: Number(inputState.pitch ?? 0),
            roll: Number(inputState.roll ?? 0),
            boost: Boolean(inputState.boost)
          };

      world.setComponent(entity, ControlIntent, nextIntent);
    }
  };
}

export function createSpawnSystem(definitions, policy = {}) {
  const { SpawnQueue } = definitions;

  return function spawnSystem(world) {
    const spawnQueue = world.getResource(SpawnQueue) ?? [];

    while (spawnQueue.length > 0) {
      const request = spawnQueue.shift();
      if (!request) {
        continue;
      }

      if (policy.spawn) {
        policy.spawn({ world, request });
      }
    }
  };
}

export function createVelocitySystem(definitions, policy = {}) {
  const { Transform, Velocity, Time } = definitions;

  return function velocitySystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = Number(time.delta ?? 1 / 60);

    for (const entity of world.query(Transform, Velocity)) {
      const transform = readTransform(world, entity, Transform);
      const velocity = world.getComponent(entity, Velocity);

      if (policy.integrate) {
        policy.integrate({ world, entity, transform, velocity, delta });
        continue;
      }

      transform.position.x += Number(velocity.x ?? 0) * delta;
      transform.position.y += Number(velocity.y ?? 0) * delta;
      transform.position.z += Number(velocity.z ?? 0) * delta;
    }
  };
}

export function createAnchorSystem(definitions, policy = {}) {
  const { Transform, Anchor } = definitions;

  return function anchorSystem(world) {
    for (const entity of world.query(Transform, Anchor)) {
      const transform = readTransform(world, entity, Transform);
      const anchor = world.getComponent(entity, Anchor);
      const target = anchor.target && world.hasComponent(anchor.target, Transform)
        ? world.getComponent(anchor.target, Transform)
        : null;

      if (!target) {
        continue;
      }

      if (policy.resolveAnchor) {
        policy.resolveAnchor({ world, entity, transform, anchor, target });
        continue;
      }

      transform.position.x = target.position.x + Number(anchor.offsetX ?? 0);
      transform.position.y = target.position.y + Number(anchor.offsetY ?? 0);
      transform.position.z = target.position.z + Number(anchor.offsetZ ?? 0);
    }
  };
}

export function createCinemaSystem(definitions, policy = {}) {
  const { Transform, CameraRig, CinemaShot, ActiveCamera } = definitions;

  return function cinemaSystem(world) {
    const activeCamera = world.getResource(ActiveCamera);
    if (!activeCamera) {
      return;
    }

    for (const entity of world.query(Transform, CameraRig, CinemaShot)) {
      const transform = readTransform(world, entity, Transform);
      const cameraRig = world.getComponent(entity, CameraRig);
      const cinemaShot = world.getComponent(entity, CinemaShot);

      if (policy.composeShot) {
        policy.composeShot({ world, entity, transform, cameraRig, cinemaShot, activeCamera });
        continue;
      }

      const blend = clampLerp(cinemaShot.blend ?? 0.12);
      activeCamera.position.x += (transform.position.x + Number(cameraRig.offsetX ?? 0) - activeCamera.position.x) * blend;
      activeCamera.position.y += (transform.position.y + Number(cameraRig.offsetY ?? 0) - activeCamera.position.y) * blend;
      activeCamera.position.z += (transform.position.z + Number(cameraRig.offsetZ ?? 0) - activeCamera.position.z) * blend;
      activeCamera.lookAt = {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z
      };
      activeCamera.fov = Number(cinemaShot.fov ?? activeCamera.fov ?? 60);
    }
  };
}

export function createLightSystem(definitions, policy = {}) {
  const { Transform, LightRig } = definitions;

  return function lightSystem(world) {
    for (const entity of world.query(Transform, LightRig)) {
      const transform = readTransform(world, entity, Transform);
      const lightRig = world.getComponent(entity, LightRig);
      const light = lightRig.light ?? null;

      if (!light) {
        continue;
      }

      if (policy.syncLight) {
        policy.syncLight({ world, entity, transform, lightRig, light });
        continue;
      }

      light.position.set(transform.position.x, transform.position.y, transform.position.z);
      if (lightRig.intensity !== undefined) {
        light.intensity = Number(lightRig.intensity);
      }
      if (lightRig.color !== undefined) {
        light.color.set(lightRig.color);
      }
    }
  };
}

export function createSkyboxSystem(definitions, policy = {}) {
  const { ActiveCamera, SkyboxRef } = definitions;

  return function skyboxSystem(world) {
    const activeCamera = world.getResource(ActiveCamera);
    if (!activeCamera) {
      return;
    }

    for (const entity of world.query(SkyboxRef)) {
      const skyboxRef = world.getComponent(entity, SkyboxRef);
      const skybox = skyboxRef.skybox ?? null;

      if (!skybox) {
        continue;
      }

      if (policy.syncSkybox) {
        policy.syncSkybox({ world, entity, activeCamera, skyboxRef, skybox });
        continue;
      }

      skybox.position.set(activeCamera.position.x, activeCamera.position.y, activeCamera.position.z);
    }
  };
}

export function createBillboardSystem(definitions, policy = {}) {
  const { Transform, Billboard, ActiveCamera } = definitions;

  return function billboardSystem(world) {
    const activeCamera = world.getResource(ActiveCamera);
    if (!activeCamera) {
      return;
    }

    for (const entity of world.query(Transform, Billboard)) {
      const transform = readTransform(world, entity, Transform);
      const billboard = world.getComponent(entity, Billboard);

      if (policy.faceCamera) {
        policy.faceCamera({ world, entity, transform, billboard, activeCamera });
        continue;
      }

      billboard.lookAt = {
        x: activeCamera.position.x,
        y: billboard.lockY ? transform.position.y : activeCamera.position.y,
        z: activeCamera.position.z
      };
    }
  };
}

export function createRenderSyncSystem(definitions, policy = {}) {
  const { Transform, Renderable } = definitions;

  return function renderSyncSystem(world) {
    for (const entity of world.query(Transform, Renderable)) {
      const transform = readTransform(world, entity, Transform);
      const renderable = world.getComponent(entity, Renderable);
      const object3d = renderable.object3d ?? null;

      if (!object3d) {
        continue;
      }

      if (policy.syncRenderable) {
        policy.syncRenderable({ world, entity, transform, renderable, object3d });
        continue;
      }

      object3d.position.set(transform.position.x, transform.position.y, transform.position.z);

      if (transform.rotation) {
        object3d.rotation.set(
          Number(transform.rotation.x ?? 0),
          Number(transform.rotation.y ?? 0),
          Number(transform.rotation.z ?? 0)
        );
      }

      if (transform.scale) {
        object3d.scale.set(
          Number(transform.scale.x ?? 1),
          Number(transform.scale.y ?? 1),
          Number(transform.scale.z ?? 1)
        );
      }
    }
  };
}

export function createLifetimeSystem(definitions, policy = {}) {
  const { Lifetime, Time } = definitions;

  return function lifetimeSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = Number(time.delta ?? 1 / 60);
    const removals = [];

    for (const entity of world.query(Lifetime)) {
      const lifetime = world.getComponent(entity, Lifetime);
      lifetime.remaining = Number(lifetime.remaining ?? 0) - delta;

      if (policy.beforeExpire) {
        policy.beforeExpire({ world, entity, lifetime });
      }

      if (lifetime.remaining <= 0) {
        removals.push(entity);
      }
    }

    for (const entity of removals) {
      world.removeEntity(entity);
    }
  };
}

export function registerDefaultGameKitSystems(scheduler, definitions, policy = {}) {
  const systemMap = {
    ControlSystem: createControlSystem(definitions, policy.ControlSystem),
    SpawnSystem: createSpawnSystem(definitions, policy.SpawnSystem),
    VelocitySystem: createVelocitySystem(definitions, policy.VelocitySystem),
    AnchorSystem: createAnchorSystem(definitions, policy.AnchorSystem),
    CinemaSystem: createCinemaSystem(definitions, policy.CinemaSystem),
    LightSystem: createLightSystem(definitions, policy.LightSystem),
    SkyboxSystem: createSkyboxSystem(definitions, policy.SkyboxSystem),
    BillboardSystem: createBillboardSystem(definitions, policy.BillboardSystem),
    RenderSyncSystem: createRenderSyncSystem(definitions, policy.RenderSyncSystem),
    LifetimeSystem: createLifetimeSystem(definitions, policy.LifetimeSystem)
  };

  for (const spec of GAMEKIT_SYSTEM_SPECS) {
    scheduler.addSystem(spec.phase, systemMap[spec.name]);
  }

  return scheduler;
}

export const ARCADE_SYSTEM_SPECS = Object.freeze([
  Object.freeze({ name: "ArcadeInputSystem", phase: "input" }),
  Object.freeze({ name: "ArcadeSpawnDirectorSystem", phase: "input" }),
  Object.freeze({ name: "ArcadeDifficultySystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadeAISystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadePathSystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadeMovementSystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadeKinematicSystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadeTerrainFollowSystem", phase: "simulate" }),
  Object.freeze({ name: "ArcadeCollisionSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeCollectionSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeDamageSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeObjectiveSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeScoringSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeMaterialSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeLightingSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeProceduralTerrainSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeScenerySpawnSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeMeshRigSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeGameFeelSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeCameraSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeRenderSyncSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeUIStateSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeAudioCueSystem", phase: "resolve" }),
  Object.freeze({ name: "ArcadeLifetimeSystem", phase: "cleanup" }),
  Object.freeze({ name: "ArcadeDespawnSystem", phase: "cleanup" })
]);

export function createArcadeDefinitions() {
  return Object.freeze({
    Transform: defineComponent("arcade.transform"),
    Velocity: defineComponent("arcade.velocity"),
    ControlIntent: defineComponent("arcade.control-intent"),
    Renderable: defineComponent("arcade.renderable"),
    Collider: defineComponent("arcade.collider"),
    KinematicBody: defineComponent("arcade.kinematic-body"),
    Health: defineComponent("arcade.health"),
    DamageOnContact: defineComponent("arcade.damage-on-contact"),
    Collectible: defineComponent("arcade.collectible"),
    Objective: defineComponent("arcade.objective"),
    ScoreValue: defineComponent("arcade.score-value"),
    SpawnRule: defineComponent("arcade.spawn-rule"),
    AIController: defineComponent("arcade.ai-controller"),
    PathFollower: defineComponent("arcade.path-follower"),
    Lifetime: defineComponent("arcade.lifetime"),
    LoopSegment: defineComponent("arcade.loop-segment"),
    DifficultyProfile: defineComponent("arcade.difficulty-profile"),
    TerrainProfile: defineComponent("arcade.terrain-profile"),
    TerrainChunk: defineComponent("arcade.terrain-chunk"),
    SurfaceMaterial: defineComponent("arcade.surface-material"),
    BiomeZone: defineComponent("arcade.biome-zone"),
    ScenerySpawnRule: defineComponent("arcade.scenery-spawn-rule"),
    LightRig: defineComponent("arcade.light-rig"),
    AtmosphereProfile: defineComponent("arcade.atmosphere-profile"),
    ShaderProfile: defineComponent("arcade.shader-profile"),
    VehicleRig: defineComponent("arcade.vehicle-rig"),
    PickupRig: defineComponent("arcade.pickup-rig"),
    HazardRig: defineComponent("arcade.hazard-rig"),
    PlayerTag: defineComponent("arcade.player-tag"),
    PendingDespawn: defineComponent("arcade.pending-despawn"),
    Time: defineResource("arcade.time"),
    InputState: defineResource("arcade.input-state"),
    GameSession: defineResource("arcade.game-session"),
    ScoreState: defineResource("arcade.score-state"),
    ObjectiveState: defineResource("arcade.objective-state"),
    RunTimer: defineResource("arcade.run-timer"),
    DifficultyState: defineResource("arcade.difficulty-state"),
    SpawnQueue: defineResource("arcade.spawn-queue"),
    AssetRegistry: defineResource("arcade.asset-registry"),
    AudioQueue: defineResource("arcade.audio-queue"),
    CameraState: defineResource("arcade.camera-state"),
    UIState: defineResource("arcade.ui-state"),
    TerrainState: defineResource("arcade.terrain-state"),
    LightingState: defineResource("arcade.lighting-state"),
    AtmosphereState: defineResource("arcade.atmosphere-state"),
    RenderTheme: defineResource("arcade.render-theme"),
    ChunkRegistry: defineResource("arcade.chunk-registry"),
    SceneryRegistry: defineResource("arcade.scenery-registry"),
    CollisionEvent: defineEvent("arcade.collision"),
    CollectEvent: defineEvent("arcade.collect"),
    DamageEvent: defineEvent("arcade.damage"),
    DeathEvent: defineEvent("arcade.death"),
    ObjectiveEvent: defineEvent("arcade.objective"),
    ScoreEvent: defineEvent("arcade.score"),
    SpawnEvent: defineEvent("arcade.spawn"),
    SessionEvent: defineEvent("arcade.session")
  });
}

function number(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function vec3(value = {}, fallback = 0) {
  return {
    x: number(value.x, fallback),
    y: number(value.y, fallback),
    z: number(value.z, fallback)
  };
}

function distanceSq3(a, b) {
  const dx = number(a.x) - number(b.x);
  const dy = number(a.y) - number(b.y);
  const dz = number(a.z) - number(b.z);
  return dx * dx + dy * dy + dz * dz;
}

function addEntityWithComponents(world, componentEntries) {
  const entity = world.addEntity();

  for (const [component, value] of componentEntries) {
    if (component) {
      world.setComponent(entity, component, value);
    }
  }

  return entity;
}

export function createArcadeInputSystem(definitions, policy = {}) {
  const { ControlIntent, InputState, PlayerTag } = definitions;

  return function arcadeInputSystem(world) {
    const input = world.getResource(InputState) ?? {};
    const entities = world.query(ControlIntent, PlayerTag);

    for (const entity of entities) {
      const currentIntent = world.getComponent(entity, ControlIntent) ?? {};
      const nextIntent = policy.resolveIntent
        ? policy.resolveIntent({ world, entity, input, currentIntent })
        : {
            x: number(input.x),
            y: number(input.y),
            z: number(input.z),
            action: Boolean(input.action),
            boost: Boolean(input.boost)
          };

      world.setComponent(entity, ControlIntent, nextIntent);
    }
  };
}

export function createArcadeMovementSystem(definitions, policy = {}) {
  const { Velocity, ControlIntent, KinematicBody, Time } = definitions;

  return function arcadeMovementSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = number(time.delta, 1 / 60);

    for (const entity of world.query(Velocity, ControlIntent, KinematicBody)) {
      const velocity = world.getComponent(entity, Velocity);
      const intent = world.getComponent(entity, ControlIntent);
      const body = world.getComponent(entity, KinematicBody);

      if (policy.resolveVelocity) {
        policy.resolveVelocity({ world, entity, velocity, intent, body, delta });
        continue;
      }

      const acceleration = number(body.acceleration, 24) * (intent.boost ? number(body.boostMultiplier, 1.35) : 1);
      velocity.x += number(intent.x) * acceleration * delta;
      velocity.y += number(intent.y) * acceleration * delta;
      velocity.z += number(intent.z) * acceleration * delta;

      const maxSpeed = number(body.maxSpeed, 14) * (intent.boost ? number(body.boostMultiplier, 1.35) : 1);
      const speed = Math.hypot(number(velocity.x), number(velocity.y), number(velocity.z));
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        velocity.x *= scale;
        velocity.y *= scale;
        velocity.z *= scale;
      }
    }
  };
}

export function createArcadeKinematicSystem(definitions, policy = {}) {
  const { Transform, Velocity, KinematicBody, Time } = definitions;

  return function arcadeKinematicSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = number(time.delta, 1 / 60);

    for (const entity of world.query(Transform, Velocity, KinematicBody)) {
      const transform = world.getComponent(entity, Transform);
      const velocity = world.getComponent(entity, Velocity);
      const body = world.getComponent(entity, KinematicBody);

      if (policy.integrate) {
        policy.integrate({ world, entity, transform, velocity, body, delta });
      } else {
        transform.position.x += number(velocity.x) * delta;
        transform.position.y += number(velocity.y) * delta;
        transform.position.z += number(velocity.z) * delta;
      }

      const drag = Math.max(0, Math.min(1, number(body.drag, 0.04)));
      const dragScale = Math.max(0, 1 - drag);
      velocity.x *= dragScale;
      velocity.y *= dragScale;
      velocity.z *= dragScale;

      if (body.bounds) {
        transform.position.x = Math.max(number(body.bounds.minX, -Infinity), Math.min(number(body.bounds.maxX, Infinity), transform.position.x));
        transform.position.y = Math.max(number(body.bounds.minY, -Infinity), Math.min(number(body.bounds.maxY, Infinity), transform.position.y));
        transform.position.z = Math.max(number(body.bounds.minZ, -Infinity), Math.min(number(body.bounds.maxZ, Infinity), transform.position.z));
      }
    }
  };
}

export function createArcadeCollisionSystem(definitions, policy = {}) {
  const { Transform, Collider, CollisionEvent } = definitions;

  return function arcadeCollisionSystem(world) {
    const entities = world.query(Transform, Collider);

    for (let index = 0; index < entities.length; index += 1) {
      const aEntity = entities[index];
      const aTransform = world.getComponent(aEntity, Transform);
      const aCollider = world.getComponent(aEntity, Collider);

      for (let otherIndex = index + 1; otherIndex < entities.length; otherIndex += 1) {
        const bEntity = entities[otherIndex];
        const bTransform = world.getComponent(bEntity, Transform);
        const bCollider = world.getComponent(bEntity, Collider);
        const context = { world, aEntity, bEntity, aTransform, bTransform, aCollider, bCollider };

        if (policy.shouldCollide && policy.shouldCollide(context) === false) {
          continue;
        }

        const radius = number(aCollider.radius) + number(bCollider.radius);
        const intersects = policy.intersects
          ? policy.intersects(context)
          : distanceSq3(aTransform.position, bTransform.position) <= radius * radius;

        if (!intersects) {
          continue;
        }

        if (policy.resolveCollision) {
          policy.resolveCollision(context);
        }

        world.emit(CollisionEvent, policy.buildEvent ? policy.buildEvent(context) : {
          pair: [aEntity, bEntity],
          aEntity,
          bEntity,
          layers: [aCollider.layer, bCollider.layer]
        });
      }
    }
  };
}

export function createArcadeCollectionSystem(definitions, policy = {}) {
  const { Collectible, ScoreValue, CollisionEvent, CollectEvent, ScoreEvent, ObjectiveEvent, PendingDespawn } = definitions;

  return function arcadeCollectionSystem(world) {
    for (const collision of world.readEvents(CollisionEvent)) {
      const pair = collision.pair ?? [];

      for (const entity of pair) {
        if (!entity || !world.hasComponent(entity, Collectible)) {
          continue;
        }

        const collectible = world.getComponent(entity, Collectible);
        if (collectible.collected) {
          continue;
        }

        const context = { world, entity, collision, collectible };
        if (policy.shouldCollect && policy.shouldCollect(context) === false) {
          continue;
        }

        collectible.collected = true;
        const scoreValue = world.hasComponent(entity, ScoreValue)
          ? world.getComponent(entity, ScoreValue)
          : { amount: number(collectible.score, 1) };
        const amount = number(scoreValue.amount, 1);
        const collectEvent = { entity, kind: collectible.kind ?? "collectible", amount };
        world.emit(CollectEvent, collectEvent);
        world.emit(ScoreEvent, { entity, amount, reason: "collect", kind: collectEvent.kind });
        world.emit(ObjectiveEvent, { kind: collectEvent.kind, amount: 1, reason: "collect" });
        world.setComponent(entity, PendingDespawn, { reason: "collected" });

        if (policy.onCollect) {
          policy.onCollect({ ...context, scoreValue, collectEvent });
        }
      }
    }
  };
}

export function createArcadeDamageSystem(definitions, policy = {}) {
  const { Health, DamageOnContact, CollisionEvent, DamageEvent, DeathEvent, PendingDespawn } = definitions;

  return function arcadeDamageSystem(world) {
    for (const collision of world.readEvents(CollisionEvent)) {
      const pair = collision.pair ?? [];
      const sides = [
        { source: pair[0], target: pair[1] },
        { source: pair[1], target: pair[0] }
      ];

      for (const side of sides) {
        if (!side.source || !side.target || !world.hasComponent(side.source, DamageOnContact) || !world.hasComponent(side.target, Health)) {
          continue;
        }

        const sourceDamage = world.getComponent(side.source, DamageOnContact);
        const health = world.getComponent(side.target, Health);
        if (policy.shouldApplyDamage && policy.shouldApplyDamage({ world, collision, ...side, sourceDamage, health }) === false) {
          continue;
        }

        const amount = number(sourceDamage.amount);
        health.current = number(health.current, number(health.max, 1)) - amount;
        world.emit(DamageEvent, { source: side.source, target: side.target, amount, type: sourceDamage.type ?? "contact" });

        if (health.current <= 0) {
          world.emit(DeathEvent, { entity: side.target, source: side.source });
          world.setComponent(side.target, PendingDespawn, { reason: "health-depleted" });
        }
      }
    }
  };
}

export function createArcadeObjectiveSystem(definitions, policy = {}) {
  const { Objective, ObjectiveState, ObjectiveEvent, GameSession, SessionEvent } = definitions;

  return function arcadeObjectiveSystem(world) {
    const objectiveState = world.getResource(ObjectiveState) ?? { objectives: [] };
    const gameSession = world.getResource(GameSession) ?? { status: "running" };
    const eventTotals = new Map();

    for (const event of world.readEvents(ObjectiveEvent)) {
      eventTotals.set(event.kind, (eventTotals.get(event.kind) ?? 0) + number(event.amount, 1));
    }

    for (const entity of world.query(Objective)) {
      const objective = world.getComponent(entity, Objective);
      const add = eventTotals.get(objective.kind) ?? 0;
      if (add > 0) {
        objective.current = Math.min(number(objective.target, 1), number(objective.current) + add);
      }
    }

    objectiveState.objectives = world.query(Objective).map((entity) => {
      const objective = world.getComponent(entity, Objective);
      return {
        entity,
        kind: objective.kind,
        label: objective.label ?? objective.kind,
        current: number(objective.current),
        target: number(objective.target, 1),
        complete: number(objective.current) >= number(objective.target, 1)
      };
    });

    const required = objectiveState.objectives.filter((objective) => objective.required !== false);
    const complete = required.length > 0 && required.every((objective) => objective.complete);
    objectiveState.complete = complete;
    world.setResource(ObjectiveState, objectiveState);

    if (complete && gameSession.status === "running") {
      gameSession.status = "won";
      world.setResource(GameSession, gameSession);
      world.emit(SessionEvent, { status: "won", reason: "objectives-complete" });
      if (policy.onComplete) {
        policy.onComplete({ world, objectiveState, gameSession });
      }
    }
  };
}

export function createArcadeScoringSystem(definitions, policy = {}) {
  const { ScoreState, ScoreEvent } = definitions;

  return function arcadeScoringSystem(world) {
    const scoreState = world.getResource(ScoreState) ?? { score: 0, combo: 1, events: [] };

    for (const event of world.readEvents(ScoreEvent)) {
      const multiplier = policy.multiplier ? policy.multiplier({ world, scoreState, event }) : number(scoreState.combo, 1);
      const amount = Math.round(number(event.amount) * multiplier);
      scoreState.score = number(scoreState.score) + amount;
      scoreState.last = { ...event, amount };
      scoreState.events = [...(scoreState.events ?? []).slice(-8), scoreState.last];
    }

    world.setResource(ScoreState, scoreState);
  };
}

export function createArcadeSpawnDirectorSystem(definitions, policy = {}) {
  const { SpawnRule, SpawnQueue, SpawnEvent, Time } = definitions;

  return function arcadeSpawnDirectorSystem(world) {
    const time = world.getResource(Time) ?? { elapsed: 0, delta: 1 / 60 };
    const spawnQueue = world.getResource(SpawnQueue) ?? [];

    for (const entity of world.query(SpawnRule)) {
      const rule = world.getComponent(entity, SpawnRule);
      rule.elapsed = number(rule.elapsed) + number(time.delta, 1 / 60);

      if (rule.elapsed < number(rule.every, 3)) {
        continue;
      }

      rule.elapsed = 0;
      const request = {
        ruleEntity: entity,
        kind: rule.kind ?? "spawn",
        count: Math.max(1, Math.floor(number(rule.count, 1))),
        at: number(time.elapsed)
      };
      spawnQueue.push(request);
      world.emit(SpawnEvent, request);

      if (policy.spawn) {
        policy.spawn({ world, rule, request });
      }
    }

    world.setResource(SpawnQueue, spawnQueue);
  };
}

export function createArcadeDifficultySystem(definitions, policy = {}) {
  const { DifficultyState, DifficultyProfile, Time, RunTimer } = definitions;

  return function arcadeDifficultySystem(world) {
    const time = world.getResource(Time) ?? { elapsed: 0 };
    const runTimer = world.getResource(RunTimer) ?? { duration: 600, remaining: 600 };
    const state = world.getResource(DifficultyState) ?? { level: 1, multiplier: 1 };
    const profiles = world.query(DifficultyProfile).map((entity) => world.getComponent(entity, DifficultyProfile));
    const profile = profiles[0] ?? { base: 1, ramp: 4 };
    const progress = Math.max(0, Math.min(1, number(time.elapsed) / Math.max(1, number(runTimer.duration, 600))));

    state.progress = progress;
    state.level = Math.max(1, Math.floor(number(profile.base, 1) + progress * number(profile.ramp, 4)));
    state.multiplier = 1 + progress * number(profile.ramp, 4) * 0.2;

    if (policy.updateDifficulty) {
      policy.updateDifficulty({ world, state, profile, progress });
    }

    world.setResource(DifficultyState, state);
  };
}

export function createArcadeAISystem(definitions, policy = {}) {
  const { Transform, Velocity, AIController, Time, PlayerTag } = definitions;

  return function arcadeAISystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = number(time.delta, 1 / 60);
    const player = world.query(Transform, PlayerTag)[0];
    const playerTransform = player ? world.getComponent(player, Transform) : null;

    for (const entity of world.query(Transform, Velocity, AIController)) {
      const transform = world.getComponent(entity, Transform);
      const velocity = world.getComponent(entity, Velocity);
      const ai = world.getComponent(entity, AIController);

      if (policy.updateAI) {
        policy.updateAI({ world, entity, transform, velocity, ai, player, playerTransform, delta });
        continue;
      }

      const target = ai.target ?? playerTransform?.position;
      if (!target) {
        continue;
      }

      const dx = number(target.x) - number(transform.position.x);
      const dz = number(target.z) - number(transform.position.z);
      const distance = Math.hypot(dx, dz) || 1;
      const speed = number(ai.speed, 4);
      velocity.x += (dx / distance) * speed * delta;
      velocity.z += (dz / distance) * speed * delta;
    }
  };
}

export function createArcadePathSystem(definitions, policy = {}) {
  const { Transform, Velocity, PathFollower, Time } = definitions;

  return function arcadePathSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = number(time.delta, 1 / 60);

    for (const entity of world.query(Transform, Velocity, PathFollower)) {
      const transform = world.getComponent(entity, Transform);
      const velocity = world.getComponent(entity, Velocity);
      const follower = world.getComponent(entity, PathFollower);
      const points = follower.points ?? [];

      if (policy.followPath) {
        policy.followPath({ world, entity, transform, velocity, follower, points, delta });
        continue;
      }

      if (!points.length) {
        continue;
      }

      const current = points[follower.current ?? 0] ?? points[0];
      const dx = number(current.x) - number(transform.position.x);
      const dz = number(current.z) - number(transform.position.z);
      const distance = Math.hypot(dx, dz) || 1;

      if (distance < number(follower.arrivalRadius, 1.4)) {
        follower.current = ((follower.current ?? 0) + 1) % points.length;
      } else {
        const speed = number(follower.speed, 4);
        velocity.x += (dx / distance) * speed * delta;
        velocity.z += (dz / distance) * speed * delta;
      }
    }
  };
}

export function createArcadeTheme(options = {}) {
  return Object.freeze({
    biome: options.biome ?? "industrial",
    seed: options.seed ?? options.terrain?.seed ?? 1,
    terrain: {
      style: "rolling",
      size: 320,
      segments: 96,
      height: 4,
      roughness: 0.5,
      ...options.terrain
    },
    lighting: {
      sky: options.sky ?? "#101820",
      ambient: options.ambient ?? "#b9d7ff",
      sun: options.sun ?? "#ffffff",
      fogNear: 80,
      fogFar: 420,
      ...options.lighting
    },
    materials: {
      floor: options.floor,
      prop: options.prop,
      player: options.player?.color,
      collectible: options.collectible?.color,
      hazard: options.hazard?.color,
      ...options.materials
    },
    rigs: {
      vehicle: options.rigs?.vehicle ?? options.player?.rig ?? "hauler",
      pickup: options.rigs?.pickup ?? options.collectible?.rig ?? "crate",
      hazard: options.rigs?.hazard ?? options.hazard?.rig ?? "crusher",
      ...options.rigs
    },
    scenery: options.scenery ?? [],
    feel: {
      mode: options.feel?.mode ?? "drive",
      intensity: 1,
      ...options.feel
    }
  });
}

export function createTerrainFollowSystem(definitions, policy = {}) {
  const { Transform, TerrainState, TerrainProfile } = definitions;

  return function arcadeTerrainFollowSystem(world) {
    const terrainState = world.getResource(TerrainState) ?? {};
    const heightAt = policy.heightAt ?? terrainState.heightAt;
    if (!heightAt) {
      return;
    }

    for (const entity of world.query(Transform)) {
      const transform = world.getComponent(entity, Transform);
      const profile = world.hasComponent(entity, TerrainProfile)
        ? world.getComponent(entity, TerrainProfile)
        : null;
      const mode = profile?.follow ?? transform.followTerrain;
      if (!mode) {
        continue;
      }

      const context = { world, entity, transform, profile, terrainState };
      if (policy.followTerrain) {
        policy.followTerrain(context);
        continue;
      }

      const base = heightAt(transform.position.x, transform.position.z, context);
      const offset = number(profile?.offset ?? transform.groundOffset, 1);
      const blend = Math.max(0, Math.min(1, number(profile?.blend, 1)));
      transform.position.y += (base + offset - transform.position.y) * blend;
    }
  };
}

export function createMaterialSystem(definitions, policy = {}) {
  const { RenderTheme } = definitions;

  return function arcadeMaterialSystem(world) {
    const renderTheme = world.getResource(RenderTheme) ?? {};
    if (renderTheme.ready) {
      if (policy.updateMaterials) {
        policy.updateMaterials({ world, renderTheme });
      }
      return;
    }

    if (policy.createMaterials) {
      renderTheme.materials = policy.createMaterials({ world, renderTheme }) ?? renderTheme.materials ?? {};
    }
    renderTheme.ready = true;
    world.setResource(RenderTheme, renderTheme);
  };
}

export function createLightingSystem(definitions, policy = {}) {
  const { LightingState, AtmosphereState } = definitions;

  return function arcadeLightingSystem(world) {
    const lightingState = world.getResource(LightingState) ?? {};
    const atmosphereState = world.getResource(AtmosphereState) ?? {};

    if (!lightingState.ready && policy.applyLighting) {
      policy.applyLighting({ world, lightingState, atmosphereState });
      lightingState.ready = true;
    }

    if (policy.updateLighting) {
      policy.updateLighting({ world, lightingState, atmosphereState });
    }

    world.setResource(LightingState, lightingState);
    world.setResource(AtmosphereState, atmosphereState);
  };
}

export function createProceduralTerrainSystem(definitions, policy = {}) {
  const { TerrainState, ChunkRegistry, TerrainProfile, TerrainChunk } = definitions;

  return function arcadeProceduralTerrainSystem(world) {
    const terrainState = world.getResource(TerrainState) ?? {};
    const chunkRegistry = world.getResource(ChunkRegistry) ?? { chunks: new Map() };

    if (!terrainState.ready) {
      const profileEntity = world.query(TerrainProfile)[0];
      const profile = profileEntity ? world.getComponent(profileEntity, TerrainProfile) : terrainState.profile ?? {};
      terrainState.profile = profile;
      terrainState.seed = profile.seed ?? terrainState.seed ?? 1;
      terrainState.heightAt = policy.heightAt ?? terrainState.heightAt ?? (() => 0);

      if (policy.buildTerrain) {
        const built = policy.buildTerrain({ world, terrainState, chunkRegistry, profile });
        if (built !== undefined) {
          terrainState.mesh = built;
        }
      }

      terrainState.ready = true;
      if (profileEntity && TerrainChunk && !world.hasComponent(profileEntity, TerrainChunk)) {
        world.setComponent(profileEntity, TerrainChunk, { id: "main", ready: true });
      }
    }

    if (policy.updateTerrain) {
      policy.updateTerrain({ world, terrainState, chunkRegistry });
    }

    world.setResource(TerrainState, terrainState);
    world.setResource(ChunkRegistry, chunkRegistry);
  };
}

export function createScenerySpawnSystem(definitions, policy = {}) {
  const { ScenerySpawnRule, SceneryRegistry } = definitions;

  return function arcadeScenerySpawnSystem(world) {
    const sceneryRegistry = world.getResource(SceneryRegistry) ?? { spawned: new Set() };
    if (!sceneryRegistry.spawned) {
      sceneryRegistry.spawned = new Set();
    }

    for (const entity of world.query(ScenerySpawnRule)) {
      if (sceneryRegistry.spawned.has(entity)) {
        continue;
      }
      const rule = world.getComponent(entity, ScenerySpawnRule);
      const count = Math.max(0, Math.floor(number(rule.count, 1)));
      for (let index = 0; index < count; index += 1) {
        if (policy.spawnScenery) {
          policy.spawnScenery({ world, entity, rule, index, sceneryRegistry });
        }
      }
      sceneryRegistry.spawned.add(entity);
    }

    if (policy.updateScenery) {
      policy.updateScenery({ world, sceneryRegistry });
    }

    world.setResource(SceneryRegistry, sceneryRegistry);
  };
}

export function createMeshRigSystem(definitions, policy = {}) {
  const { Transform, Renderable, VehicleRig, PickupRig, HazardRig } = definitions;

  return function arcadeMeshRigSystem(world) {
    const rigTypes = [
      { component: VehicleRig, kind: "vehicle" },
      { component: PickupRig, kind: "pickup" },
      { component: HazardRig, kind: "hazard" }
    ];

    for (const { component, kind } of rigTypes) {
      for (const entity of world.query(component)) {
        const rig = world.getComponent(entity, component);
        const renderable = world.hasComponent(entity, Renderable)
          ? world.getComponent(entity, Renderable)
          : {};

        if (renderable.object3d || renderable.object) {
          continue;
        }

        const object = policy.buildRig
          ? policy.buildRig({ world, entity, rig, kind })
          : null;
        if (!object) {
          continue;
        }

        world.setComponent(entity, Renderable, { ...renderable, object3d: object, rigKind: kind });
        if (!world.hasComponent(entity, Transform)) {
          world.setComponent(entity, Transform, { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } });
        }

        if (policy.onRigBuilt) {
          policy.onRigBuilt({ world, entity, rig, kind, object });
        }
      }
    }
  };
}

export function createGameFeelSystem(definitions, policy = {}) {
  const { Time, Transform, Velocity, Renderable, PlayerTag } = definitions;

  return function arcadeGameFeelSystem(world) {
    const time = world.getResource(Time) ?? { elapsed: 0, delta: 1 / 60 };

    if (policy.updateFeel) {
      policy.updateFeel({ world, time, definitions });
      return;
    }

    for (const entity of world.query(Transform, Renderable)) {
      const transform = world.getComponent(entity, Transform);
      const renderable = world.getComponent(entity, Renderable);
      const object = renderable.object3d ?? renderable.object;
      if (!object) {
        continue;
      }
      const velocity = world.hasComponent(entity, Velocity) ? world.getComponent(entity, Velocity) : null;
      const speed = velocity ? Math.hypot(number(velocity.x), number(velocity.z)) : 0;
      const bob = world.hasComponent(entity, PlayerTag) ? 0.06 : 0.035;
      object.rotation.z += Math.sin(number(time.elapsed) * 3 + entity) * bob * Math.min(speed, 12) * 0.001;
    }
  };
}

export function createArcadeCameraSystem(definitions, policy = {}) {
  const { Transform, CameraState, PlayerTag } = definitions;

  return function arcadeCameraSystem(world) {
    const cameraState = world.getResource(CameraState) ?? { position: { x: 0, y: 12, z: 18 }, lookAt: { x: 0, y: 0, z: 0 }, blend: 0.1 };
    const player = world.query(Transform, PlayerTag)[0];
    const playerTransform = player ? world.getComponent(player, Transform) : null;

    if (policy.updateCamera) {
      policy.updateCamera({ world, cameraState, player, playerTransform });
    } else if (playerTransform) {
      const blend = clampLerp(cameraState.blend ?? 0.1);
      const targetPosition = {
        x: playerTransform.position.x,
        y: playerTransform.position.y + number(cameraState.offsetY, 14),
        z: playerTransform.position.z + number(cameraState.offsetZ, 20)
      };
      cameraState.position.x += (targetPosition.x - cameraState.position.x) * blend;
      cameraState.position.y += (targetPosition.y - cameraState.position.y) * blend;
      cameraState.position.z += (targetPosition.z - cameraState.position.z) * blend;
      cameraState.lookAt = {
        x: playerTransform.position.x,
        y: playerTransform.position.y,
        z: playerTransform.position.z
      };
    }

    world.setResource(CameraState, cameraState);
  };
}

export function createArcadeRenderSyncSystem(definitions, policy = {}) {
  const { Transform, Renderable } = definitions;

  return function arcadeRenderSyncSystem(world) {
    for (const entity of world.query(Transform, Renderable)) {
      const transform = world.getComponent(entity, Transform);
      const renderable = world.getComponent(entity, Renderable);

      if (policy.syncRenderable) {
        policy.syncRenderable({ world, entity, transform, renderable });
        continue;
      }

      const object = renderable.object3d ?? renderable.object ?? null;
      if (!object) {
        continue;
      }

      object.position.set(transform.position.x, transform.position.y, transform.position.z);
      if (transform.rotation && object.rotation?.set) {
        object.rotation.set(number(transform.rotation.x), number(transform.rotation.y), number(transform.rotation.z));
      }
      if (transform.scale && object.scale?.set) {
        object.scale.set(number(transform.scale.x, 1), number(transform.scale.y, 1), number(transform.scale.z, 1));
      }
    }
  };
}

export function createArcadeUIStateSystem(definitions, policy = {}) {
  const { UIState, ScoreState, ObjectiveState, RunTimer, GameSession, DifficultyState } = definitions;

  return function arcadeUIStateSystem(world) {
    const uiState = {
      score: world.getResource(ScoreState) ?? { score: 0 },
      objectives: world.getResource(ObjectiveState) ?? { objectives: [] },
      timer: world.getResource(RunTimer) ?? { remaining: 0 },
      session: world.getResource(GameSession) ?? { status: "running" },
      difficulty: world.getResource(DifficultyState) ?? { level: 1 }
    };

    world.setResource(UIState, uiState);

    if (policy.updateUI) {
      policy.updateUI({ world, uiState });
    }
  };
}

export function createArcadeAudioCueSystem(definitions, policy = {}) {
  const { AudioQueue } = definitions;

  return function arcadeAudioCueSystem(world) {
    const audioQueue = world.getResource(AudioQueue) ?? [];
    if (policy.playAudio) {
      while (audioQueue.length) {
        policy.playAudio({ world, cue: audioQueue.shift() });
      }
    } else {
      audioQueue.length = 0;
    }
    world.setResource(AudioQueue, audioQueue);
  };
}

export function createArcadeLifetimeSystem(definitions, policy = {}) {
  const { Lifetime, Time, PendingDespawn } = definitions;

  return function arcadeLifetimeSystem(world) {
    const time = world.getResource(Time) ?? { delta: 1 / 60 };
    const delta = number(time.delta, 1 / 60);

    for (const entity of world.query(Lifetime)) {
      const lifetime = world.getComponent(entity, Lifetime);
      lifetime.remaining = number(lifetime.remaining) - delta;

      if (policy.updateLifetime) {
        policy.updateLifetime({ world, entity, lifetime, delta });
      }

      if (lifetime.remaining <= 0) {
        world.setComponent(entity, PendingDespawn, { reason: "lifetime-expired" });
      }
    }
  };
}

export function createArcadeDespawnSystem(definitions, policy = {}) {
  const { PendingDespawn, Renderable } = definitions;

  return function arcadeDespawnSystem(world) {
    for (const entity of world.query(PendingDespawn)) {
      const marker = world.getComponent(entity, PendingDespawn);

      if (policy.shouldDespawn && policy.shouldDespawn({ world, entity, marker }) === false) {
        continue;
      }

      if (world.hasComponent(entity, Renderable)) {
        const renderable = world.getComponent(entity, Renderable);
        const object = renderable.object3d ?? renderable.object;
        if (object?.parent) {
          object.parent.remove(object);
        }
      }

      if (policy.beforeRemove) {
        policy.beforeRemove({ world, entity, marker });
      }

      world.removeEntity(entity);
    }
  };
}

export function registerArcadeSystems(scheduler, definitions, policy = {}) {
  const systemMap = {
    ArcadeInputSystem: createArcadeInputSystem(definitions, policy.ArcadeInputSystem),
    ArcadeSpawnDirectorSystem: createArcadeSpawnDirectorSystem(definitions, policy.ArcadeSpawnDirectorSystem),
    ArcadeDifficultySystem: createArcadeDifficultySystem(definitions, policy.ArcadeDifficultySystem),
    ArcadeAISystem: createArcadeAISystem(definitions, policy.ArcadeAISystem),
    ArcadePathSystem: createArcadePathSystem(definitions, policy.ArcadePathSystem),
    ArcadeMovementSystem: createArcadeMovementSystem(definitions, policy.ArcadeMovementSystem),
    ArcadeKinematicSystem: createArcadeKinematicSystem(definitions, policy.ArcadeKinematicSystem),
    ArcadeTerrainFollowSystem: createTerrainFollowSystem(definitions, policy.ArcadeTerrainFollowSystem),
    ArcadeCollisionSystem: createArcadeCollisionSystem(definitions, policy.ArcadeCollisionSystem),
    ArcadeCollectionSystem: createArcadeCollectionSystem(definitions, policy.ArcadeCollectionSystem),
    ArcadeDamageSystem: createArcadeDamageSystem(definitions, policy.ArcadeDamageSystem),
    ArcadeObjectiveSystem: createArcadeObjectiveSystem(definitions, policy.ArcadeObjectiveSystem),
    ArcadeScoringSystem: createArcadeScoringSystem(definitions, policy.ArcadeScoringSystem),
    ArcadeMaterialSystem: createMaterialSystem(definitions, policy.ArcadeMaterialSystem),
    ArcadeLightingSystem: createLightingSystem(definitions, policy.ArcadeLightingSystem),
    ArcadeProceduralTerrainSystem: createProceduralTerrainSystem(definitions, policy.ArcadeProceduralTerrainSystem),
    ArcadeScenerySpawnSystem: createScenerySpawnSystem(definitions, policy.ArcadeScenerySpawnSystem),
    ArcadeMeshRigSystem: createMeshRigSystem(definitions, policy.ArcadeMeshRigSystem),
    ArcadeGameFeelSystem: createGameFeelSystem(definitions, policy.ArcadeGameFeelSystem),
    ArcadeCameraSystem: createArcadeCameraSystem(definitions, policy.ArcadeCameraSystem),
    ArcadeRenderSyncSystem: createArcadeRenderSyncSystem(definitions, policy.ArcadeRenderSyncSystem),
    ArcadeUIStateSystem: createArcadeUIStateSystem(definitions, policy.ArcadeUIStateSystem),
    ArcadeAudioCueSystem: createArcadeAudioCueSystem(definitions, policy.ArcadeAudioCueSystem),
    ArcadeLifetimeSystem: createArcadeLifetimeSystem(definitions, policy.ArcadeLifetimeSystem),
    ArcadeDespawnSystem: createArcadeDespawnSystem(definitions, policy.ArcadeDespawnSystem)
  };

  for (const spec of ARCADE_SYSTEM_SPECS) {
    scheduler.addSystem(spec.phase, systemMap[spec.name]);
  }

  return scheduler;
}

export function createArcadeRuntime(options = {}) {
  const definitions = options.definitions ?? createArcadeDefinitions();
  const world = options.world ?? createWorld();
  const scheduler = options.scheduler ?? createScheduler();
  const loopMinutes = number(options.loopMinutes, 10);
  const duration = number(options.duration, loopMinutes * 60);

  world.setResource(definitions.Time, { delta: 1 / 60, elapsed: 0, frame: 0 });
  world.setResource(definitions.InputState, {});
  world.setResource(definitions.GameSession, { status: "running", started: false, loopMinutes });
  world.setResource(definitions.ScoreState, { score: 0, combo: 1, events: [] });
  world.setResource(definitions.ObjectiveState, { objectives: [], complete: false });
  world.setResource(definitions.RunTimer, { duration, remaining: duration });
  world.setResource(definitions.DifficultyState, { level: 1, multiplier: 1, progress: 0 });
  world.setResource(definitions.SpawnQueue, []);
  world.setResource(definitions.AssetRegistry, options.assets ?? {});
  world.setResource(definitions.AudioQueue, []);
  world.setResource(definitions.CameraState, options.camera ?? { position: { x: 0, y: 16, z: 22 }, lookAt: { x: 0, y: 0, z: 0 }, blend: 0.12 });
  world.setResource(definitions.UIState, {});
  world.setResource(definitions.TerrainState, options.terrain ?? {});
  world.setResource(definitions.LightingState, options.lighting ?? {});
  world.setResource(definitions.AtmosphereState, options.atmosphere ?? {});
  world.setResource(definitions.RenderTheme, options.theme ? { theme: options.theme } : {});
  world.setResource(definitions.ChunkRegistry, { chunks: new Map() });
  world.setResource(definitions.SceneryRegistry, { spawned: new Set(), objects: [] });

  registerArcadeSystems(scheduler, definitions, options.policy ?? {});

  return {
    definitions,
    world,
    scheduler,
    addEntity(componentEntries) {
      return addEntityWithComponents(world, componentEntries);
    },
    step(delta = 1 / 60, inputState = {}) {
      const time = world.getResource(definitions.Time);
      const runTimer = world.getResource(definitions.RunTimer);
      const gameSession = world.getResource(definitions.GameSession);

      time.delta = Math.min(number(delta, 1 / 60), 1 / 20);
      time.elapsed += time.delta;
      time.frame += 1;
      runTimer.remaining = Math.max(0, number(runTimer.duration, duration) - time.elapsed);
      world.setResource(definitions.InputState, inputState);

      if (runTimer.remaining <= 0 && gameSession.status === "running") {
        gameSession.status = "timeout";
        world.emit(definitions.SessionEvent, { status: "timeout", reason: "timer-ended" });
      }

      scheduler.run(world);
      return world;
    },
    resetSession() {
      const time = world.getResource(definitions.Time);
      const runTimer = world.getResource(definitions.RunTimer);
      const gameSession = world.getResource(definitions.GameSession);
      time.delta = 1 / 60;
      time.elapsed = 0;
      time.frame = 0;
      runTimer.remaining = runTimer.duration;
      gameSession.status = "running";
      gameSession.started = true;
      world.setResource(definitions.ScoreState, { score: 0, combo: 1, events: [] });
      world.setResource(definitions.ObjectiveState, { objectives: [], complete: false });
    }
  };
}

export function createThreeSceneAdapter(THREE, options = {}) {
  if (!THREE) {
    throw new TypeError("createThreeSceneAdapter requires a THREE module.");
  }

  const scene = options.scene ?? new THREE.Scene();
  const camera = options.camera ?? new THREE.PerspectiveCamera(number(options.fov, 60), innerWidth / innerHeight, 0.1, number(options.far, 1200));
  const renderer = options.renderer ?? new THREE.WebGLRenderer({ antialias: true, alpha: false });

  if (!options.renderer) {
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  }

  function syncCamera(cameraState = {}) {
    const position = vec3(cameraState.position, 0);
    const lookAt = vec3(cameraState.lookAt, 0);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
    if (cameraState.fov !== undefined) {
      camera.fov = number(cameraState.fov, camera.fov);
      camera.updateProjectionMatrix();
    }
  }

  function resize(width = innerWidth, height = innerHeight) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  return {
    THREE,
    scene,
    camera,
    renderer,
    resize,
    syncCamera,
    render(cameraState) {
      if (cameraState) {
        syncCamera(cameraState);
      }
      renderer.render(scene, camera);
    }
  };
}

export function createArcadeManifest(options = {}) {
  return Object.freeze({
    slug: options.slug ?? "openecs-game",
    title: options.title ?? "OpenECS Game",
    engine: "OpenECS",
    loopMinutes: number(options.loopMinutes, 10),
    systems: ARCADE_SYSTEM_SPECS.map((spec) => spec.name),
    importMap: {
      "openecs-js": "/vendor/openecs-js/dist/index.js",
      "openecs-gamekit": "/vendor/openecs-gamekit/dist/index.js",
      three: "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js"
    },
    ...options
  });
}
