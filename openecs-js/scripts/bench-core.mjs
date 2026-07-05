import {
  createWorld,
  defineComponent,
  defineEvent,
  defineQuery
} from "../dist/index.js";

const Position = defineComponent("bench.position");
const Velocity = defineComponent("bench.velocity");
const Hidden = defineComponent("bench.hidden");
const BenchEvent = defineEvent("bench.event");
const world = createWorld();
const count = 20_000;

const time = (label, fn) => {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  console.log(`${label}: ${elapsed.toFixed(2)}ms`);
  return result;
};

const entities = time("entity/component creation", () => {
  const created = [];
  for (let index = 0; index < count; index += 1) {
    const entity = world.addEntity();
    world.setComponent(entity, Position, { x: index, y: index });
    if (index % 2 === 0) {
      world.setComponent(entity, Velocity, { x: 1, y: 0 });
    }
    if (index % 10 === 0) {
      world.setComponent(entity, Hidden, true);
    }
    created.push(entity);
  }
  return created;
});

const movingVisible = defineQuery({
  all: [Position, Velocity],
  none: [Hidden]
});

time("query moving visible entities", () => {
  const results = world.queryEntities(movingVisible);
  if (results.length === 0) {
    throw new Error("benchmark query returned no entities");
  }
});

time("event throughput", () => {
  for (let index = 0; index < count; index += 1) {
    world.emit(BenchEvent, { index });
  }
  world.readEvents(BenchEvent);
  world.advanceEvents();
});

time("snapshot", () => {
  world.snapshot({ includeEvents: false });
});

time("entity removal", () => {
  for (let index = 0; index < entities.length; index += 2) {
    world.removeEntity(entities[index]);
  }
});
