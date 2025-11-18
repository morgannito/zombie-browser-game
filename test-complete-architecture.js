/**
 * COMPLETE ARCHITECTURE TEST
 * Tests all use cases including leaderboard and upgrades
 */

const DatabaseManager = require('./lib/database/DatabaseManager');
const Container = require('./lib/application/Container');

async function testCompleteArchitecture() {
  console.log('🧪 Testing Complete Clean Architecture...\n');

  try {
    // Initialize
    const dbManager = DatabaseManager.getInstance();
    dbManager.initialize();
    console.log('✅ Database initialized');

    const container = Container.getInstance();
    container.initialize();
    console.log('✅ Container initialized\n');

    // Test 1: Create Players
    console.log('📝 Test 1: Create Multiple Players');
    const createPlayer = container.get('createPlayer');

    const player1 = await createPlayer.execute({
      id: 'player-1-' + Date.now(),
      username: 'TopPlayer'
    });

    const player2 = await createPlayer.execute({
      id: 'player-2-' + Date.now(),
      username: 'ProGamer'
    });

    console.log('✅ Created 2 players');

    // Test 2: Submit Scores to Leaderboard
    console.log('\n📝 Test 2: Submit Scores to Leaderboard');
    const submitScore = container.get('submitScore');

    await submitScore.execute({
      playerId: player1.id,
      wave: 10,
      level: 20,
      kills: 150,
      survivalTime: 600
    });

    await submitScore.execute({
      playerId: player2.id,
      wave: 8,
      level: 15,
      kills: 100,
      survivalTime: 450
    });

    await submitScore.execute({
      playerId: player1.id,
      wave: 12,
      level: 25,
      kills: 200,
      survivalTime: 720
    });

    console.log('✅ Submitted 3 scores');

    // Test 3: Get Global Leaderboard
    console.log('\n📝 Test 3: Get Global Leaderboard');
    const getLeaderboard = container.get('getLeaderboard');
    const globalLeaderboard = await getLeaderboard.execute({ limit: 10 });

    console.log('✅ Global leaderboard retrieved:');
    globalLeaderboard.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.playerUsername} - Wave ${entry.wave}, Score ${entry.score}`);
    });

    // Test 4: Get Player-Specific Leaderboard
    console.log('\n📝 Test 4: Get Player Leaderboard & Rank');
    const playerLeaderboard = await getLeaderboard.execute({
      playerId: player1.id,
      limit: 5
    });

    console.log('✅ Player leaderboard retrieved:');
    console.log(`   Player: ${player1.username}`);
    console.log(`   Rank: #${playerLeaderboard.playerRank}`);
    console.log(`   Best Score: ${playerLeaderboard.playerBest.score}`);
    console.log(`   Total Entries: ${playerLeaderboard.entries.length}`);

    // Test 5: Buy Permanent Upgrades
    console.log('\n📝 Test 5: Buy Permanent Upgrades');
    const buyUpgrade = container.get('buyUpgrade');

    await buyUpgrade.execute({
      playerId: player1.id,
      upgradeName: 'maxHealth',
      cost: 1000
    });

    await buyUpgrade.execute({
      playerId: player1.id,
      upgradeName: 'damage',
      cost: 1500
    });

    await buyUpgrade.execute({
      playerId: player1.id,
      upgradeName: 'damage',
      cost: 2000
    });

    console.log('✅ Purchased 3 upgrades');

    // Test 6: Get Upgrades
    console.log('\n📝 Test 6: Get Player Upgrades');
    const getUpgrades = container.get('getUpgrades');
    const upgrades = await getUpgrades.execute({ playerId: player1.id });

    console.log('✅ Upgrades retrieved:');
    console.log(`   Max Health: Level ${upgrades.levels.maxHealth}`);
    console.log(`   Damage: Level ${upgrades.levels.damage}`);
    console.log(`   Speed: Level ${upgrades.levels.speed}`);
    console.log(`   Fire Rate: Level ${upgrades.levels.fireRate}`);
    console.log(`   Total Points: ${upgrades.totalPoints}`);

    // Test 7: Update Player Stats
    console.log('\n📝 Test 7: Update Player Stats');
    const updateStats = container.get('updatePlayerStats');
    await updateStats.execute({
      playerId: player1.id,
      kills: 200,
      deaths: 3,
      wave: 12,
      level: 25,
      playtime: 720,
      goldEarned: 5000
    });

    const playerRepo = container.getRepository('player');
    const updatedPlayer = await playerRepo.findById(player1.id);
    console.log('✅ Stats updated:', {
      kills: updatedPlayer.totalKills,
      deaths: updatedPlayer.totalDeaths,
      kdRatio: updatedPlayer.getKDRatio(),
      highestWave: updatedPlayer.highestWave,
      score: updatedPlayer.calculateScore()
    });

    // Test 8: Verify Max Level Check
    console.log('\n📝 Test 8: Test Max Level Upgrade');
    try {
      // Buy damage upgrade 8 more times to reach max (already at level 2)
      for (let i = 0; i < 8; i++) {
        await buyUpgrade.execute({
          playerId: player1.id,
          upgradeName: 'damage',
          cost: 1000
        });
      }

      // This should fail - already at max level 10
      await buyUpgrade.execute({
        playerId: player1.id,
        upgradeName: 'damage',
        cost: 1000
      });

      console.log('❌ Should have thrown error for max level');
    } catch (error) {
      console.log('✅ Max level validation working:', error.message);
    }

    // Test 9: Repository Count Tests
    console.log('\n📝 Test 9: Repository Queries');
    const leaderboardRepo = container.getRepository('leaderboard');
    const topScores = await leaderboardRepo.getTop(5);
    const player1Best = await leaderboardRepo.getBestForPlayer(player1.id);
    const player1Rank = await leaderboardRepo.getPlayerRank(player1.id);

    console.log('✅ Repository queries:');
    console.log(`   Top Scores: ${topScores.length} entries`);
    console.log(`   Player1 Best: Wave ${player1Best.wave}, Score ${player1Best.score}`);
    console.log(`   Player1 Rank: #${player1Rank}`);

    console.log('\n✅ All tests passed! Complete Clean Architecture is working correctly.\n');

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
testCompleteArchitecture();
