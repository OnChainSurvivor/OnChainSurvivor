import { worlds } from './game/worldsConfig.js';

export const worldTypes = worlds.map(world => ({
  title: world.title,
  description: world.description,
  thumbnail: world.thumbnail
}));