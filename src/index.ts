import { GameServer } from '@/server/index';

async function main() {
  console.log('🧬 Among Us AI Server Starting...');

  // Create and start server
  const server = new GameServer(3000);

  // Create demo game
  await server.createDemoGame();

  // Start the HTTP server
  await server.start();

  // Start a game round after 2 seconds
  setTimeout(() => {
    console.log('🎮 Starting game round...');
    server.getGameState().startRound();
  }, 2000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.getGameState().cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
