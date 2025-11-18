# Clean Architecture - Zombie Game

## Architecture Overview

Ce projet implémente une **Clean Architecture** stricte avec séparation claire des responsabilités.

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│                     (server.js)                          │
│  - Express routes                                        │
│  - Socket.IO handlers                                    │
│  - HTTP endpoints                                        │
└────────────────────┬─────────────────────────────────────┘
                     │ calls
                     ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│                 (lib/application/)                       │
│  - Use Cases (business logic orchestration)              │
│  - Container (Dependency Injection)                      │
│  - No framework dependencies                             │
└────────────────────┬─────────────────────────────────────┘
                     │ uses
                     ↓
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                          │
│                  (lib/domain/)                           │
│  - Entities (Player, GameSession)                        │
│  - Repository Interfaces                                 │
│  - Pure business logic                                   │
│  - Zero external dependencies                            │
└────────────────────┬─────────────────────────────────────┘
                     │ implemented by
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                     │
│               (lib/infrastructure/)                      │
│  - SQLite Repository implementations                     │
│  - Logger (Winston)                                      │
│  - Database Manager                                      │
│  - External dependencies                                 │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
lib/
├── domain/                    # Core business logic
│   ├── entities/             # Business entities
│   │   ├── Player.js        # Player entity with business methods
│   │   └── GameSession.js   # Session entity with state management
│   └── repositories/         # Repository interfaces (contracts)
│       ├── IPlayerRepository.js
│       └── ISessionRepository.js
│
├── application/              # Use cases & orchestration
│   ├── Container.js         # Dependency injection container
│   └── use-cases/           # Application business logic
│       ├── CreatePlayerUseCase.js
│       ├── UpdatePlayerStatsUseCase.js
│       ├── SaveSessionUseCase.js
│       ├── RecoverSessionUseCase.js
│       └── DisconnectSessionUseCase.js
│
├── infrastructure/           # External concerns
│   ├── Logger.js            # Winston logger
│   └── repositories/        # Concrete repository implementations
│       ├── SQLitePlayerRepository.js
│       └── SQLiteSessionRepository.js
│
├── database/                 # Database management
│   └── DatabaseManager.js   # SQLite connection & schema
│
└── server/                   # Game-specific managers (legacy)
    ├── ConfigManager.js
    ├── EntityManager.js
    ├── CollisionManager.js
    ├── NetworkManager.js
    ├── PlayerManager.js
    ├── RoomManager.js
    └── ZombieManager.js
```

## Key Principles

### 1. Dependency Inversion
- Domain layer defines **interfaces** (IPlayerRepository, ISessionRepository)
- Infrastructure layer provides **implementations** (SQLitePlayerRepository)
- Application layer depends on **abstractions**, not concrete implementations

### 2. Separation of Concerns
- **Domain**: Pure business logic, no frameworks
- **Application**: Orchestrates domain logic via use cases
- **Infrastructure**: Technical details (database, logging, etc.)

### 3. Testability
- Domain entities are easily testable (no dependencies)
- Use cases can be tested with mock repositories
- Infrastructure can be swapped (SQLite → PostgreSQL)

### 4. Single Responsibility
- Entities: Business data + behavior
- Use Cases: One business operation per class
- Repositories: Data persistence abstraction

## Usage Example

```javascript
// Initialize container
const container = Container.getInstance();
container.initialize();

// Use Case 1: Create Player
const createPlayer = container.get('createPlayer');
const player = await createPlayer.execute({
  id: 'player-123',
  username: 'JohnDoe'
});

// Use Case 2: Update Stats
const updateStats = container.get('updatePlayerStats');
await updateStats.execute({
  playerId: 'player-123',
  kills: 50,
  deaths: 2,
  wave: 10,
  level: 15,
  playtime: 1200,
  goldEarned: 5000
});

// Use Case 3: Save Session
const saveSession = container.get('saveSession');
await saveSession.execute({
  sessionId: 'session-456',
  playerId: 'player-123',
  socketId: 'socket-789',
  state: { wave: 10, health: 80 }
});
```

## Domain Entities

### Player Entity
- **Business Logic**: K/D ratio calculation, score calculation, record tracking
- **Methods**: `updateStats()`, `isNewRecord()`, `calculateScore()`, `getKDRatio()`
- **Persistence**: Via `IPlayerRepository`

### GameSession Entity
- **Business Logic**: Session lifecycle, reconnection, recovery timeout
- **Methods**: `disconnect()`, `reconnect()`, `isRecoverable()`, `isActive()`
- **Persistence**: Via `ISessionRepository`

## Use Cases (Application Layer)

### CreatePlayerUseCase
- Validates input (username length, uniqueness)
- Creates Player entity
- Persists via PlayerRepository

### UpdatePlayerStatsUseCase
- Fetches player from repository
- Updates stats via domain logic (`player.updateStats()`)
- Detects personal records
- Persists updated player

### SaveSessionUseCase
- Creates or updates session
- Saves state for recovery
- Handles disconnect/reconnect

### RecoverSessionUseCase
- Validates session is recoverable (timeout check)
- Reconnects with new socket
- Cleans up expired sessions

### DisconnectSessionUseCase
- Marks session as disconnected
- Enables recovery window
- Periodic cleanup of expired sessions

## Repository Pattern

### Interface (Domain)
```javascript
class IPlayerRepository {
  async findById(id) { throw new Error('Not implemented'); }
  async findByUsername(username) { throw new Error('Not implemented'); }
  async create(player) { throw new Error('Not implemented'); }
  async update(player) { throw new Error('Not implemented'); }
}
```

### Implementation (Infrastructure)
```javascript
class SQLitePlayerRepository extends IPlayerRepository {
  constructor(db) {
    this.db = db;
    this.prepareStatements(); // Prepared statements for performance
  }

  async findById(id) {
    const row = this.stmts.findById.get(id);
    return row ? Player.fromDB(row) : null;
  }
  // ...
}
```

## Benefits

✅ **Testable**: Domain logic is pure, easily tested
✅ **Maintainable**: Clear separation of concerns
✅ **Flexible**: Swap database/logger without touching business logic
✅ **Scalable**: Add features via new use cases
✅ **Professional**: Industry-standard architecture

## Migration Path

### Phase 1 ✅ (Completed)
- SQLite database with WAL mode
- Winston production logger
- Health check endpoint
- Memory leak fixes

### Phase 2 ✅ (Completed)
- Clean Architecture structure
- Domain entities (Player, GameSession)
- Repository pattern with SQLite implementation
- Use cases for core operations
- Dependency injection container

### Phase 3 (Next)
- Migrate game logic to use cases
- Add leaderboard use cases
- Implement permanent upgrades use cases
- Create API endpoints using use cases
- Add integration tests

## Testing

Run architecture validation test:
```bash
node test-architecture.js
```

Tests cover:
1. Player creation
2. Stats update
3. Session save/disconnect/recovery
4. Top players query
5. Repository operations
6. Domain entity business logic

## Performance

- **Prepared Statements**: All queries use prepared statements (10x faster)
- **WAL Mode**: SQLite Write-Ahead Logging (100x better concurrency)
- **Cached Queries**: Statement preparation at repository initialization
- **Optimized Pragmas**: 64MB cache, NORMAL sync, memory temp store

## Next Steps

1. **Migrate Existing Code**: Refactor server.js to use use cases
2. **Add Leaderboard**: `GetLeaderboardUseCase`, `SubmitScoreUseCase`
3. **Permanent Upgrades**: `BuyUpgradeUseCase`, `GetUpgradesUseCase`
4. **API Endpoints**: REST API using Express routes + use cases
5. **Integration Tests**: Test full stack with real database
6. **Documentation**: API docs with Swagger/OpenAPI
