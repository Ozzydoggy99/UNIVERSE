import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SliderDemo } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/lib/protected-route';
import { apiRequest } from '@/lib/queryClient';

// Import Phaser
import Phaser from 'phaser';

// Game initialization function (separated to avoid re-initialization)
const initGame = (containerId: string, playerId: number, onGameReady: (game: Phaser.Game) => void) => {
  // Game configuration
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: containerId,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: {
      preload: function(this: Phaser.Scene) {
        // Load assets
        this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        this.load.image('zombie', 'https://labs.phaser.io/assets/sprites/phaser-ship.png');
        this.load.image('background', 'https://labs.phaser.io/assets/skies/bigsky.png');
        this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
        this.load.image('health', 'https://labs.phaser.io/assets/sprites/firstaid.png');
        this.load.image('food', 'https://labs.phaser.io/assets/sprites/carrot.png');
      },
      create: function(this: Phaser.Scene) {
        // Create game objects
        const gameData = {
          player: null as Phaser.Physics.Arcade.Sprite | null,
          zombies: this.physics.add.group(),
          bullets: this.physics.add.group(),
          items: this.physics.add.group(),
          playerId: playerId,
          socket: new WebSocket(`ws://${window.location.host}/ws/game`),
          health: 100,
          hunger: 0,
          thirst: 0
        };
        
        // Store game data in scene for access in other methods
        this.data.set('gameData', gameData);
        
        // Create background
        this.add.image(400, 300, 'background').setScale(2);
        
        // Create player
        const player = this.physics.add.sprite(400, 300, 'player');
        player.setCollideWorldBounds(true);
        gameData.player = player;
        
        // Setup controls
        gameData.cursors = this.input.keyboard.createCursorKeys();
        
        // Setup collision detection
        this.physics.add.collider(gameData.player, gameData.zombies, this.handlePlayerZombieCollision, undefined, this);
        this.physics.add.collider(gameData.bullets, gameData.zombies, this.handleBulletZombieCollision, undefined, this);
        this.physics.add.overlap(gameData.player, gameData.items, this.handlePlayerItemCollision, undefined, this);
        
        // Setup websocket communication
        gameData.socket.onopen = () => {
          console.log('Connected to game server');
        };
        
        gameData.socket.onmessage = (event) => {
          this.handleSocketMessage(event);
        };
        
        gameData.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        gameData.socket.onclose = () => {
          console.log('Disconnected from game server');
        };
      },
      update: function(this: Phaser.Scene) {
        const gameData = this.data.get('gameData');
        if (!gameData || !gameData.player || !gameData.cursors) return;
        
        // Update player movement
        const player = gameData.player;
        const cursors = gameData.cursors;
        
        // Reset velocity
        player.setVelocity(0);
        
        // Handle player movement
        if (cursors.left.isDown) {
          player.setVelocityX(-160);
        } else if (cursors.right.isDown) {
          player.setVelocityX(160);
        }
        
        if (cursors.up.isDown) {
          player.setVelocityY(-160);
        } else if (cursors.down.isDown) {
          player.setVelocityY(160);
        }
        
        // Send player position update if moved
        if (player.body.velocity.x !== 0 || player.body.velocity.y !== 0) {
          this.sendPlayerUpdate(player.x, player.y);
        }
        
        // Update zombies AI
        gameData.zombies.getChildren().forEach((zombie: Phaser.Physics.Arcade.Sprite) => {
          // Simple AI: move toward player
          this.physics.moveToObject(zombie, player, 80);
        });
      },
      extend: {
        handlePlayerZombieCollision: function(player: Phaser.Physics.Arcade.Sprite, zombie: Phaser.Physics.Arcade.Sprite) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Reduce player health
          gameData.health -= 10;
          
          // Flash player to indicate damage
          this.tweens.add({
            targets: player,
            alpha: 0.5,
            duration: 100,
            yoyo: true
          });
          
          // Update player data
          if (gameData.socket.readyState === WebSocket.OPEN) {
            gameData.socket.send(JSON.stringify({
              type: 'player_update',
              playerId: gameData.playerId,
              health: gameData.health
            }));
          }
          
          // Check if player is dead
          if (gameData.health <= 0) {
            this.scene.pause();
            // Display game over message
            this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', color: '#ff0000' })
              .setOrigin(0.5);
          }
        },
        
        handleBulletZombieCollision: function(bullet: Phaser.Physics.Arcade.Sprite, zombie: Phaser.Physics.Arcade.Sprite) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Remove bullet
          bullet.destroy();
          
          // Reduce zombie health
          const zombieHealth = zombie.getData('health') - 20;
          zombie.setData('health', zombieHealth);
          
          // Send attack update
          if (gameData.socket.readyState === WebSocket.OPEN) {
            gameData.socket.send(JSON.stringify({
              type: 'player_attack',
              playerId: gameData.playerId,
              zombieId: zombie.getData('id'),
              damage: 20
            }));
          }
          
          // Check if zombie is defeated
          if (zombieHealth <= 0) {
            // Create random item drop
            if (Math.random() > 0.7) {
              const itemType = Math.random() > 0.5 ? 'health' : 'food';
              const item = gameData.items.create(zombie.x, zombie.y, itemType);
              item.setData('type', itemType);
            }
            
            // Remove zombie
            zombie.destroy();
          } else {
            // Flash zombie to indicate damage
            this.tweens.add({
              targets: zombie,
              alpha: 0.5,
              duration: 100,
              yoyo: true
            });
          }
        },
        
        handlePlayerItemCollision: function(player: Phaser.Physics.Arcade.Sprite, item: Phaser.Physics.Arcade.Sprite) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          const itemType = item.getData('type');
          
          if (itemType === 'health') {
            // Increase health
            gameData.health = Math.min(gameData.health + 20, 100);
          } else if (itemType === 'food') {
            // Reduce hunger
            gameData.hunger = Math.max(gameData.hunger - 30, 0);
          }
          
          // Update player data
          if (gameData.socket.readyState === WebSocket.OPEN) {
            gameData.socket.send(JSON.stringify({
              type: 'player_update',
              playerId: gameData.playerId,
              health: gameData.health,
              hunger: gameData.hunger
            }));
          }
          
          // Remove item
          item.destroy();
        },
        
        sendPlayerUpdate: function(x: number, y: number) {
          const gameData = this.data.get('gameData');
          if (!gameData || gameData.socket.readyState !== WebSocket.OPEN) return;
          
          gameData.socket.send(JSON.stringify({
            type: 'player_update',
            playerId: gameData.playerId,
            x: x,
            y: y
          }));
        },
        
        handleSocketMessage: function(event: MessageEvent) {
          try {
            const message = JSON.parse(event.data);
            const gameData = this.data.get('gameData');
            if (!gameData) return;
            
            switch (message.type) {
              case 'game_state':
                // Initialize game state with server data
                this.handleGameState(message.data);
                break;
                
              case 'player_updated':
                // Update other player
                if (message.data.id !== gameData.playerId) {
                  this.updateOtherPlayer(message.data);
                }
                break;
                
              case 'zombie_updated':
                // Update zombie
                this.updateZombie(message.data);
                break;
                
              case 'zombie_spawned':
                // Spawn new zombie
                this.spawnZombie(message.data);
                break;
                
              case 'zombie_defeated':
                // Remove zombie
                this.removeZombie(message.data.zombieId);
                break;
            }
          } catch (error) {
            console.error('Error handling socket message:', error);
          }
        },
        
        handleGameState: function(data: any) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Handle players
          data.players.forEach((playerData: any) => {
            if (playerData.id === gameData.playerId) {
              // Update our player data
              gameData.health = playerData.health;
              gameData.hunger = playerData.hunger;
              gameData.thirst = playerData.thirst;
            } else {
              // Create or update other players
              this.updateOtherPlayer(playerData);
            }
          });
          
          // Handle zombies
          data.zombies.forEach((zombieData: any) => {
            this.spawnZombie(zombieData);
          });
          
          // Handle items
          data.items.forEach((itemData: any) => {
            this.spawnItem(itemData);
          });
        },
        
        updateOtherPlayer: function(playerData: any) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Find existing player sprite
          let playerSprite = this.children.getByName(`player_${playerData.id}`);
          
          if (!playerSprite) {
            // Create new player sprite
            playerSprite = this.physics.add.sprite(playerData.lastX, playerData.lastY, 'player');
            playerSprite.setName(`player_${playerData.id}`);
            playerSprite.setTint(0x0000ff); // Blue tint for other players
            
            // Add username label
            const label = this.add.text(0, -20, playerData.username, { fontSize: '14px', color: '#ffffff' });
            label.setOrigin(0.5);
            
            // Create container for player and label
            const container = this.add.container(playerData.lastX, playerData.lastY, [playerSprite, label]);
            container.setName(`player_container_${playerData.id}`);
            
            // Store player data
            playerSprite.setData('id', playerData.id);
            playerSprite.setData('container', container);
          } else {
            // Update player position
            const container = playerSprite.getData('container');
            if (container) {
              // Move container to new position
              this.tweens.add({
                targets: container,
                x: playerData.lastX,
                y: playerData.lastY,
                duration: 100,
                ease: 'Linear'
              });
            }
          }
        },
        
        spawnZombie: function(zombieData: any) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Find existing zombie sprite
          let zombie = this.children.getByName(`zombie_${zombieData.id}`);
          
          if (!zombie) {
            // Create new zombie sprite
            zombie = gameData.zombies.create(zombieData.x, zombieData.y, 'zombie');
            zombie.setName(`zombie_${zombieData.id}`);
            
            // Store zombie data
            zombie.setData('id', zombieData.id);
            zombie.setData('health', zombieData.health || 100);
            zombie.setData('type', zombieData.type || 'standard');
            
            // Adjust appearance based on type
            if (zombieData.type === 'runner') {
              zombie.setTint(0xff0000); // Red tint for runners
              zombie.setScale(0.8); // Smaller size
            } else if (zombieData.type === 'tank') {
              zombie.setTint(0x00ff00); // Green tint for tanks
              zombie.setScale(1.2); // Larger size
            }
          } else {
            // Update zombie position
            this.tweens.add({
              targets: zombie,
              x: zombieData.x,
              y: zombieData.y,
              duration: 100,
              ease: 'Linear'
            });
            
            // Update zombie health
            if (zombieData.health !== undefined) {
              zombie.setData('health', zombieData.health);
            }
          }
        },
        
        removeZombie: function(zombieId: number) {
          const zombie = this.children.getByName(`zombie_${zombieId}`);
          if (zombie) {
            zombie.destroy();
          }
        },
        
        spawnItem: function(itemData: any) {
          const gameData = this.data.get('gameData');
          if (!gameData) return;
          
          // Find existing item sprite
          let item = this.children.getByName(`item_${itemData.id}`);
          
          if (!item) {
            // Determine item sprite based on type
            let spriteKey = 'health';
            if (itemData.type === 'food') {
              spriteKey = 'food';
            } else if (itemData.type === 'weapon') {
              spriteKey = 'bullet'; // Use bullet as weapon icon
            }
            
            // Create new item sprite
            item = gameData.items.create(itemData.x, itemData.y, spriteKey);
            item.setName(`item_${itemData.id}`);
            
            // Store item data
            item.setData('id', itemData.id);
            item.setData('type', itemData.type);
            
            // Add simple animation
            this.tweens.add({
              targets: item,
              y: item.y - 10,
              duration: 1000,
              yoyo: true,
              repeat: -1
            });
          }
        },
        
        fireBullet: function() {
          const gameData = this.data.get('gameData');
          if (!gameData || !gameData.player) return;
          
          // Create bullet at player position
          const bullet = gameData.bullets.create(gameData.player.x, gameData.player.y, 'bullet');
          
          // Get direction to mouse pointer
          const pointer = this.input.activePointer;
          const angle = Phaser.Math.Angle.Between(
            gameData.player.x, gameData.player.y,
            pointer.worldX, pointer.worldY
          );
          
          // Set bullet velocity
          const speed = 500;
          bullet.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
          );
          
          // Set bullet rotation
          bullet.setRotation(angle);
          
          // Auto-destroy bullet after 1 second
          this.time.delayedCall(1000, () => {
            bullet.destroy();
          });
        }
      }
    }
  };
  
  // Create and return the game instance
  const game = new Phaser.Game(config);
  onGameReady(game);
  return game;
};

function Game() {
  const { user } = useAuth();
  const { toast } = useToast();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  const queryClient = useQueryClient();

  // Query for player data
  const { data: playerData, isLoading: isLoadingPlayer } = useQuery({
    queryKey: ['/api/game/players/user', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      try {
        // Check if player exists for this user
        const players = await apiRequest<any[]>('/api/game/players');
        const existingPlayer = players.find(p => p.userId === user.id);
        
        if (existingPlayer) {
          return existingPlayer;
        }
        
        // If no player exists, create one
        return await apiRequest('/api/game/players', {
          method: 'POST',
          body: JSON.stringify({
            userId: user.id,
            username: user.username,
            health: 100,
            hunger: 0,
            thirst: 0,
            lastX: 400,
            lastY: 300,
            inventory: '[]'
          })
        });
      } catch (error) {
        console.error('Error fetching/creating player:', error);
        toast({
          title: 'Error',
          description: 'Failed to load or create player data',
          variant: 'destructive'
        });
        return null;
      }
    },
    enabled: !!user
  });

  // Initialize the game when player data is available
  useEffect(() => {
    if (!gameContainerRef.current || !playerData || gameInstance) return;
    
    // Initialize game
    const game = initGame(
      'game-container', 
      playerData.id, 
      (gameInstance) => {
        setGameInstance(gameInstance);
        
        // Set up click handler for firing
        const scene = gameInstance.scene.getScene('default');
        if (scene) {
          scene.input.on('pointerdown', function(this: Phaser.Input.InputPlugin) {
            if (this.scene.sys.game.device.input.mouse) {
              (this.scene as any).fireBullet();
            }
          });
        }
      }
    );
    
    // Cleanup when component unmounts
    return () => {
      if (game) {
        game.destroy(true);
      }
    };
  }, [playerData, gameInstance]);

  // Update player stats from game
  const updatePlayerMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!playerData) return null;
      return await apiRequest(`/api/game/players/${playerData.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/game/players'] });
    }
  });

  // Spawn zombie for testing
  const spawnZombieMutation = useMutation({
    mutationFn: async (position: { x: number, y: number }) => {
      return await apiRequest('/api/game/zombies', {
        method: 'POST',
        body: JSON.stringify({
          type: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'runner' : 'tank') : 'standard',
          health: 100,
          damage: Math.random() > 0.7 ? 20 : 10,
          speed: Math.random() > 0.8 ? 2 : 1,
          x: position.x,
          y: position.y
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/game/zombies'] });
    }
  });

  const handleSpawnZombie = () => {
    // Spawn zombie at random position around the map edges
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let x, y;
    
    switch (side) {
      case 0: // top
        x = Math.random() * 800;
        y = 0;
        break;
      case 1: // right
        x = 800;
        y = Math.random() * 600;
        break;
      case 2: // bottom
        x = Math.random() * 800;
        y = 600;
        break;
      case 3: // left
        x = 0;
        y = Math.random() * 600;
        break;
      default:
        x = 0;
        y = 0;
    }
    
    spawnZombieMutation.mutate({ x, y });
    
    toast({
      title: 'Zombie Spawned',
      description: 'A new zombie has appeared!',
      variant: 'default'
    });
  };

  if (isLoadingPlayer) {
    return (
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardContent className="flex items-center justify-center h-64">
          <p>Loading game...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!playerData) {
    return (
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardContent className="flex flex-col items-center justify-center h-64">
          <p className="mb-4">Failed to load player data</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/game/players/user'] })}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Zombie Survival Game</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-2">
              <div id="game-container" ref={gameContainerRef} className="w-full rounded overflow-hidden"></div>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <Tabs defaultValue="stats">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="controls">Controls</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stats" className="mt-2">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-2">Player Stats</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm mb-1">Health: {playerData?.health || 100}/100</p>
                      <SliderDemo 
                        min={0} 
                        max={100} 
                        step={1} 
                        defaultValue={[playerData?.health || 100]} 
                        disabled 
                      />
                    </div>
                    
                    <div>
                      <p className="text-sm mb-1">Hunger: {playerData?.hunger || 0}/100</p>
                      <SliderDemo 
                        min={0} 
                        max={100} 
                        step={1} 
                        defaultValue={[playerData?.hunger || 0]} 
                        disabled 
                      />
                    </div>
                    
                    <div>
                      <p className="text-sm mb-1">Thirst: {playerData?.thirst || 0}/100</p>
                      <SliderDemo 
                        min={0} 
                        max={100} 
                        step={1} 
                        defaultValue={[playerData?.thirst || 0]} 
                        disabled 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      onClick={handleSpawnZombie}
                      variant="secondary"
                      className="w-full"
                      disabled={spawnZombieMutation.isPending}
                    >
                      {spawnZombieMutation.isPending ? 'Spawning...' : 'Spawn Test Zombie'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="inventory" className="mt-2">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-4">Inventory</h3>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i} 
                        className="aspect-square border border-gray-300 rounded flex items-center justify-center"
                      >
                        <span className="text-gray-400 text-xs">Empty</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="controls" className="mt-2">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-2">Game Controls</h3>
                  
                  <ul className="space-y-2 text-sm">
                    <li><strong>Move:</strong> Arrow Keys or WASD</li>
                    <li><strong>Shoot:</strong> Left Mouse Click</li>
                    <li><strong>Collect Items:</strong> Walk over them</li>
                  </ul>
                  
                  <div className="mt-6">
                    <p className="text-sm mb-2"><strong>Objective:</strong></p>
                    <p className="text-sm">
                      Survive as long as possible by killing zombies and collecting health and food items. 
                      Watch your health, hunger, and thirst levels.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <ProtectedRoute>
      <Game />
    </ProtectedRoute>
  );
}