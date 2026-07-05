// Generated from src/index.js by scripts/build.mjs
const DEFAULT_PHASES = Object.freeze(["input", "simulate", "resolve", "cleanup"]);
const ENTITY_GENERATION_FACTOR = 1_000_000_000;
const SNAPSHOT_VERSION = 1;

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

function toArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function uniqueDefinitions(definitions) {
  const byName = new Map();

  for (const definition of definitions) {
    if (!definition) {
      continue;
    }

    byName.set(definition.name, definition);
  }

  return Array.from(byName.values());
}

function sortDefinitionNames(definitions) {
  return uniqueDefinitions(definitions).map((definition) => definition.name).sort();
}

function makeEntityHandle(slot, generation) {
  return generation * ENTITY_GENERATION_FACTOR + slot;
}

function parseEntityHandle(entity) {
  if (typeof entity === "number" && Number.isInteger(entity) && entity > 0) {
    const generation = Math.floor(entity / ENTITY_GENERATION_FACTOR);
    const slot = entity - generation * ENTITY_GENERATION_FACTOR;
    return { handle: entity, slot, generation };
  }

  if (entity && typeof entity === "object") {
    if (typeof entity.id === "number") {
      return parseEntityHandle(entity.id);
    }

    if (typeof entity.slot === "number" && typeof entity.generation === "number") {
      const handle = makeEntityHandle(entity.slot, entity.generation);
      return { handle, slot: entity.slot, generation: entity.generation };
    }
  }

  throw new TypeError("Expected an entity handle created by addEntity().");
}

function cloneValue(value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON cloning for plain serializable values.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
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

function normalizeQuery(input, rest = []) {
  const queryConfig = rest.length === 0 && input?.kind === "query"
    ? input
    : rest.length === 0 && input && typeof input === "object" && !input.kind && (
        input.all || input.include || input.with || input.any || input.none || input.exclude ||
        input.without || input.optional || input.resources
      )
      ? input
      : { all: [input, ...rest].filter(Boolean) };

  const all = uniqueDefinitions(toArray(queryConfig.all ?? queryConfig.include ?? queryConfig.with));
  const any = uniqueDefinitions(toArray(queryConfig.any));
  const none = uniqueDefinitions(toArray(queryConfig.none ?? queryConfig.exclude ?? queryConfig.without));
  const optional = uniqueDefinitions(toArray(queryConfig.optional));
  const resources = uniqueDefinitions(toArray(queryConfig.resources));

  for (const definition of [...all, ...any, ...none, ...optional]) {
    assertDefinition(definition, "component", "query");
  }

  for (const resource of resources) {
    assertDefinition(resource, "resource", "query");
  }

  return Object.freeze({ kind: "query", all, any, none, optional, resources });
}

function queryCacheKey(query) {
  return JSON.stringify({
    all: sortDefinitionNames(query.all),
    any: sortDefinitionNames(query.any),
    none: sortDefinitionNames(query.none),
    optional: sortDefinitionNames(query.optional),
    resources: sortDefinitionNames(query.resources)
  });
}

function ensureEventQueue(eventQueues, event) {
  assertDefinition(event, "event", "OpenECS");

  if (!eventQueues.has(event.name)) {
    eventQueues.set(event.name, {
      current: [],
      next: [],
      history: [],
      historyLimit: 0
    });
  }

  return eventQueues.get(event.name);
}

function archiveEvents(queue) {
  if (queue.historyLimit > 0 && queue.current.length > 0) {
    queue.history.push(...queue.current.map((payload) => cloneValue(payload)));
    if (queue.history.length > queue.historyLimit) {
      queue.history.splice(0, queue.history.length - queue.historyLimit);
    }
  }
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

export function defineQuery(config = {}) {
  return normalizeQuery(config);
}

export function createWorld() {
  const aliveEntities = new Set();
  const aliveSlots = new Set();
  const freeSlots = [];
  const slotGenerations = new Map();
  const componentStores = new Map();
  const resourceValues = new Map();
  const eventQueues = new Map();
  const queryPlans = new Map();
  let nextEntitySlot = 1;
  let componentVersion = 0;
  let worldVersion = 0;

  function getComponentStore(component) {
    assertDefinition(component, "component", "OpenECS");

    if (!componentStores.has(component.name)) {
      componentStores.set(component.name, new Map());
    }

    return componentStores.get(component.name);
  }

  function bumpComponentVersion() {
    componentVersion += 1;
    worldVersion += 1;
  }

  function assertEntity(entity) {
    const parsed = parseEntityHandle(entity);
    const currentGeneration = slotGenerations.get(parsed.slot);

    if (!aliveSlots.has(parsed.slot) || currentGeneration !== parsed.generation) {
      throw new Error(`Unknown or stale entity: ${parsed.handle}`);
    }

    return parsed.handle;
  }

  function hasEntity(entity) {
    try {
      assertEntity(entity);
      return true;
    } catch {
      return false;
    }
  }

  function reserveEntity() {
    const slot = freeSlots.length > 0 ? freeSlots.pop() : nextEntitySlot++;
    const generation = slotGenerations.get(slot) ?? 0;
    slotGenerations.set(slot, generation);
    return makeEntityHandle(slot, generation);
  }

  function commitEntity(handle) {
    const { slot, generation } = parseEntityHandle(handle);
    const currentGeneration = slotGenerations.get(slot);

    if (aliveSlots.has(slot) || currentGeneration !== generation) {
      throw new Error(`Cannot commit entity: ${handle}`);
    }

    aliveSlots.add(slot);
    aliveEntities.add(handle);
    worldVersion += 1;

    return handle;
  }

  function createEntity() {
    return commitEntity(reserveEntity());
  }

  function removeEntity(entity) {
    const handle = assertEntity(entity);
    const { slot, generation } = parseEntityHandle(handle);

    aliveEntities.delete(handle);
    aliveSlots.delete(slot);
    slotGenerations.set(slot, generation + 1);
    freeSlots.push(slot);

    for (const store of componentStores.values()) {
      store.delete(handle);
    }

    bumpComponentVersion();
    return true;
  }

  function planQuery(query) {
    const key = queryCacheKey(query);
    const cached = queryPlans.get(key);

    if (cached && cached.componentVersion === componentVersion) {
      return cached.plan;
    }

    const required = query.all.length > 0 ? query.all : query.any;
    let seedName = null;
    let seedSize = Infinity;

    for (const definition of required) {
      const size = getComponentStore(definition).size;
      if (size < seedSize) {
        seedSize = size;
        seedName = definition.name;
      }
    }

    const plan = Object.freeze({
      seedName,
      allNames: sortDefinitionNames(query.all),
      anyNames: sortDefinitionNames(query.any),
      noneNames: sortDefinitionNames(query.none),
      optionalNames: sortDefinitionNames(query.optional),
      resourceNames: sortDefinitionNames(query.resources)
    });

    queryPlans.set(key, { componentVersion, plan });
    return plan;
  }

  function entityMatchesPlan(entity, plan) {
    for (const name of plan.allNames) {
      if (!componentStores.get(name)?.has(entity)) {
        return false;
      }
    }

    if (plan.anyNames.length > 0 && !plan.anyNames.some((name) => componentStores.get(name)?.has(entity))) {
      return false;
    }

    for (const name of plan.noneNames) {
      if (componentStores.get(name)?.has(entity)) {
        return false;
      }
    }

    return true;
  }

  function runQuery(query) {
    const normalized = query.kind === "query" ? query : normalizeQuery(query);
    const plan = planQuery(normalized);
    const candidates = plan.seedName
      ? Array.from(componentStores.get(plan.seedName)?.keys() ?? [])
      : Array.from(aliveEntities);
    const result = [];

    for (const entity of candidates) {
      if (aliveEntities.has(entity) && entityMatchesPlan(entity, plan)) {
        result.push(entity);
      }
    }

    return result;
  }

  function runQueryData(query) {
    const normalized = query.kind === "query" ? query : normalizeQuery(query);
    const entities = runQuery(normalized);

    return entities.map((entity) => {
      const components = {};
      const optional = {};
      const resources = {};

      for (const definition of [...normalized.all, ...normalized.any]) {
        if (componentStores.get(definition.name)?.has(entity)) {
          components[definition.name] = componentStores.get(definition.name).get(entity);
        }
      }

      for (const definition of normalized.optional) {
        optional[definition.name] = componentStores.get(definition.name)?.get(entity);
      }

      for (const resource of normalized.resources) {
        resources[resource.name] = resourceValues.get(resource.name);
      }

      return { entity, components, optional, resources };
    });
  }

  function createCommandBuffer() {
    const commands = [];

    const buffer = {
      addEntity() {
        const entity = reserveEntity();
        commands.push({ type: "addEntity", entity });
        return entity;
      },

      removeEntity(entity) {
        commands.push({ type: "removeEntity", entity });
        return buffer;
      },

      setComponent(entity, component, value) {
        commands.push({ type: "setComponent", entity, component, value });
        return buffer;
      },

      removeComponent(entity, component) {
        commands.push({ type: "removeComponent", entity, component });
        return buffer;
      },

      setResource(resource, value) {
        commands.push({ type: "setResource", resource, value });
        return buffer;
      },

      removeResource(resource) {
        commands.push({ type: "removeResource", resource });
        return buffer;
      },

      emit(event, payload, options) {
        commands.push({ type: "emit", event, payload, options });
        return buffer;
      },

      flush() {
        world.flushCommands(buffer);
        return buffer;
      },

      get size() {
        return commands.length;
      },

      _drain() {
        return commands.splice(0, commands.length);
      }
    };

    return buffer;
  }

  function flushCommands(buffer) {
    if (!buffer || typeof buffer._drain !== "function") {
      throw new TypeError("flushCommands expects a command buffer created by createCommandBuffer().");
    }

    for (const command of buffer._drain()) {
      if (command.type === "addEntity") {
        commitEntity(command.entity);
      } else if (command.type === "removeEntity") {
        if (hasEntity(command.entity)) {
          removeEntity(command.entity);
        }
      } else if (command.type === "setComponent") {
        world.setComponent(command.entity, command.component, command.value);
      } else if (command.type === "removeComponent") {
        if (hasEntity(command.entity)) {
          world.removeComponent(command.entity, command.component);
        }
      } else if (command.type === "setResource") {
        world.setResource(command.resource, command.value);
      } else if (command.type === "removeResource") {
        world.removeResource(command.resource);
      } else if (command.type === "emit") {
        world.emit(command.event, command.payload, command.options);
      }
    }

    return world;
  }

  function snapshot(options = {}) {
    const includeEvents = options.includeEvents !== false;
    const components = {};
    const resources = {};
    const events = {};

    for (const [name, store] of componentStores.entries()) {
      components[name] = Array.from(store.entries()).map(([entity, value]) => [entity, cloneValue(value)]);
    }

    for (const [name, value] of resourceValues.entries()) {
      resources[name] = cloneValue(value);
    }

    if (includeEvents) {
      for (const [name, queue] of eventQueues.entries()) {
        events[name] = {
          current: cloneValue(queue.current),
          next: cloneValue(queue.next),
          history: cloneValue(queue.history),
          historyLimit: queue.historyLimit
        };
      }
    }

    return {
      version: SNAPSHOT_VERSION,
      nextEntitySlot,
      worldVersion,
      componentVersion,
      entities: Array.from(aliveEntities).map((entity) => {
        const { slot, generation } = parseEntityHandle(entity);
        return { entity, slot, generation };
      }),
      slotGenerations: Array.from(slotGenerations.entries()),
      components,
      resources,
      events
    };
  }

  function restore(snapshotValue) {
    if (!snapshotValue || snapshotValue.version !== SNAPSHOT_VERSION) {
      throw new TypeError(`Unsupported snapshot version: ${snapshotValue?.version}`);
    }

    aliveEntities.clear();
    aliveSlots.clear();
    freeSlots.length = 0;
    slotGenerations.clear();
    componentStores.clear();
    resourceValues.clear();
    eventQueues.clear();
    queryPlans.clear();

    nextEntitySlot = Number(snapshotValue.nextEntitySlot ?? 1);
    worldVersion = Number(snapshotValue.worldVersion ?? 0);
    componentVersion = Number(snapshotValue.componentVersion ?? 0);

    for (const [slot, generation] of snapshotValue.slotGenerations ?? []) {
      slotGenerations.set(Number(slot), Number(generation));
    }

    for (const entityRecord of snapshotValue.entities ?? []) {
      aliveEntities.add(entityRecord.entity);
      aliveSlots.add(entityRecord.slot);
      slotGenerations.set(entityRecord.slot, entityRecord.generation);
    }

    for (const [name, entries] of Object.entries(snapshotValue.components ?? {})) {
      componentStores.set(name, new Map(entries.map(([entity, value]) => [Number(entity), cloneValue(value)])));
    }

    for (const [name, value] of Object.entries(snapshotValue.resources ?? {})) {
      resourceValues.set(name, cloneValue(value));
    }

    for (const [name, queue] of Object.entries(snapshotValue.events ?? {})) {
      eventQueues.set(name, {
        current: cloneValue(queue.current ?? []),
        next: cloneValue(queue.next ?? []),
        history: cloneValue(queue.history ?? []),
        historyLimit: Number(queue.historyLimit ?? 0)
      });
    }

    return world;
  }

  function stats() {
    const componentCounts = {};
    let componentValueCount = 0;

    for (const [name, store] of componentStores.entries()) {
      componentCounts[name] = store.size;
      componentValueCount += store.size;
    }

    return {
      entities: aliveEntities.size,
      components: componentCounts,
      componentValues: componentValueCount,
      resources: resourceValues.size,
      eventTypes: eventQueues.size,
      worldVersion,
      componentVersion
    };
  }

  function inspect() {
    return {
      entities: Array.from(aliveEntities),
      components: Object.fromEntries(Array.from(componentStores.entries()).map(([name, store]) => [name, Array.from(store.keys())])),
      resources: Array.from(resourceValues.keys()),
      events: Object.fromEntries(Array.from(eventQueues.entries()).map(([name, queue]) => [
        name,
        {
          current: queue.current.length,
          next: queue.next.length,
          history: queue.history.length,
          historyLimit: queue.historyLimit
        }
      ])),
      stats: stats()
    };
  }

  const world = {
    addEntity: createEntity,

    getEntityRef(entity) {
      const handle = assertEntity(entity);
      const { slot, generation } = parseEntityHandle(handle);
      return Object.freeze({ id: handle, slot, generation });
    },

    hasEntity,

    removeEntity,

    setComponent(entity, component, value) {
      const handle = assertEntity(entity);
      const store = getComponentStore(component);
      const hadComponent = store.has(handle);
      store.set(handle, value);

      if (!hadComponent) {
        bumpComponentVersion();
      } else {
        worldVersion += 1;
      }

      return value;
    },

    getComponent(entity, component) {
      const handle = assertEntity(entity);
      return getComponentStore(component).get(handle);
    },

    hasComponent(entity, component) {
      const handle = assertEntity(entity);
      return getComponentStore(component).has(handle);
    },

    removeComponent(entity, component) {
      const handle = assertEntity(entity);
      const removed = getComponentStore(component).delete(handle);

      if (removed) {
        bumpComponentVersion();
      }

      return removed;
    },

    componentsOf(entity) {
      const handle = assertEntity(entity);
      return Array.from(componentStores.entries())
        .filter(([, store]) => store.has(handle))
        .map(([name]) => name)
        .sort();
    },

    setResource(resource, value) {
      assertDefinition(resource, "resource", "OpenECS");
      resourceValues.set(resource.name, value);
      worldVersion += 1;
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
      const removed = resourceValues.delete(resource.name);

      if (removed) {
        worldVersion += 1;
      }

      return removed;
    },

    emit(event, payload, options = {}) {
      const queue = ensureEventQueue(eventQueues, event);
      const target = options.delivery === "next" || options.next === true ? queue.next : queue.current;
      target.push(payload);
      worldVersion += 1;
      return payload;
    },

    readEvents(event, options = {}) {
      const queue = ensureEventQueue(eventQueues, event);
      const base = options.delivery === "next" ? queue.next : queue.current;
      const result = base.slice();

      if (options.includeHistory) {
        result.unshift(...queue.history);
      }

      return result;
    },

    configureEvent(event, options = {}) {
      const queue = ensureEventQueue(eventQueues, event);
      queue.historyLimit = Math.max(0, Number(options.historyLimit ?? queue.historyLimit ?? 0));
      return world;
    },

    clearEvents(event, options = {}) {
      const queue = ensureEventQueue(eventQueues, event);

      if (options.archive !== false) {
        archiveEvents(queue);
      }

      queue.current.length = 0;

      if (options.includeNext) {
        queue.next.length = 0;
      }

      if (options.includeHistory) {
        queue.history.length = 0;
      }

      return world;
    },

    clearAllEvents(options = {}) {
      for (const queue of eventQueues.values()) {
        if (options.archive !== false) {
          archiveEvents(queue);
        }
        queue.current.length = 0;

        if (options.includeNext) {
          queue.next.length = 0;
        }

        if (options.includeHistory) {
          queue.history.length = 0;
        }
      }

      return world;
    },

    advanceEvents() {
      for (const queue of eventQueues.values()) {
        archiveEvents(queue);
        queue.current = queue.next;
        queue.next = [];
      }

      return world;
    },

    query(...queryParts) {
      return runQuery(normalizeQuery(queryParts[0], queryParts.slice(1)));
    },

    queryEntities(query) {
      return runQuery(normalizeQuery(query));
    },

    queryData(query) {
      return runQueryData(normalizeQuery(query));
    },

    runSystem(components, handler) {
      if (!Array.isArray(components) || components.length === 0) {
        throw new TypeError("runSystem expects a non-empty component array.");
      }

      if (typeof handler !== "function") {
        throw new TypeError("runSystem expects a handler function.");
      }

      for (const entity of this.query(...components)) {
        const values = components.map((component) => getComponentStore(component).get(entity));
        handler(entity, ...values);
      }
    },

    createCommandBuffer,
    flushCommands,
    snapshot,
    restore,
    stats,
    inspect,

    get entityCount() {
      return aliveEntities.size;
    }
  };

  return world;
}

function normalizeSystemMetadata(system, options = {}) {
  if (typeof system !== "function") {
    throw new TypeError("Scheduler systems must be functions.");
  }

  const name = options.name ?? system.systemName ?? system.name ?? `system-${Math.random().toString(36).slice(2)}`;

  return {
    system,
    name,
    before: toArray(options.before),
    after: toArray(options.after),
    runIf: options.runIf,
    fixedStep: options.fixedStep === undefined ? null : Number(options.fixedStep),
    accumulator: 0
  };
}

function orderSystemEntries(entries) {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const visited = new Set();
  const visiting = new Set();
  const result = [];

  function visit(entry) {
    if (visited.has(entry.name)) {
      return;
    }

    if (visiting.has(entry.name)) {
      throw new Error(`Scheduler ordering cycle at system: ${entry.name}`);
    }

    visiting.add(entry.name);

    for (const dependencyName of entry.after) {
      const dependency = byName.get(dependencyName);
      if (dependency) {
        visit(dependency);
      }
    }

    for (const candidate of entries) {
      if (candidate.before.includes(entry.name)) {
        visit(candidate);
      }
    }

    visiting.delete(entry.name);
    visited.add(entry.name);
    result.push(entry);
  }

  for (const entry of entries) {
    visit(entry);
  }

  return result;
}

export function createScheduler(options = {}) {
  const phases = [];
  const systemsByPhase = new Map();
  const orderedSystemsByPhase = new Map();
  let systemCounter = 0;

  function markPhaseDirty(name) {
    orderedSystemsByPhase.delete(name);
  }

  function addPhase(name) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new TypeError("Scheduler phase name must be a non-empty string.");
    }

    if (!systemsByPhase.has(name)) {
      phases.push(name);
      systemsByPhase.set(name, []);
      markPhaseDirty(name);
    }

    return scheduler;
  }

  function getOrderedSystems(phaseName) {
    if (!orderedSystemsByPhase.has(phaseName)) {
      orderedSystemsByPhase.set(phaseName, orderSystemEntries(systemsByPhase.get(phaseName)));
    }

    return orderedSystemsByPhase.get(phaseName);
  }

  const scheduler = {
    addPhase,

    addSystem(phaseName, system, metadata = {}) {
      if (!systemsByPhase.has(phaseName)) {
        throw new Error(`Unknown phase: ${phaseName}`);
      }

      const entry = normalizeSystemMetadata(system, {
        ...metadata,
        name: metadata.name ?? system.systemName ?? system.name ?? `${phaseName}-${systemCounter += 1}`
      });

      systemsByPhase.get(phaseName).push(entry);
      markPhaseDirty(phaseName);
      return scheduler;
    },

    run(world, runOptions = {}) {
      if (!world || typeof world.advanceEvents !== "function") {
        throw new TypeError("Scheduler requires a world created by createWorld().");
      }

      const delta = Number(runOptions.delta ?? options.delta ?? 0);

      for (const phaseName of phases) {
        const commands = world.createCommandBuffer();
        const context = {
          scheduler,
          phase: phaseName,
          commands,
          delta
        };

        for (const entry of getOrderedSystems(phaseName)) {
          if (entry.runIf && entry.runIf(world, context) === false) {
            continue;
          }

          if (entry.fixedStep && entry.fixedStep > 0) {
            entry.accumulator += delta;
            while (entry.accumulator >= entry.fixedStep) {
              entry.system(world, { ...context, delta: entry.fixedStep });
              entry.accumulator -= entry.fixedStep;
            }
          } else {
            entry.system(world, context);
          }
        }

        world.flushCommands(commands);
      }

      world.advanceEvents();
      return world;
    },

    inspect() {
      return {
        phases: phases.slice(),
        systems: Object.fromEntries(phases.map((phaseName) => [
          phaseName,
          getOrderedSystems(phaseName).map((entry) => ({
            name: entry.name,
            before: entry.before.slice(),
            after: entry.after.slice(),
            fixedStep: entry.fixedStep
          }))
        ]))
      };
    },

    get phases() {
      return phases.slice();
    }
  };

  for (const phaseName of options.phases ?? DEFAULT_PHASES) {
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
