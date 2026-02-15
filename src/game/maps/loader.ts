import { MapDefinitionSchema, type MapDefinition } from './types';
import { logger } from '@/utils/logger';

/**
 * MapLoader manages map registration and selection
 */
export class MapLoader {
  private maps: Map<string, MapDefinition> = new Map();
  private defaultMapId: string | null = null;

  /**
   * Register a map definition
   * First registered map becomes the default
   */
  register(map: MapDefinition): void {
    const parsed = MapDefinitionSchema.parse(map);

    if (this.maps.size === 0) {
      this.defaultMapId = parsed.id;
    }

    this.maps.set(parsed.id, parsed);
    logger.debug('Map registered', { mapId: parsed.id, mapName: parsed.name });
  }

  /**
   * Get a specific map by ID
   */
  get(mapId: string): MapDefinition | undefined {
    return this.maps.get(mapId);
  }

  /**
   * Get all registered map IDs
   */
  getMapIds(): string[] {
    return Array.from(this.maps.keys());
  }

  /**
   * Select a random map (uniform distribution)
   */
  selectRandom(): MapDefinition {
    const mapIds = this.getMapIds();

    if (mapIds.length === 0) {
      throw new Error('No maps registered');
    }

    const randomIndex = Math.floor(Math.random() * mapIds.length);
    const selectedId = mapIds[randomIndex];
    const selectedMap = this.maps.get(selectedId)!;

    logger.info('Map selected randomly', {
      mapId: selectedId,
      mapName: selectedMap.name,
    });
    return selectedMap;
  }

  /**
   * Get the default map (first registered)
   */
  getDefault(): MapDefinition | undefined {
    if (!this.defaultMapId) return undefined;
    return this.maps.get(this.defaultMapId);
  }

  /**
   * Check if a map exists
   */
  has(mapId: string): boolean {
    return this.maps.has(mapId);
  }
}
