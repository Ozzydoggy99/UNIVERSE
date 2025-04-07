import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useToast } from '../hooks/use-toast';
import { connectToGameServer, disconnectFromGameServer, sendGameAction } from '../lib/api';

// Create a simple Phaser game configuration
const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: {
    preload: function(this: Phaser.Scene) {
      // This function will be defined later when we have the game instance
    },
    create: function(this: Phaser.Scene) {
      // This function will be defined later when we have the game instance
    },
    update: function(this: Phaser.Scene) {
      // This function will be defined later when we have the game instance
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  parent: 'game-container',
};

const Game: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!gameContainerRef.current) return;

    // Initialize Phaser game
    if (!gameRef.current) {
      const game = new Phaser.Game({
        ...gameConfig,
        callbacks: {
          postBoot: (game) => {
            // Resize the game on window resize
            const resize = () => {
              const w = window.innerWidth;
              const h = window.innerHeight - 100; // Account for header/footer
              game.scale.resize(w, h);
            };
            window.addEventListener('resize', resize, false);
            resize();
          }
        }
      });

      // Store the game instance
      gameRef.current = game;

      // Access the main scene
      const mainScene = game.scene.scenes[0];

      // Define the preload function to load assets
      mainScene.preload = function() {
        // Load player, zombie, and item sprites
        this.load.spritesheet('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png', { 
          frameWidth: 32, 
          frameHeight: 48 
        });
        
        this.load.spritesheet('zombie', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/dude.png', { 
          frameWidth: 32, 
          frameHeight: 48 
        });
        
        this.load.image('bullet', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullet.png');
        this.load.image('medkit', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/firstaid.png');
        this.load.image('ammo', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/bullets.png');
        this.load.image('ground', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/platform.png');
      };

      // Define variables for game objects
      let player: Phaser.Physics.Arcade.Sprite;
      let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
      let zombies: Phaser.Physics.Arcade.Group;
      let items: Phaser.Physics.Arcade.Group;
      let bullets: Phaser.Physics.Arcade.Group;
      let worldTiles: Phaser.Physics.Arcade.StaticGroup;
      
      // Game state
      let health = 100;
      let ammo = 30;
      let score = 0;
      
      // UI elements
      let healthText: Phaser.GameObjects.Text;
      let ammoText: Phaser.GameObjects.Text;
      let scoreText: Phaser.GameObjects.Text;

      // Define the create function to set up the game world
      mainScene.create = function() {
        // Create world tiles
        worldTiles = this.physics.add.staticGroup();
        
        // Create a simple floor
        for (let i = 0; i < 20; i++) {
          worldTiles.create(i * 64, 600, 'ground');
        }
        
        // Create player
        player = this.physics.add.sprite(100, 450, 'player');
        player.setBounce(0.2);
        player.setCollideWorldBounds(true);
        
        // Set up player animations
        this.anims.create({
          key: 'left',
          frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
          frameRate: 10,
          repeat: -1
        });
        
        this.anims.create({
          key: 'turn',
          frames: [ { key: 'player', frame: 4 } ],
          frameRate: 20
        });
        
        this.anims.create({
          key: 'right',
          frames: this.anims.generateFrameNumbers('player', { start: 5, end: 8 }),
          frameRate: 10,
          repeat: -1
        });
        
        // Set up keyboard controls
        cursors = this.input.keyboard.createCursorKeys();
        
        // Create groups for game objects
        zombies = this.physics.add.group();
        items = this.physics.add.group();
        bullets = this.physics.add.group({
          defaultKey: 'bullet',
          maxSize: 50
        });
        
        // Add collision between player and world
        this.physics.add.collider(player, worldTiles);
        this.physics.add.collider(zombies, worldTiles);
        this.physics.add.collider(items, worldTiles);
        
        // Add overlap handlers
        this.physics.add.overlap(player, zombies, handleZombieCollision, null, this);
        this.physics.add.overlap(player, items, collectItem, null, this);
        this.physics.add.overlap(bullets, zombies, hitZombie, null, this);
        
        // Add UI elements
        healthText = this.add.text(16, 16, 'Health: 100', { fontSize: '18px', color: '#fff' });
        ammoText = this.add.text(16, 46, 'Ammo: 30', { fontSize: '18px', color: '#fff' });
        scoreText = this.add.text(16, 76, 'Score: 0', { fontSize: '18px', color: '#fff' });
        
        // Add fire button
        this.input.keyboard.on('keydown-SPACE', fireWeapon, this);
        
        // Spawn zombies periodically
        this.time.addEvent({
          delay: 3000,
          callback: spawnZombie,
          callbackScope: this,
          loop: true
        });
        
        // Spawn items periodically
        this.time.addEvent({
          delay: 10000,
          callback: spawnItem,
          callbackScope: this,
          loop: true
        });

        // Send player spawn event to server
        sendGameAction('playerSpawn', {
          x: player.x,
          y: player.y
        });
      };
      
      // Functions for game mechanics
      function handleZombieCollision(player: any, zombie: any) {
        health -= 5;
        healthText.setText('Health: ' + health);
        
        // Flash player red to indicate damage
        mainScene.tweens.add({
          targets: player,
          alpha: 0.5,
          duration: 100,
          ease: 'Linear',
          yoyo: true
        });
        
        if (health <= 0) {
          player.setTint(0xff0000);
          player.anims.play('turn');
          
          // Game over
          mainScene.physics.pause();
          mainScene.add.text(
            mainScene.cameras.main.centerX, 
            mainScene.cameras.main.centerY, 
            'GAME OVER - Click to restart', 
            { fontSize: '32px', color: '#fff' }
          ).setOrigin(0.5);
          
          mainScene.input.on('pointerdown', () => {
            health = 100;
            ammo = 30;
            score = 0;
            mainScene.scene.restart();
          });
          
          // Send death event to server
          sendGameAction('playerDeath', {});
        }
      }
      
      function collectItem(player: any, item: any) {
        item.disableBody(true, true);
        
        if (item.texture.key === 'medkit') {
          health = Math.min(health + 20, 100);
          healthText.setText('Health: ' + health);
        } else if (item.texture.key === 'ammo') {
          ammo += 15;
          ammoText.setText('Ammo: ' + ammo);
        }
        
        // Send item collected event to server
        sendGameAction('itemCollected', {
          itemId: item.getData('id'),
          type: item.texture.key
        });
      }
      
      function spawnZombie() {
        // Spawn zombie off-screen
        const side = Phaser.Math.Between(0, 3);
        let x, y;
        
        if (side === 0) { // Top
          x = Phaser.Math.Between(0, 800);
          y = -50;
        } else if (side === 1) { // Right
          x = 850;
          y = Phaser.Math.Between(0, 600);
        } else if (side === 2) { // Bottom
          x = Phaser.Math.Between(0, 800);
          y = 650;
        } else { // Left
          x = -50;
          y = Phaser.Math.Between(0, 600);
        }
        
        const zombie = zombies.create(x, y, 'zombie');
        zombie.setTint(0x00ff00); // Green tint to distinguish from player
        zombie.setBounce(0.2);
        zombie.setCollideWorldBounds(true);
        zombie.setData('id', Date.now().toString());
        zombie.setData('health', 30);
        
        // Send zombie spawn event to server
        sendGameAction('zombieSpawn', {
          id: zombie.getData('id'),
          x: zombie.x,
          y: zombie.y
        });
      }
      
      function spawnItem() {
        const x = Phaser.Math.Between(100, 700);
        const y = Phaser.Math.Between(100, 500);
        const itemType = Phaser.Math.Between(0, 1) === 0 ? 'medkit' : 'ammo';
        
        const item = items.create(x, y, itemType);
        item.setBounce(0.4);
        item.setCollideWorldBounds(true);
        item.setData('id', Date.now().toString());
        
        // Send item spawn event to server
        sendGameAction('itemSpawn', {
          id: item.getData('id'),
          type: itemType,
          x: item.x,
          y: item.y
        });
      }
      
      function fireWeapon() {
        if (ammo <= 0) return;
        
        ammo--;
        ammoText.setText('Ammo: ' + ammo);
        
        const bullet = bullets.get(player.x, player.y - 10);
        
        if (bullet) {
          bullet.setActive(true);
          bullet.setVisible(true);
          
          // Set bullet direction based on player facing
          const direction = player.flipX ? -1 : 1;
          bullet.setVelocityX(direction * 400);
          
          // Send bullet fired event to server
          sendGameAction('bulletFired', {
            x: bullet.x,
            y: bullet.y,
            direction: direction
          });
        }
      }
      
      function hitZombie(bullet: any, zombie: any) {
        bullet.setActive(false);
        bullet.setVisible(false);
        
        let zombieHealth = zombie.getData('health');
        zombieHealth -= 10;
        zombie.setData('health', zombieHealth);
        
        // Flash zombie
        mainScene.tweens.add({
          targets: zombie,
          alpha: 0.5,
          duration: 50,
          ease: 'Linear',
          yoyo: true
        });
        
        if (zombieHealth <= 0) {
          zombie.disableBody(true, true);
          score += 10;
          scoreText.setText('Score: ' + score);
          
          // Send zombie killed event to server
          sendGameAction('zombieKilled', {
            id: zombie.getData('id')
          });
        }
      }

      // Create a handler for WebSocket messages
      const handleSocketMessage = function(event: MessageEvent) {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'playerJoined':
              toast({
                title: 'Player Joined',
                description: `${message.username} has joined the game.`
              });
              break;
            case 'playerLeft':
              toast({
                title: 'Player Left',
                description: `${message.username} has left the game.`
              });
              break;
            case 'zombieSpawn':
              // Handle zombie spawn from other players
              if (!message.fromSelf) {
                const zombie = zombies.create(message.x, message.y, 'zombie');
                zombie.setTint(0x00ff00);
                zombie.setBounce(0.2);
                zombie.setCollideWorldBounds(true);
                zombie.setData('id', message.id);
                zombie.setData('health', 30);
              }
              break;
            case 'itemSpawn':
              // Handle item spawn from other players
              if (!message.fromSelf) {
                const item = items.create(message.x, message.y, message.itemType);
                item.setBounce(0.4);
                item.setCollideWorldBounds(true);
                item.setData('id', message.id);
              }
              break;
            case 'zombieKilled':
              // Handle zombie killed by other players
              if (!message.fromSelf) {
                zombies.getChildren().forEach((z: any) => {
                  if (z.getData('id') === message.id) {
                    z.disableBody(true, true);
                  }
                });
              }
              break;
            case 'itemCollected':
              // Handle item collected by other players
              if (!message.fromSelf) {
                items.getChildren().forEach((i: any) => {
                  if (i.getData('id') === message.itemId) {
                    i.disableBody(true, true);
                  }
                });
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      // Define the update function for game logic
      mainScene.update = function() {
        if (!player.active) return;
        
        // Player movement controls
        if (cursors.left.isDown) {
          player.setVelocityX(-160);
          player.anims.play('left', true);
          player.flipX = true;
          
          // Send movement update to server
          sendGameAction('playerMove', {
            x: player.x,
            y: player.y,
            velocityX: -160,
            animation: 'left',
            flipX: true
          });
        } else if (cursors.right.isDown) {
          player.setVelocityX(160);
          player.anims.play('right', true);
          player.flipX = false;
          
          // Send movement update to server
          sendGameAction('playerMove', {
            x: player.x,
            y: player.y,
            velocityX: 160,
            animation: 'right',
            flipX: false
          });
        } else {
          player.setVelocityX(0);
          player.anims.play('turn');
          
          // Send idle update to server
          sendGameAction('playerIdle', {
            x: player.x,
            y: player.y
          });
        }
        
        // Player jump
        if (cursors.up.isDown && player.body.touching.down) {
          player.setVelocityY(-330);
          
          // Send jump update to server
          sendGameAction('playerJump', {
            x: player.x,
            y: player.y
          });
        }
        
        // Zombie AI - move towards player
        zombies.getChildren().forEach((zombie: any) => {
          const dx = player.x - zombie.x;
          const dy = player.y - zombie.y;
          const angle = Math.atan2(dy, dx);
          
          zombie.setVelocityX(Math.cos(angle) * 70);
          zombie.setVelocityY(Math.sin(angle) * 70);
          
          if (zombie.body.velocity.x < 0) {
            zombie.anims.play('left', true);
            zombie.flipX = true;
          } else {
            zombie.anims.play('right', true);
            zombie.flipX = false;
          }
        });
        
        // Clear bullets that are out of bounds
        bullets.getChildren().forEach((bullet: any) => {
          if (bullet.active) {
            if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
              bullet.setActive(false);
              bullet.setVisible(false);
            }
          }
        });
      };
    }

    // Set up WebSocket connection
    const setupWebSocket = () => {
      socketRef.current = connectToGameServer(
        (data) => {
          // Handle messages
          if (data.type === 'connected') {
            setIsConnected(true);
            toast({
              title: "Connected to Game Server",
              description: "You are now playing online!",
            });
          }
        },
        () => {
          // Handle disconnection
          setIsConnected(false);
          toast({
            variant: "destructive",
            title: "Connection Lost",
            description: "Disconnected from game server. Trying to reconnect...",
          });
          
          // Try to reconnect
          setTimeout(setupWebSocket, 3000);
        }
      );
    };
    
    setupWebSocket();

    // Cleanup function
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      disconnectFromGameServer();
    };
  }, []);

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="p-2 bg-gray-800 text-white text-xs border-b border-gray-700 flex justify-between items-center">
        <div>
          <span className="mr-4">WASD/Arrows: Move</span>
          <span className="mr-4">Space: Shoot</span>
          <span>R: Reload</span>
        </div>
        <div>
          <span className={`inline-flex items-center ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
            {isConnected ? 'Online' : 'Offline'}
            <span className={`ml-1 w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          </span>
        </div>
      </div>
      <div 
        ref={gameContainerRef} 
        id="game-container" 
        className="w-full flex-1 bg-black"
      ></div>
    </div>
  );
};

export default Game;