import {
  createCollisionSystem,
  createDamageSystem,
  createDeathSystem,
  createDespawnSystem,
  createInputSystem,
  createMovementSystem,
  createScheduler,
  createWorld,
  defineComponent,
  defineEvent,
  defineResource
} from "openecs-js";

const Name = defineComponent("name");
const Position = defineComponent("position");
const Velocity = defineComponent("velocity");
const InputIntent = defineComponent("input-intent");
const MovementStats = defineComponent("movement-stats");
const Collider = defineComponent("collider");
const Health = defineComponent("health");
const DamageOnContact = defineComponent("damage-on-contact");
const PendingDespawn = defineComponent("pending-despawn");
const PlayerTag = defineComponent("player-tag");
const EnemyTag = defineComponent("enemy-tag");

const Time = defineResource("time");
const InputState = defineResource("input-state");
const WorldBounds = defineResource("world-bounds");

const CollisionEvent = defineEvent("collision");
const DamageEvent = defineEvent("damage");
const DeathEvent = defineEvent("death");

const world = createWorld();
const scheduler = createScheduler();

function roundNumber(value) {
  return Number(value.toFixed(2));
}

function createInputSequence() {
  return [
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 }
  ];
}

function spawnActor({
  name,
  position,
  speed,
  radius,
  health,
  damage,
  player = false,
  enemy = false
}) {
  const entity = world.addEntity();
  world.setComponent(entity, Name, name);
  world.setComponent(entity, Position, { ...position });
  world.setComponent(entity, Velocity, { x: 0, y: 0 });
  world.setComponent(entity, InputIntent, { x: 0, y: 0 });
  world.setComponent(entity, MovementStats, { speed });
  world.setComponent(entity, Collider, { radius, blocks: true });
  world.setComponent(entity, Health, { current: health, max: health });
  world.setComponent(entity, DamageOnContact, { amount: damage });

  if (player) {
    world.setComponent(entity, PlayerTag, { kind: "player" });
  }

  if (enemy) {
    world.setComponent(entity, EnemyTag, { kind: "enemy" });
  }

  return entity;
}

world.setResource(Time, { tick: 0, delta: 1 });
world.setResource(InputState, {
  sequence: createInputSequence(),
  cursor: 0,
  intent: { x: 0, y: 0 }
});
world.setResource(WorldBounds, {
  minX: 0,
  maxX: 12,
  minY: 0,
  maxY: 8
});

const player = spawnActor({
  name: "runner",
  position: { x: 0, y: 4 },
  speed: 1.4,
  radius: 0.75,
  health: 6,
  damage: 1,
  player: true
});

spawnActor({
  name: "slime-a",
  position: { x: 6, y: 4 },
  speed: 0.55,
  radius: 0.75,
  health: 2,
  damage: 1,
  enemy: true
});

spawnActor({
  name: "slime-b",
  position: { x: 9, y: 5 },
  speed: 0.45,
  radius: 0.75,
  health: 3,
  damage: 1,
  enemy: true
});

const inputSystem = createInputSystem({
  InputIntent,
  InputState,
  ActorTag: PlayerTag
}, {
  resolveIntent({ inputState }) {
    return inputState.intent;
  }
});

const movementSystem = createMovementSystem({
  Position,
  Velocity,
  InputIntent,
  MovementStats,
  Time,
  WorldBounds
}, {
  resolveVelocity({ normalizedIntent, movementStats }) {
    const speed = Number(movementStats.speed ?? 0);
    return {
      x: normalizedIntent.x * speed,
      y: normalizedIntent.y * speed
    };
  },

  integrate({ position, nextVelocity, time }) {
    return {
      x: roundNumber(position.x + nextVelocity.x * time.delta),
      y: roundNumber(position.y + nextVelocity.y * time.delta)
    };
  },

  clampPosition({ nextPosition, worldBounds }) {
    return {
      x: Math.max(worldBounds.minX, Math.min(worldBounds.maxX, nextPosition.x)),
      y: Math.max(worldBounds.minY, Math.min(worldBounds.maxY, nextPosition.y))
    };
  }
});

const collisionSystem = createCollisionSystem({
  Position,
  Collider,
  CollisionEvent
}, {
  shouldCollide({ aEntity, bEntity }) {
    return aEntity !== bEntity;
  },

  buildEvent({ aEntity, bEntity }) {
    return { pair: [aEntity, bEntity], kind: "contact" };
  }
});

const damageSystem = createDamageSystem({
  Health,
  DamageOnContact,
  CollisionEvent,
  DamageEvent
}, {
  shouldApplyDamage({ source, target }) {
    return source !== target;
  },

  buildDamageEvents({ source, target, sourceDamage }) {
    return [{
      source,
      target,
      amount: Number(sourceDamage.amount ?? 0),
      type: "contact"
    }];
  },

  applyDamage({ targetHealth, damageEvent }) {
    targetHealth.current = Math.max(0, targetHealth.current - damageEvent.amount);
  }
});

const deathSystem = createDeathSystem({
  Health,
  PendingDespawn,
  DeathEvent
}, {
  buildDeathEvent({ entity, health }) {
    return {
      entity,
      remainingHealth: health.current
    };
  }
});

const despawnSystem = createDespawnSystem({
  PendingDespawn
}, {
  beforeRemove({ entity, marker }) {
    const name = world.getComponent(entity, Name);
    console.log(`cleanup removed ${name} (${marker.reason})`);
  }
});

function updateInputStateSystem(currentWorld) {
  const time = currentWorld.getResource(Time);
  const inputState = currentWorld.getResource(InputState);
  const sequence = inputState.sequence;
  const nextIntent = sequence[inputState.cursor] ?? { x: 0, y: 0 };

  time.tick += 1;
  inputState.intent = { ...nextIntent };
  inputState.cursor += 1;
}

function enemyChaseSystem(currentWorld) {
  const playerPosition = currentWorld.getComponent(player, Position);

  for (const entity of currentWorld.query(EnemyTag, InputIntent, Position)) {
    const position = currentWorld.getComponent(entity, Position);
    const dx = playerPosition.x - position.x;
    const dy = playerPosition.y - position.y;
    const intent = {
      x: Math.abs(dx) < 0.1 ? 0 : Math.sign(dx),
      y: Math.abs(dy) < 0.1 ? 0 : Math.sign(dy)
    };

    currentWorld.setComponent(entity, InputIntent, intent);
  }
}

function reportResolveSystem(currentWorld) {
  const collisions = currentWorld.readEvents(CollisionEvent);
  const damageEvents = currentWorld.readEvents(DamageEvent);
  const deaths = currentWorld.readEvents(DeathEvent);
  const tick = currentWorld.getResource(Time).tick;

  console.log(`tick ${tick}`);
  console.log(`resolve collisions=${collisions.length} damage=${damageEvents.length} deaths=${deaths.length}`);
}

function printWorldState(currentWorld) {
  for (const entity of currentWorld.query(Name, Position, Health)) {
    const name = currentWorld.getComponent(entity, Name);
    const position = currentWorld.getComponent(entity, Position);
    const health = currentWorld.getComponent(entity, Health);
    console.log(
      `- ${name}: pos=(${roundNumber(position.x)}, ${roundNumber(position.y)}) hp=${health.current}`
    );
  }
}

scheduler
  .addSystem("input", updateInputStateSystem)
  .addSystem("input", inputSystem)
  .addSystem("input", enemyChaseSystem)
  .addSystem("simulate", movementSystem)
  .addSystem("resolve", collisionSystem)
  .addSystem("resolve", damageSystem)
  .addSystem("resolve", deathSystem)
  .addSystem("resolve", reportResolveSystem)
  .addSystem("cleanup", despawnSystem);

for (let step = 0; step < 5; step += 1) {
  scheduler.run(world);
  printWorldState(world);
}
