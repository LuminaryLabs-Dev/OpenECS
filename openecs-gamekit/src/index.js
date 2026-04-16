import {
  defineComponent,
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
