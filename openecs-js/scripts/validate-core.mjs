import assert from "node:assert/strict";
import {
  DEFAULT_PHASES,
  createScheduler,
  createWorld,
  createMovementSystem,
  defineComponent,
  defineEvent,
  defineQuery,
  defineResource
} from "../dist/index.js";

const expectedPhases = ["input", "simulate", "resolve", "cleanup"];
assert.deepEqual(DEFAULT_PHASES, expectedPhases);

const Position = defineComponent("position");
const Velocity = defineComponent("velocity");
const InputIntent = defineComponent("input-intent");
const MovementStats = defineComponent("movement-stats");
const Hidden = defineComponent("hidden");
const Time = defineResource("time");
const WorldBounds = defineResource("world-bounds");
const TickEvent = defineEvent("tick");

{
  const world = createWorld();
  const entity = world.addEntity();
  const ref = world.getEntityRef(entity);

  assert.equal(world.hasEntity(ref), true);
  assert.equal(world.entityCount, 1);
  world.removeEntity(entity);
  assert.equal(world.hasEntity(ref), false);
  assert.throws(() => world.setComponent(ref, Position, { x: 0 }), /Unknown or stale entity/);
}

{
  const world = createWorld();
  const a = world.addEntity();
  const b = world.addEntity();
  const c = world.addEntity();

  world.setComponent(a, Position, { x: 1 });
  world.setComponent(a, Velocity, { x: 1 });
  world.setComponent(b, Position, { x: 2 });
  world.setComponent(b, Hidden, true);
  world.setComponent(c, Velocity, { x: 3 });
  world.setResource(Time, { delta: 0.25 });

  const query = defineQuery({
    all: [Position],
    none: [Hidden],
    optional: [Velocity],
    resources: [Time]
  });

  assert.deepEqual(world.queryEntities(query), [a]);
  const [row] = world.queryData(query);
  assert.equal(row.entity, a);
  assert.deepEqual(row.components["position"], { x: 1 });
  assert.deepEqual(row.optional["velocity"], { x: 1 });
  assert.deepEqual(row.resources["time"], { delta: 0.25 });
  assert.deepEqual(world.componentsOf(a), ["position", "velocity"]);
}

{
  const world = createWorld();
  const scheduler = createScheduler();
  let created;

  scheduler.addSystem("input", (_world, context) => {
    created = context.commands.addEntity();
    context.commands.setComponent(created, Position, { x: 10 });
    assert.equal(_world.hasEntity(created), false);
  }, { name: "spawn" });

  scheduler.addSystem("simulate", (_world) => {
    assert.equal(_world.hasEntity(created), true);
    assert.deepEqual(_world.getComponent(created, Position), { x: 10 });
  }, { name: "observe", after: "spawn" });

  scheduler.run(world);
}

{
  const world = createWorld();
  const scheduler = createScheduler();
  const order = [];

  scheduler.addSystem("simulate", () => order.push("third"), { name: "third", after: "second" });
  scheduler.addSystem("simulate", () => order.push("first"), { name: "first", before: "second" });
  scheduler.addSystem("simulate", () => order.push("second"), { name: "second" });
  scheduler.addSystem("simulate", () => order.push("conditional"), {
    name: "conditional",
    runIf: () => false
  });

  scheduler.run(world);
  assert.deepEqual(order, ["first", "second", "third"]);
}

{
  const world = createWorld();
  const scheduler = createScheduler();
  const seen = [];

  world.configureEvent(TickEvent, { historyLimit: 4 });

  scheduler.addSystem("input", (_world) => {
    _world.emit(TickEvent, { tick: 1 });
  });

  scheduler.addSystem("resolve", (_world) => {
    seen.push(..._world.readEvents(TickEvent).map((event) => event.tick));
    _world.emit(TickEvent, { tick: 2 }, { delivery: "next" });
  });

  scheduler.run(world);
  assert.deepEqual(seen, [1]);
  assert.deepEqual(world.readEvents(TickEvent).map((event) => event.tick), [2]);
  assert.deepEqual(world.readEvents(TickEvent, { includeHistory: true }).map((event) => event.tick), [1, 2]);
}

{
  const world = createWorld();
  const entity = world.addEntity();
  world.setComponent(entity, Position, { x: 7 });
  world.setResource(Time, { delta: 1 });
  world.emit(TickEvent, { tick: 9 });

  const snapshot = world.snapshot();
  const restored = createWorld().restore(snapshot);

  assert.equal(restored.hasEntity(entity), true);
  assert.deepEqual(restored.getComponent(entity, Position), { x: 7 });
  assert.deepEqual(restored.getResource(Time), { delta: 1 });
  assert.deepEqual(restored.readEvents(TickEvent), [{ tick: 9 }]);
  assert.equal(restored.stats().entities, 1);
  assert.deepEqual(restored.inspect().resources, ["time"]);
}

{
  const world = createWorld();
  const scheduler = createScheduler();
  const entity = world.addEntity();

  world.setComponent(entity, Position, { x: 0, y: 0 });
  world.setComponent(entity, Velocity, { x: 0, y: 0 });
  world.setComponent(entity, InputIntent, { x: 1, y: 0 });
  world.setComponent(entity, MovementStats, { speed: 2 });
  world.setResource(Time, { delta: 1 });
  world.setResource(WorldBounds, { minX: -10, maxX: 10, minY: -10, maxY: 10 });

  scheduler.addSystem("simulate", createMovementSystem({
    Position,
    Velocity,
    InputIntent,
    MovementStats,
    Time,
    WorldBounds
  }));

  scheduler.run(world);
  assert.deepEqual(world.getComponent(entity, Position), { x: 2, y: 0 });
  assert.deepEqual(world.getComponent(entity, Velocity), { x: 2, y: 0 });
}

console.log("openecs-js core validation passed");
