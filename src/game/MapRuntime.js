export class MapRuntime {
  constructor(definition) {
    this.definition = definition;
    this.tiles = new Map(definition.tiles.map(tile => [tile.id, tile]));
    this.edgeOverrides = new Map();
    this.rebuildPredecessors();
  }

  rebuildPredecessors() {
    this.predecessors = new Map(this.definition.tiles.map(tile => [tile.id, []]));
    this.definition.tiles.forEach(tile => {
      this.getForwardOptions(tile.id).forEach(nextId => this.predecessors.get(nextId)?.push(tile.id));
    });
  }

  getForwardOptions(tileId) {
    return this.edgeOverrides.get(tileId) || this.getTile(tileId)?.next || [];
  }

  setNextOptions(tileId, options = null) {
    if (options?.length) this.edgeOverrides.set(Number(tileId), [...options]);
    else this.edgeOverrides.delete(Number(tileId));
    this.rebuildPredecessors();
  }

  getTile(tileId) {
    return this.tiles.get(tileId);
  }

  getNextOptions(tileId, direction = 1) {
    const options = direction >= 0
      ? this.getForwardOptions(tileId)
      : this.predecessors.get(tileId) || [];
    return [...options];
  }

  projectPath(startId, steps, direction = 1, choose = options => options[0]) {
    const path = [];
    let current = startId;
    for (let i = 0; i < steps; i++) {
      const options = this.getNextOptions(current, direction);
      if (!options.length) break;
      const selected = choose(options, current, i);
      current = options.includes(selected) ? selected : options[0];
      path.push(current);
    }
    return path;
  }

  getReachable(startId, maxSteps, directions = [1]) {
    const found = new Map();
    const queue = directions.map(direction => ({ id: startId, distance: 0, direction }));
    while (queue.length) {
      const current = queue.shift();
      if (current.distance >= maxSteps) continue;
      this.getNextOptions(current.id, current.direction).forEach(nextId => {
        const distance = current.distance + 1;
        const key = `${current.direction}:${nextId}`;
        if (!found.has(key) || found.get(key).distance > distance) {
          found.set(key, { id: nextId, distance, direction: current.direction });
          queue.push({ id: nextId, distance, direction: current.direction });
        }
      });
    }
    return [...found.values()];
  }
}
