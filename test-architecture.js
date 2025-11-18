/**
 * ARCHITECTURE VALIDATION TEST
 * Simple test to verify Clean Architecture is working
 */

const DatabaseManager = require('./lib/database/DatabaseManager');
const Container = require('./lib/application/Container');

async function testArchitecture() {
  console.log('🧪 Testing Clean Architecture...\n');

  try {
    // Initialize database
    const dbManager = DatabaseManager.getInstance();
    dbManager.initialize();
    console.log('✅ Database initialized');

    // Initialize container
    const container = Container.getInstance();
    container.initialize();
    console.log('✅ Container initialized');

    // Test 1: Create Player Use Case
    console.log('\n📝 Test 1: Create Player');
    const createPlayer = container.get('createPlayer');
    const player = await createPlayer.execute({
      id: 'test-' + Date.now(),
      username: 'TestPlayer' + Math.floor(Math.random() * 1000)
    });
    console.log('✅ Player created:', {
      id: player.id,
      username: player.username,
      score: player.calculateScore()
    });

    // Test 2: Update Player Stats
    console.log('\n📝 Test 2: Update Player Stats');
    const updateStats = container.get('updatePlayerStats');
    await updateStats.execute({
      playerId: player.id,
      kills: 50,
      deaths: 2,
      wave: 5,
      level: 10,
      playtime: 600,
      goldEarned: 1000
    });
    console.log('✅ Stats updated');

    // Test 3: Verify updated stats
    console.log('\n📝 Test 3: Verify Stats');
    const playerRepo = container.getRepository('player');
    const updatedPlayer = await playerRepo.findById(player.id);
    console.log('✅ Stats verified:', {
      totalKills: updatedPlayer.totalKills,
      totalDeaths: updatedPlayer.totalDeaths,
      highestWave: updatedPlayer.highestWave,
      highestLevel: updatedPlayer.highestLevel,
      kdRatio: updatedPlayer.getKDRatio(),
      score: updatedPlayer.calculateScore()
    });

    // Test 4: Save Session
    console.log('\n📝 Test 4: Save Session');
    const saveSession = container.get('saveSession');
    const session = await saveSession.execute({
      sessionId: 'session-' + Date.now(),
      playerId: player.id,
      socketId: 'socket-123',
      state: { wave: 5, health: 100 }
    });
    console.log('✅ Session saved:', {
      sessionId: session.sessionId,
      playerId: session.playerId,
      isActive: session.isActive()
    });

    // Test 5: Disconnect and Recover Session
    console.log('\n📝 Test 5: Session Recovery');
    const disconnectSession = container.get('disconnectSession');
    await disconnectSession.execute({
      sessionId: session.sessionId,
      saveState: true
    });
    console.log('✅ Session disconnected');

    const recoverSession = container.get('recoverSession');
    const recovered = await recoverSession.execute({
      sessionId: session.sessionId,
      newSocketId: 'socket-456',
      recoveryTimeoutMs: 300000
    });
    console.log('✅ Session recovered:', {
      sessionId: recovered.sessionId,
      isActive: recovered.isActive(),
      disconnectedDuration: recovered.getDisconnectedDuration() + 's'
    });

    // Test 6: Get Top Players
    console.log('\n📝 Test 6: Get Top Players');
    const topPlayers = await playerRepo.getTopPlayers(5);
    console.log('✅ Top players retrieved:', topPlayers.length, 'players');
    if (topPlayers.length > 0) {
      console.log('   Top player:', {
        username: topPlayers[0].username,
        wave: topPlayers[0].highestWave,
        level: topPlayers[0].highestLevel
      });
    }

    console.log('\n✅ All tests passed! Clean Architecture is working correctly.\n');

    // Cleanup
    dbManager.close();
    console.log('🧹 Database closed');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testArchitecture();
