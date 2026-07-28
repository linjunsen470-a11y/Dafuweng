export class MapRuntime {
  constructor(definition) {
    this.definition = definition;
    this.tiles = new Map(definition.tiles.map(tile => [tile.id, tile]));
    this.predecessors = new Map(definition.tiles.map(tile => [tile.id, []]));
    definition.tiles.forEach(tile => {
      (tile.next || []).forEach(nextId => this.predecessors.get(nextId)?.push(tile.id));
    });
  }

  getTile(tileId) {
    return this.tiles.get(tileId);
  }

  getNextOptions(tileId, direction = 1) {
    const options = direction >= 0
      ? this.getTile(tileId)?.next || []
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
