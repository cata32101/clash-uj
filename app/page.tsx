"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Zap, Crown, Coins, Timer, Users, Snowflake, Eye, Crosshair, Play, Pause, Swords } from "lucide-react"

// Enhanced game constants for 4-player
const GRID_SIZE = 24
const PREP_TIME = 60
const BATTLE_TIME = 240
const MANA_MAX = 25
const MANA_REGEN_RATE = 1500 // Slower mana regen (was 1000)

// Player positions for 4-player mode - CORNER POSITIONS for better strategy
const PLAYER_POSITIONS = {
  player1: { towerX: 12, towerY: 21, color: "#22C55E", name: "YOU", icon: "👑" }, // Bottom center
  player2: { towerX: 2, towerY: 12, color: "#EF4444", name: "WEST", icon: "🔴" }, // Left center
  player3: { towerX: 12, towerY: 2, color: "#3B82F6", name: "NORTH", icon: "🔵" }, // Top center
  player4: { towerX: 21, towerY: 12, color: "#F59E0B", name: "EAST", icon: "🟡" }, // Right center
}

// Enhanced unit types
const UNITS = {
  knight: {
    name: "Knight",
    cost: 3,
    hp: 120,
    damage: 35,
    speed: 1.0,
    range: 1,
    icon: "⚔️",
    color: "#8B5CF6",
    moveDelay: 18, // Slower (was 12)
    size: 1.2,
    description: "Tanky melee fighter",
  },
  archer: {
    name: "Archer",
    cost: 2,
    hp: 70,
    damage: 25,
    speed: 1.2,
    range: 3,
    icon: "🏹",
    color: "#10B981",
    moveDelay: 12, // Slower (was 8)
    size: 1.0,
    description: "Ranged damage dealer",
  },
  wizard: {
    name: "Wizard",
    cost: 4,
    hp: 90,
    damage: 50,
    speed: 0.9,
    range: 2,
    icon: "🧙",
    color: "#3B82F6",
    moveDelay: 15, // Slower (was 10)
    size: 1.1,
    description: "Magic damage caster",
  },
  giant: {
    name: "Giant",
    cost: 6,
    hp: 300,
    damage: 60,
    speed: 0.5,
    range: 1,
    icon: "🗿",
    color: "#6B7280",
    moveDelay: 30, // Slower (was 20)
    size: 1.5,
    description: "Massive tank unit",
  },
  healer: {
    name: "Healer",
    cost: 3,
    hp: 80,
    damage: 0,
    speed: 1.1,
    range: 2,
    icon: "✨",
    color: "#F59E0B",
    moveDelay: 15, // Slower (was 10)
    size: 1.0,
    description: "Heals friendly units",
  },
}

const SPELLS = {
  fireball: {
    name: "Fireball",
    cost: 4,
    damage: 100,
    radius: 2,
    icon: "🔥",
    color: "#DC2626",
    description: "Area fire damage",
  },
  freeze: {
    name: "Freeze",
    cost: 3,
    duration: 40,
    radius: 2,
    icon: "❄️",
    color: "#06B6D4",
    description: "Freezes enemies",
  },
  lightning: {
    name: "Lightning",
    cost: 5,
    damage: 150,
    radius: 1,
    icon: "⚡",
    color: "#A855F7",
    description: "High single damage",
  },
  heal: {
    name: "Heal",
    cost: 2,
    healing: 80,
    radius: 2,
    icon: "💚",
    color: "#22C55E",
    description: "Heals friendly units",
  },
}

const BUILDINGS = {
  tower: {
    name: "Tower",
    cost: 4,
    hp: 200,
    damage: 40,
    range: 4,
    icon: "🏰",
    color: "#1F2937",
    attackSpeed: 25,
    minRange: 0,
    description: "Defensive structure",
  },
  wall: {
    name: "Wall",
    cost: 1,
    hp: 100,
    damage: 0,
    range: 0,
    icon: "🧱",
    color: "#6B7280",
    attackSpeed: 0,
    minRange: 0,
    description: "Blocks movement - Can be destroyed!",
  },
  cannon: {
    name: "Cannon",
    cost: 3,
    hp: 100,
    damage: 80,
    range: 7,
    icon: "💣",
    color: "#7C2D12",
    attackSpeed: 45,
    minRange: 3,
    description: "Long-range artillery",
  },
  tesla: {
    name: "Tesla",
    cost: 4,
    hp: 100,
    damage: 60,
    range: 3,
    icon: "⚡",
    color: "#7C3AED",
    attackSpeed: 20,
    minRange: 0,
    description: "Electric tower",
  },
}

type PlayerType = "player1" | "player2" | "player3" | "player4"

interface Unit {
  id: string
  type: keyof typeof UNITS
  owner: PlayerType
  x: number
  y: number
  hp: number
  maxHp: number
  cooldown: number
  frozen: number
  lastDamage?: number
  healCooldown: number
  moveCooldown: number
  isMoving: boolean
  isSelected: boolean
  targetX?: number
  targetY?: number
}

interface Building {
  id: string
  type: keyof typeof BUILDINGS
  owner: PlayerType
  x: number
  y: number
  hp: number
  maxHp: number
  cooldown: number
  targetX?: number
  targetY?: number
  isMainTower?: boolean
  aimAngle?: number
  charging?: number
}

interface Projectile {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  currentX: number
  currentY: number
  progress: number
  damage: number
  type: string
  color: string
  speed: number
  velocity: { x: number; y: number }
  trail: { x: number; y: number }[]
  owner: PlayerType
}

interface DamageNumber {
  id: string
  x: number
  y: number
  damage: number
  opacity: number
  isHealing?: boolean
  velocity: { x: number; y: number }
}

interface Explosion {
  id: string
  x: number
  y: number
  radius: number
  maxRadius: number
  opacity: number
  color: string
}

interface Tile {
  x: number
  y: number
  owner: PlayerType | "neutral"
  building?: Building
  units: Unit[]
  isHighlighted?: boolean
}

interface PlayerState {
  hp: number
  mana: number
  isAlive: boolean
  isAI: boolean
}

interface GameState {
  credits: number
  phase: "menu" | "prep" | "battle" | "result"
  phaseTime: number
  players: Record<PlayerType, PlayerState>
  grid: Tile[][]
  selectedCard: string | null
  selectedUnit: Unit | null
  hoveredTile: { x: number; y: number } | null
  deck: string[]
  winner: PlayerType | "tie" | null
  wager: number
  spectators: number
  projectiles: Projectile[]
  damageNumbers: DamageNumber[]
  explosions: Explosion[]
  showRanges: boolean
  selectedBuilding: Building | null
  isPaused: boolean
  gameSpeed: number
  gameMode: "2player" | "4player"
  alivePlayers: PlayerType[]
}

export default function FourPlayerBattleArena() {
  const [gameState, setGameState] = useState<GameState>({
    credits: 100,
    phase: "menu",
    phaseTime: 0,
    players: {
      player1: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: false },
      player2: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: true },
      player3: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: true },
      player4: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: true },
    },
    grid: [],
    selectedCard: null,
    selectedUnit: null,
    hoveredTile: null,
    deck: ["knight", "archer", "wizard", "fireball", "tower", "wall", "cannon", "heal"],
    winner: null,
    wager: 25,
    spectators: 0,
    projectiles: [],
    damageNumbers: [],
    explosions: [],
    showRanges: false,
    selectedBuilding: null,
    isPaused: false,
    gameSpeed: 1.0,
    gameMode: "4player",
    alivePlayers: ["player1", "player2", "player3", "player4"],
  })

  const gameLoopRef = useRef<number>()
  const manaTimerRef = useRef<NodeJS.Timeout>()

  const initializeGrid = useCallback((mode: "2player" | "4player"): Tile[][] => {
    const grid: Tile[][] = []

    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y] = []
      for (let x = 0; x < GRID_SIZE; x++) {
        let owner: PlayerType | "neutral" = "neutral"

        if (mode === "4player") {
          // Triangle/Cross territories for strategic gameplay
          const territorySize = 6

          // Player 1 - Bottom center
          if (Math.abs(x - 12) + Math.abs(y - 21) <= territorySize) owner = "player1"
          // Player 2 - Left center
          else if (Math.abs(x - 2) + Math.abs(y - 12) <= territorySize) owner = "player2"
          // Player 3 - Top center
          else if (Math.abs(x - 12) + Math.abs(y - 2) <= territorySize) owner = "player3"
          // Player 4 - Right center
          else if (Math.abs(x - 21) + Math.abs(y - 12) <= territorySize) owner = "player4"
        } else {
          // 2-player mode
          if (y >= GRID_SIZE - 6) owner = "player1"
          if (y < 6) owner = "player2"
        }

        grid[y][x] = { x, y, owner, units: [] }
      }
    }

    // Place main towers in corners
    if (mode === "4player") {
      Object.entries(PLAYER_POSITIONS).forEach(([player, pos]) => {
        grid[pos.towerY][pos.towerX] = {
          ...grid[pos.towerY][pos.towerX],
          building: {
            id: `${player}-main-tower`,
            type: "tower",
            owner: player as PlayerType,
            x: pos.towerX,
            y: pos.towerY,
            hp: 300,
            maxHp: 300,
            cooldown: 0,
            isMainTower: true,
            aimAngle: 0,
          },
        }
      })
    } else {
      // 2-player towers
      grid[0][12] = {
        ...grid[0][12],
        building: {
          id: "player2-main-tower",
          type: "tower",
          owner: "player2",
          x: 12,
          y: 0,
          hp: 300,
          maxHp: 300,
          cooldown: 0,
          isMainTower: true,
          aimAngle: 0,
        },
      }

      grid[GRID_SIZE - 1][12] = {
        ...grid[GRID_SIZE - 1][12],
        building: {
          id: "player1-main-tower",
          type: "tower",
          owner: "player1",
          x: 12,
          y: GRID_SIZE - 1,
          hp: 300,
          maxHp: 300,
          cooldown: 0,
          isMainTower: true,
          aimAngle: 0,
        },
      }
    }

    return grid
  }, [])

  const startGame = (mode: "2player" | "4player") => {
    if (gameState.credits < gameState.wager) return

    const initialPlayers: Record<PlayerType, PlayerState> = {
      player1: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: false },
      player2: { hp: 300, mana: MANA_MAX, isAlive: true, isAI: true },
      player3: { hp: 300, mana: MANA_MAX, isAlive: mode === "4player", isAI: true },
      player4: { hp: 300, mana: MANA_MAX, isAlive: mode === "4player", isAI: true },
    }

    setGameState((prev) => ({
      ...prev,
      credits: prev.credits - prev.wager,
      phase: "prep",
      phaseTime: PREP_TIME,
      players: initialPlayers,
      grid: initializeGrid(mode),
      selectedCard: null,
      selectedUnit: null,
      hoveredTile: null,
      winner: null,
      spectators: Math.floor(Math.random() * 800) + 200,
      projectiles: [],
      damageNumbers: [],
      explosions: [],
      selectedBuilding: null,
      isPaused: false,
      gameMode: mode,
      alivePlayers: mode === "4player" ? ["player1", "player2", "player3", "player4"] : ["player1", "player2"],
    }))
  }

  // Enhanced pathfinding - ONLY target ALIVE players
  const getNextMovePosition = (unit: Unit, currentX: number, currentY: number, alivePlayers: PlayerType[]) => {
    // If unit has a manual target, move towards it
    if (unit.targetX !== undefined && unit.targetY !== undefined) {
      const dx = unit.targetX - currentX
      const dy = unit.targetY - currentY

      if (Math.abs(dx) > Math.abs(dy)) {
        return { x: dx > 0 ? currentX + 1 : currentX - 1, y: currentY }
      } else if (dy !== 0) {
        return { x: currentX, y: dy > 0 ? currentY + 1 : currentY - 1 }
      }
    }

    // Find nearest ALIVE enemy tower
    let nearestTower: { x: number; y: number; distance: number } | null = null

    Object.entries(PLAYER_POSITIONS).forEach(([player, pos]) => {
      if (player !== unit.owner && alivePlayers.includes(player as PlayerType)) {
        const distance = Math.sqrt(Math.pow(pos.towerX - currentX, 2) + Math.pow(pos.towerY - currentY, 2))
        if (!nearestTower || distance < nearestTower.distance) {
          nearestTower = { x: pos.towerX, y: pos.towerY, distance }
        }
      }
    })

    if (nearestTower) {
      const dx = nearestTower.x - currentX
      const dy = nearestTower.y - currentY

      if (Math.abs(dx) > Math.abs(dy)) {
        return { x: dx > 0 ? currentX + 1 : currentX - 1, y: currentY }
      } else if (dy !== 0) {
        return { x: currentX, y: dy > 0 ? currentY + 1 : currentY - 1 }
      }
    }

    return { x: currentX, y: currentY }
  }

  // Territory conquest function
  const conquestTerritory = (defeatedPlayer: PlayerType, conqueror: PlayerType, grid: Tile[][]) => {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x].owner === defeatedPlayer) {
          grid[y][x].owner = conqueror

          // Convert buildings to conqueror's ownership
          if (grid[y][x].building && grid[y][x].building!.owner === defeatedPlayer) {
            grid[y][x].building!.owner = conqueror
          }
        }
      }
    }
  }

  // Phase timer
  useEffect(() => {
    if (gameState.phase === "menu" || gameState.phase === "result" || gameState.isPaused) return

    const timer = setInterval(() => {
      setGameState((prev) => {
        if (prev.phaseTime <= 1) {
          if (prev.phase === "prep") {
            return { ...prev, phase: "battle", phaseTime: BATTLE_TIME }
          } else {
            // Determine winner based on remaining HP
            let winner: PlayerType | "tie" | null = "tie"
            let maxHp = 0
            let playersWithMaxHp = 0

            prev.alivePlayers.forEach((player) => {
              const hp = prev.players[player].hp
              if (hp > maxHp) {
                maxHp = hp
                winner = player
                playersWithMaxHp = 1
              } else if (hp === maxHp) {
                playersWithMaxHp++
                if (playersWithMaxHp > 1) winner = "tie"
              }
            })

            return { ...prev, phase: "result", winner, phaseTime: 0 }
          }
        }
        return { ...prev, phaseTime: prev.phaseTime - 1 }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameState.phase, gameState.isPaused])

  // Mana regeneration
  useEffect(() => {
    if (gameState.phase !== "battle" || gameState.isPaused) return

    manaTimerRef.current = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        players: Object.fromEntries(
          Object.entries(prev.players).map(([player, state]) => [
            player,
            { ...state, mana: Math.min(MANA_MAX, state.mana + 1) },
          ]),
        ) as Record<PlayerType, PlayerState>,
      }))
    }, MANA_REGEN_RATE)

    return () => {
      if (manaTimerRef.current) clearInterval(manaTimerRef.current)
    }
  }, [gameState.phase, gameState.isPaused])

  // Enhanced 4-player game loop
  useEffect(() => {
    if (gameState.phase !== "battle" || gameState.isPaused) return

    const gameLoop = () => {
      setGameState((prev) => {
        const newGrid = prev.grid.map((row) =>
          row.map((tile) => ({
            ...tile,
            units: [...tile.units],
            isHighlighted: false,
          })),
        )

        const newPlayers = { ...prev.players }
        const newProjectiles = [...prev.projectiles]
        const newDamageNumbers = [...prev.damageNumbers]
        const newExplosions = [...prev.explosions]
        let newAlivePlayers = [...prev.alivePlayers]

        // Enhanced projectile physics
        for (let i = newProjectiles.length - 1; i >= 0; i--) {
          const projectile = newProjectiles[i]

          projectile.currentX += projectile.velocity.x * prev.gameSpeed
          projectile.currentY += projectile.velocity.y * prev.gameSpeed
          projectile.progress += projectile.speed * prev.gameSpeed

          // Add to trail
          projectile.trail.push({ x: projectile.currentX, y: projectile.currentY })
          if (projectile.trail.length > 5) projectile.trail.shift()

          // Check if projectile hit target
          const distanceToTarget = Math.sqrt(
            Math.pow(projectile.currentX - projectile.toX, 2) + Math.pow(projectile.currentY - projectile.toY, 2),
          )

          if (
            distanceToTarget < 0.5 ||
            projectile.progress >= 1 ||
            projectile.currentX < 0 ||
            projectile.currentX >= GRID_SIZE ||
            projectile.currentY < 0 ||
            projectile.currentY >= GRID_SIZE
          ) {
            const hitX = Math.floor(projectile.currentX)
            const hitY = Math.floor(projectile.currentY)

            if (hitX >= 0 && hitX < GRID_SIZE && hitY >= 0 && hitY < GRID_SIZE) {
              const targetTile = newGrid[hitY][hitX]

              // Create explosion effect
              newExplosions.push({
                id: `explosion-${Date.now()}-${Math.random()}`,
                x: hitX,
                y: hitY,
                radius: 0,
                maxRadius: projectile.type.includes("cannon") ? 1.5 : 0.8,
                opacity: 1,
                color: projectile.color,
              })

              // Apply damage to units
              targetTile.units.forEach((unit) => {
                if (unit.owner !== projectile.owner) {
                  unit.hp = Math.max(0, unit.hp - projectile.damage)
                  unit.lastDamage = projectile.damage

                  newDamageNumbers.push({
                    id: `damage-${Date.now()}-${Math.random()}`,
                    x: hitX + (Math.random() - 0.5) * 0.5,
                    y: hitY + (Math.random() - 0.5) * 0.5,
                    damage: projectile.damage,
                    opacity: 1,
                    velocity: { x: (Math.random() - 0.5) * 0.02, y: -0.03 },
                  })
                }
              })

              // Apply damage to buildings (INCLUDING WALLS!)
              if (targetTile.building && targetTile.building.owner !== projectile.owner) {
                const building = targetTile.building
                const oldHp = building.hp
                building.hp -= projectile.damage

                if (building.isMainTower) {
                  newPlayers[building.owner].hp = building.hp

                  // Check if player was defeated and handle territory conquest
                  if (building.hp <= 0 && oldHp > 0) {
                    newAlivePlayers = newAlivePlayers.filter((p) => p !== building.owner)
                    conquestTerritory(building.owner, projectile.owner, newGrid)
                  }
                }

                newDamageNumbers.push({
                  id: `damage-${Date.now()}-${Math.random()}`,
                  x: hitX,
                  y: hitY,
                  damage: projectile.damage,
                  opacity: 1,
                  velocity: { x: 0, y: -0.04 },
                })
              }

              // Splash damage for cannons
              if (projectile.type.includes("cannon")) {
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const splashY = hitY + dy
                    const splashX = hitX + dx
                    if (
                      splashY >= 0 &&
                      splashY < GRID_SIZE &&
                      splashX >= 0 &&
                      splashX < GRID_SIZE &&
                      !(dx === 0 && dy === 0)
                    ) {
                      const splashTile = newGrid[splashY][splashX]
                      splashTile.units.forEach((unit) => {
                        if (unit.owner !== projectile.owner) {
                          unit.hp = Math.max(0, unit.hp - Math.floor(projectile.damage * 0.5))
                        }
                      })
                      // Splash damage to buildings too!
                      if (splashTile.building && splashTile.building.owner !== projectile.owner) {
                        splashTile.building.hp -= Math.floor(projectile.damage * 0.3)
                      }
                    }
                  }
                }
              }
            }

            newProjectiles.splice(i, 1)
          }
        }

        // Update explosions
        for (let i = newExplosions.length - 1; i >= 0; i--) {
          const explosion = newExplosions[i]
          explosion.radius += 0.1 * prev.gameSpeed
          explosion.opacity -= 0.05 * prev.gameSpeed

          if (explosion.opacity <= 0 || explosion.radius >= explosion.maxRadius) {
            newExplosions.splice(i, 1)
          }
        }

        // Update damage numbers
        for (let i = newDamageNumbers.length - 1; i >= 0; i--) {
          const damageNum = newDamageNumbers[i]
          damageNum.opacity -= 0.015 * prev.gameSpeed
          damageNum.x += damageNum.velocity.x * prev.gameSpeed
          damageNum.y += damageNum.velocity.y * prev.gameSpeed
          damageNum.velocity.y -= 0.001 * prev.gameSpeed

          if (damageNum.opacity <= 0) {
            newDamageNumbers.splice(i, 1)
          }
        }

        // Enhanced unit AI for 4-player
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const tile = newGrid[y][x]

            // Update unit states
            tile.units = tile.units.map((unit) => ({
              ...unit,
              cooldown: Math.max(0, unit.cooldown - prev.gameSpeed),
              frozen: Math.max(0, unit.frozen - prev.gameSpeed),
              healCooldown: Math.max(0, unit.healCooldown - prev.gameSpeed),
              moveCooldown: Math.max(0, unit.moveCooldown - prev.gameSpeed),
              lastDamage: unit.lastDamage && unit.lastDamage > 0 ? unit.lastDamage - 1 : undefined,
              isMoving: unit.moveCooldown > 0,
            }))

            // Remove dead units
            tile.units = tile.units.filter((unit) => unit.hp > 0)

            // Unit AI and combat
            tile.units.forEach((unit) => {
              if (unit.frozen > 0 || unit.cooldown > 0) return

              const unitStats = UNITS[unit.type]

              // Healer logic
              if (unit.type === "healer" && unit.healCooldown === 0) {
                for (let dy = -unitStats.range; dy <= unitStats.range; dy++) {
                  for (let dx = -unitStats.range; dx <= unitStats.range; dx++) {
                    const checkY = y + dy
                    const checkX = x + dx
                    if (checkY >= 0 && checkY < GRID_SIZE && checkX >= 0 && checkX < GRID_SIZE) {
                      const checkTile = newGrid[checkY][checkX]
                      const friendlyUnits = checkTile.units.filter(
                        (u) => u.owner === unit.owner && u.hp < u.maxHp && u.id !== unit.id,
                      )

                      if (friendlyUnits.length > 0) {
                        const target = friendlyUnits[0]
                        target.hp = Math.min(target.maxHp, target.hp + 25)
                        unit.healCooldown = 25

                        newDamageNumbers.push({
                          id: `heal-${Date.now()}-${Math.random()}`,
                          x: checkX,
                          y: checkY,
                          damage: 25,
                          opacity: 1,
                          isHealing: true,
                          velocity: { x: 0, y: -0.02 },
                        })
                        return
                      }
                    }
                  }
                }
              }

              // Combat logic - attack any enemy
              let foundTarget = false
              for (let dy = -unitStats.range; dy <= unitStats.range; dy++) {
                for (let dx = -unitStats.range; dx <= unitStats.range; dx++) {
                  const checkY = y + dy
                  const checkX = x + dx
                  if (checkY >= 0 && checkY < GRID_SIZE && checkX >= 0 && checkX < GRID_SIZE) {
                    const checkTile = newGrid[checkY][checkX]

                    // Attack enemy units
                    const enemyUnits = checkTile.units.filter((u) => u.owner !== unit.owner)
                    if (enemyUnits.length > 0 && unitStats.damage > 0) {
                      const target = enemyUnits[0]

                      if (unitStats.range > 1) {
                        // Ranged attack
                        newProjectiles.push({
                          id: `projectile-${Date.now()}-${Math.random()}`,
                          fromX: x,
                          fromY: y,
                          toX: checkX,
                          toY: checkY,
                          currentX: x,
                          currentY: y,
                          progress: 0,
                          damage: unitStats.damage,
                          type: `${unit.owner}-${unit.type}`,
                          color: unitStats.color,
                          speed: 0.06, // Slower projectiles (was 0.1)
                          velocity: {
                            x: (checkX - x) * 0.1,
                            y: (checkY - y) * 0.1,
                          },
                          trail: [],
                          owner: unit.owner,
                        })
                      } else {
                        // Melee attack
                        target.hp = Math.max(0, target.hp - unitStats.damage)
                        target.lastDamage = unitStats.damage
                      }

                      unit.cooldown = 30 // Slower attacks (was 20)
                      foundTarget = true
                      break
                    }

                    // Attack enemy buildings (INCLUDING WALLS!)
                    if (checkTile.building && checkTile.building.owner !== unit.owner && unitStats.damage > 0) {
                      const building = checkTile.building

                      if (unitStats.range > 1) {
                        newProjectiles.push({
                          id: `projectile-${Date.now()}-${Math.random()}`,
                          fromX: x,
                          fromY: y,
                          toX: checkX,
                          toY: checkY,
                          currentX: x,
                          currentY: y,
                          progress: 0,
                          damage: unitStats.damage,
                          type: `${unit.owner}-${unit.type}`,
                          color: unitStats.color,
                          speed: 0.06,
                          velocity: {
                            x: (checkX - x) * 0.08,
                            y: (checkY - y) * 0.08,
                          },
                          trail: [],
                          owner: unit.owner,
                        })
                      } else {
                        // Melee attack on buildings (including walls!)
                        const oldHp = building.hp
                        building.hp -= unitStats.damage
                        if (building.isMainTower) {
                          newPlayers[building.owner].hp = building.hp

                          // Check if player was defeated and handle territory conquest
                          if (building.hp <= 0 && oldHp > 0) {
                            newAlivePlayers = newAlivePlayers.filter((p) => p !== building.owner)
                            conquestTerritory(building.owner, unit.owner, newGrid)
                          }
                        }

                        newDamageNumbers.push({
                          id: `melee-damage-${Date.now()}-${Math.random()}`,
                          x: checkX,
                          y: checkY,
                          damage: unitStats.damage,
                          opacity: 1,
                          velocity: { x: 0, y: -0.03 },
                        })
                      }

                      unit.cooldown = 30
                      foundTarget = true
                      break
                    }
                  }
                }
                if (foundTarget) break
              }

              // Enhanced movement with 4-player pathfinding - ONLY target alive players
              if (!foundTarget && unit.moveCooldown === 0) {
                const nextPos = getNextMovePosition(unit, x, y, newAlivePlayers)

                if (nextPos.x !== x || nextPos.y !== y) {
                  if (
                    nextPos.x >= 0 &&
                    nextPos.x < GRID_SIZE &&
                    nextPos.y >= 0 &&
                    nextPos.y < GRID_SIZE &&
                    newGrid[nextPos.y][nextPos.x].units.length < 3 &&
                    !newGrid[nextPos.y][nextPos.x].building // Can't move through buildings
                  ) {
                    newGrid[nextPos.y][nextPos.x].units.push(unit)
                    tile.units = tile.units.filter((u) => u.id !== unit.id)
                    unit.moveCooldown = unitStats.moveDelay
                    unit.isMoving = true

                    // Clear manual target if reached
                    if (unit.targetX === nextPos.x && unit.targetY === nextPos.y) {
                      unit.targetX = undefined
                      unit.targetY = undefined
                    }
                  }
                }
              }
            })

            // Building logic
            if (tile.building && tile.building.cooldown <= 0) {
              const building = tile.building
              const buildingStats = BUILDINGS[building.type]

              if (buildingStats.damage > 0) {
                let bestTarget: { x: number; y: number; distance: number } | null = null

                for (let dy = -buildingStats.range; dy <= buildingStats.range; dy++) {
                  for (let dx = -buildingStats.range; dx <= buildingStats.range; dx++) {
                    const checkY = y + dy
                    const checkX = x + dx
                    const distance = Math.sqrt(dx * dx + dy * dy)

                    if (
                      checkY >= 0 &&
                      checkY < GRID_SIZE &&
                      checkX >= 0 &&
                      checkX < GRID_SIZE &&
                      distance <= buildingStats.range &&
                      distance >= buildingStats.minRange
                    ) {
                      const checkTile = newGrid[checkY][checkX]
                      const enemyUnits = checkTile.units.filter((u) => u.owner !== building.owner)

                      if (enemyUnits.length > 0) {
                        if (!bestTarget || distance < bestTarget.distance) {
                          bestTarget = { x: checkX, y: checkY, distance }
                        }
                      }
                    }
                  }
                }

                if (bestTarget) {
                  building.targetX = bestTarget.x
                  building.targetY = bestTarget.y
                  building.aimAngle = Math.atan2(bestTarget.y - y, bestTarget.x - x)

                  let shouldFire = true
                  if (building.type === "cannon") {
                    building.charging = (building.charging || 0) + 1
                    if (building.charging < 10) shouldFire = false
                    else building.charging = 0
                  }

                  if (shouldFire) {
                    newProjectiles.push({
                      id: `building-projectile-${Date.now()}-${Math.random()}`,
                      fromX: x,
                      fromY: y,
                      toX: bestTarget.x,
                      toY: bestTarget.y,
                      currentX: x,
                      currentY: y,
                      progress: 0,
                      damage: buildingStats.damage,
                      type: `${building.owner}-${building.type}`,
                      color: buildingStats.color,
                      speed: 0.05, // Slower building projectiles (was 0.08)
                      velocity: {
                        x: (bestTarget.x - x) * (building.type === "tesla" ? 0.2 : 0.06),
                        y: (bestTarget.y - y) * (building.type === "tesla" ? 0.2 : 0.06),
                      },
                      trail: [],
                      owner: building.owner,
                    })

                    building.cooldown = buildingStats.attackSpeed
                  }
                } else {
                  building.targetX = undefined
                  building.targetY = undefined
                  building.charging = 0
                }
              }

              if (building.cooldown > 0) {
                building.cooldown -= prev.gameSpeed
              }
            }
          }
        }

        // Remove destroyed buildings
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const tile = newGrid[y][x]
            if (tile.building && tile.building.hp <= 0) {
              tile.building = undefined
            }
          }
        }

        // Enhanced AI for multiple players - ONLY alive players
        newAlivePlayers.forEach((player) => {
          if (newPlayers[player].isAI && Math.random() < 0.06 && newPlayers[player].mana >= 2) {
            const availableCards = prev.deck.filter((card) => {
              const cost =
                UNITS[card as keyof typeof UNITS]?.cost ||
                SPELLS[card as keyof typeof SPELLS]?.cost ||
                BUILDINGS[card as keyof typeof BUILDINGS]?.cost ||
                0
              return cost <= newPlayers[player].mana
            })

            if (availableCards.length > 0) {
              const selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)]
              const cost =
                UNITS[selectedCard as keyof typeof UNITS]?.cost ||
                SPELLS[selectedCard as keyof typeof SPELLS]?.cost ||
                BUILDINGS[selectedCard as keyof typeof BUILDINGS]?.cost ||
                0

              // Find valid deployment area for this player
              const playerPos = PLAYER_POSITIONS[player]
              const deployX = Math.max(0, Math.min(GRID_SIZE - 1, playerPos.towerX + Math.floor(Math.random() * 6) - 3))
              const deployY = Math.max(0, Math.min(GRID_SIZE - 1, playerPos.towerY + Math.floor(Math.random() * 6) - 3))

              if (UNITS[selectedCard as keyof typeof UNITS] && newGrid[deployY][deployX].owner === player) {
                const unitStats = UNITS[selectedCard as keyof typeof UNITS]
                const newUnit: Unit = {
                  id: `${player}-${Date.now()}-${Math.random()}`,
                  type: selectedCard as keyof typeof UNITS,
                  owner: player,
                  x: deployX,
                  y: deployY,
                  hp: unitStats.hp,
                  maxHp: unitStats.hp,
                  cooldown: 0,
                  frozen: 0,
                  healCooldown: 0,
                  moveCooldown: 0,
                  isMoving: false,
                  isSelected: false,
                }
                newGrid[deployY][deployX].units.push(newUnit)
                newPlayers[player].mana -= cost
              }
            }
          }
        })

        // Check win conditions
        if (newAlivePlayers.length <= 1) {
          return {
            ...prev,
            grid: newGrid,
            players: newPlayers,
            projectiles: newProjectiles,
            damageNumbers: newDamageNumbers,
            explosions: newExplosions,
            phase: "result",
            winner: newAlivePlayers.length === 1 ? newAlivePlayers[0] : "tie",
            alivePlayers: newAlivePlayers,
          }
        }

        return {
          ...prev,
          grid: newGrid,
          players: newPlayers,
          projectiles: newProjectiles,
          damageNumbers: newDamageNumbers,
          explosions: newExplosions,
          alivePlayers: newAlivePlayers,
        }
      })

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState.phase, gameState.isPaused])

  const deployCard = (x: number, y: number) => {
    if (!gameState.selectedCard || gameState.phase === "menu" || gameState.phase === "result") return

    const card = gameState.selectedCard
    let cost = 0
    let canDeploy = false

    canDeploy = gameState.grid[y][x].owner === "player1"

    if (!canDeploy) return

    setGameState((prev) => {
      const newGrid = prev.grid.map((row) => row.map((tile) => ({ ...tile, units: [...tile.units] })))
      const newDamageNumbers = [...prev.damageNumbers]
      const newExplosions = [...prev.explosions]
      const newPlayers = { ...prev.players }

      // Deploy unit
      if (UNITS[card as keyof typeof UNITS]) {
        const unitStats = UNITS[card as keyof typeof UNITS]
        cost = unitStats.cost

        if (prev.players.player1.mana >= cost) {
          const newUnit: Unit = {
            id: `player1-${Date.now()}-${Math.random()}`,
            type: card as keyof typeof UNITS,
            owner: "player1",
            x,
            y,
            hp: unitStats.hp,
            maxHp: unitStats.hp,
            cooldown: 0,
            frozen: 0,
            healCooldown: 0,
            moveCooldown: 0,
            isMoving: false,
            isSelected: false,
          }
          newGrid[y][x].units.push(newUnit)
        } else {
          return prev
        }
      }

      // Deploy building
      if (BUILDINGS[card as keyof typeof BUILDINGS]) {
        const buildingStats = BUILDINGS[card as keyof typeof BUILDINGS]
        cost = buildingStats.cost

        if (prev.players.player1.mana >= cost && !newGrid[y][x].building) {
          newGrid[y][x].building = {
            id: `player1-building-${Date.now()}`,
            type: card as keyof typeof BUILDINGS,
            owner: "player1",
            x,
            y,
            hp: buildingStats.hp,
            maxHp: buildingStats.hp,
            cooldown: 0,
            aimAngle: 0,
          }
        } else {
          return prev
        }
      }

      // Cast spell
      if (SPELLS[card as keyof typeof SPELLS]) {
        const spellStats = SPELLS[card as keyof typeof SPELLS]
        cost = spellStats.cost

        if (prev.players.player1.mana >= cost) {
          newExplosions.push({
            id: `spell-explosion-${Date.now()}`,
            x: x,
            y: y,
            radius: 0,
            maxRadius: spellStats.radius * 1.5,
            opacity: 1,
            color: spellStats.color,
          })

          for (let dy = -spellStats.radius; dy <= spellStats.radius; dy++) {
            for (let dx = -spellStats.radius; dx <= spellStats.radius; dx++) {
              const targetY = y + dy
              const targetX = x + dx
              if (targetY >= 0 && targetY < GRID_SIZE && targetX >= 0 && targetX < GRID_SIZE) {
                const targetTile = newGrid[targetY][targetX]

                if (card === "fireball" || card === "lightning") {
                  targetTile.units.forEach((unit) => {
                    if (unit.owner !== "player1") {
                      unit.hp = Math.max(0, unit.hp - (spellStats.damage || 0))
                      newDamageNumbers.push({
                        id: `spell-damage-${Date.now()}-${Math.random()}`,
                        x: targetX + (Math.random() - 0.5) * 0.5,
                        y: targetY + (Math.random() - 0.5) * 0.5,
                        damage: spellStats.damage || 0,
                        opacity: 1,
                        velocity: { x: (Math.random() - 0.5) * 0.03, y: -0.04 },
                      })
                    }
                  })

                  if (targetTile.building && targetTile.building.owner !== "player1") {
                    targetTile.building.hp -= spellStats.damage || 0
                  }
                } else if (card === "freeze") {
                  targetTile.units.forEach((unit) => {
                    if (unit.owner !== "player1") {
                      unit.frozen = spellStats.duration || 0
                    }
                  })
                } else if (card === "heal") {
                  targetTile.units.forEach((unit) => {
                    if (unit.owner === "player1") {
                      unit.hp = Math.min(unit.maxHp, unit.hp + (spellStats.healing || 0))
                      newDamageNumbers.push({
                        id: `heal-${Date.now()}-${Math.random()}`,
                        x: targetX,
                        y: targetY,
                        damage: spellStats.healing || 0,
                        opacity: 1,
                        isHealing: true,
                        velocity: { x: 0, y: -0.03 },
                      })
                    }
                  })
                }
              }
            }
          }
        } else {
          return prev
        }
      }

      newPlayers.player1.mana -= cost

      // DON'T auto-deselect - keep card selected for multiple placements
      return {
        ...prev,
        grid: newGrid,
        players: newPlayers,
        // selectedCard: null, // REMOVED - keep selection
        damageNumbers: newDamageNumbers,
        explosions: newExplosions,
      }
    })
  }

  const handleTileClick = (x: number, y: number, event?: React.MouseEvent) => {
    // Right-click to deselect
    if (event && event.button === 2) {
      setGameState((prev) => ({
        ...prev,
        selectedCard: null,
        selectedUnit: null,
        selectedBuilding: null,
      }))
      return
    }

    const tile = gameState.grid[y][x]

    // If we have a selected unit and clicked on a valid tile, set target
    if (gameState.selectedUnit && tile.owner !== "player2" && tile.owner !== "player3" && tile.owner !== "player4") {
      setGameState((prev) => {
        const newGrid = prev.grid.map((row) =>
          row.map((tile) => ({
            ...tile,
            units: tile.units.map((unit) =>
              unit.id === prev.selectedUnit?.id ? { ...unit, targetX: x, targetY: y } : unit,
            ),
          })),
        )

        return {
          ...prev,
          grid: newGrid,
          selectedUnit: null,
        }
      })
      return
    }

    // Select unit if clicked
    if (tile.units.length > 0 && tile.units[0].owner === "player1") {
      setGameState((prev) => ({
        ...prev,
        selectedUnit: prev.selectedUnit?.id === tile.units[0].id ? null : tile.units[0],
      }))
      return
    }

    // Select building if clicked
    if (tile.building) {
      setGameState((prev) => ({
        ...prev,
        selectedBuilding: prev.selectedBuilding?.id === tile.building?.id ? null : tile.building,
      }))
      return
    }

    // Deploy card
    deployCard(x, y)
  }

  const handleTileHover = (x: number, y: number) => {
    setGameState((prev) => ({ ...prev, hoveredTile: { x, y } }))
  }

  const handleTileLeave = () => {
    setGameState((prev) => ({ ...prev, hoveredTile: null }))
  }

  const getTileColor = (tile: Tile) => {
    if (tile.owner === "player1") return "rgba(34, 197, 94, 0.4)"
    if (tile.owner === "player2") return "rgba(239, 68, 68, 0.4)"
    if (tile.owner === "player3") return "rgba(59, 130, 246, 0.4)"
    if (tile.owner === "player4") return "rgba(245, 158, 11, 0.4)"
    return "rgba(107, 114, 128, 0.15)"
  }

  const isInRange = (
    centerX: number,
    centerY: number,
    targetX: number,
    targetY: number,
    range: number,
    minRange = 0,
  ) => {
    const distance = Math.sqrt(Math.pow(centerX - targetX, 2) + Math.pow(centerY - targetY, 2))
    return distance <= range && distance >= minRange
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getCardCost = (card: string) => {
    return (
      UNITS[card as keyof typeof UNITS]?.cost ||
      SPELLS[card as keyof typeof SPELLS]?.cost ||
      BUILDINGS[card as keyof typeof BUILDINGS]?.cost ||
      0
    )
  }

  const getCardIcon = (card: string) => {
    return (
      UNITS[card as keyof typeof UNITS]?.icon ||
      SPELLS[card as keyof typeof SPELLS]?.icon ||
      BUILDINGS[card as keyof typeof BUILDINGS]?.icon ||
      "❓"
    )
  }

  const getCardDescription = (card: string) => {
    return (
      UNITS[card as keyof typeof UNITS]?.description ||
      SPELLS[card as keyof typeof SPELLS]?.description ||
      BUILDINGS[card as keyof typeof BUILDINGS]?.description ||
      "Unknown card"
    )
  }

  // Menu Screen
  if (gameState.phase === "menu") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-8 max-w-4xl">
          <h1 className="text-4xl md:text-8xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
            4-PLAYER ARENA
          </h1>
          <p className="text-lg md:text-2xl text-gray-300">Epic Battles • Territory Conquest • Triangle Strategy</p>

          <div className="flex justify-center space-x-4 md:space-x-8">
            <Badge className="text-lg md:text-2xl px-4 md:px-6 py-2 md:py-3 bg-green-500/20 border-green-500">
              <Coins className="w-4 md:w-6 h-4 md:h-6 mr-2" />
              Credits: {gameState.credits}
            </Badge>
            <Badge className="text-lg md:text-2xl px-4 md:px-6 py-2 md:py-3 bg-purple-500/20 border-purple-500">
              <Users className="w-4 md:w-6 h-4 md:h-6 mr-2" />
              Online: 4,127
            </Badge>
          </div>

          <Card className="p-6 md:p-8 bg-gray-800/50 border-gray-600">
            <h3 className="text-2xl md:text-3xl font-bold mb-6 text-yellow-400">CHOOSE YOUR BATTLE</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xl font-bold text-blue-400">🎯 2-PLAYER DUEL</h4>
                <p className="text-sm text-gray-300">Classic 1v1 tactical combat</p>
                <Button
                  onClick={() => startGame("2player")}
                  disabled={gameState.credits < gameState.wager}
                  className="w-full text-lg py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 font-bold"
                >
                  <Swords className="w-5 h-5 mr-2" />
                  DUEL MODE
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="text-xl font-bold text-red-400">⚔️ 4-PLAYER CHAOS</h4>
                <p className="text-sm text-gray-300">Epic corner-based conquest</p>
                <Button
                  onClick={() => startGame("4player")}
                  disabled={gameState.credits < gameState.wager}
                  className="w-full text-lg py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 font-bold"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  CHAOS MODE
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-lg font-semibold mb-3 block">Entry Fee:</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setGameState((prev) => ({ ...prev, wager: amount }))}
                      variant={gameState.wager === amount ? "default" : "outline"}
                      className="text-sm md:text-lg py-2 md:py-3"
                      disabled={gameState.credits < amount}
                    >
                      {amount} Credits
                    </Button>
                  ))}
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-base md:text-lg text-gray-300">
                  Winner takes: <span className="text-green-400 font-bold">{gameState.wager * 2} Credits</span>
                </p>
                <p className="text-sm text-gray-400">Platform fee: 10%</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-left">
            <div className="space-y-3">
              <h3 className="text-xl md:text-2xl font-bold text-orange-400">🔥 NEW FEATURES:</h3>
              <p className="text-sm md:text-base">• Territory conquest system!</p>
              <p className="text-sm md:text-base">• Triangle-based strategic positioning</p>
              <p className="text-sm md:text-base">• Defeat enemies to claim their land</p>
              <p className="text-sm md:text-base">• Smart targeting (only alive players)</p>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl md:text-2xl font-bold text-red-400">⚔️ TACTICAL COMBAT:</h3>
              <p className="text-sm md:text-base">• Click units to command</p>
              <p className="text-sm md:text-base">• Set strategic targets</p>
              <p className="text-sm md:text-base">• Destroy enemy defenses</p>
              <p className="text-sm md:text-base">• Last player standing wins!</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Result Screen
  if (gameState.phase === "result") {
    const isWinner = gameState.winner === "player1"
    const winnings = isWinner ? Math.floor(gameState.wager * 2 * 0.9) : 0

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-8">
          <h1
            className={`text-4xl md:text-7xl font-bold ${isWinner ? "text-green-400" : gameState.winner === "tie" ? "text-yellow-400" : "text-red-400"}`}
          >
            {isWinner ? "🏆 VICTORY!" : gameState.winner === "tie" ? "🤝 TIE!" : "💀 DEFEATED!"}
          </h1>

          <Card className="p-6 md:p-8 bg-gray-800 border-gray-600">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(PLAYER_POSITIONS).map(([player, pos]) => {
                  const playerState = gameState.players[player as PlayerType]
                  const isAlive = gameState.alivePlayers.includes(player as PlayerType)

                  return (
                    <div key={player} className="text-center">
                      <div
                        className={`w-12 md:w-16 h-12 md:h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                          isAlive ? "opacity-100" : "opacity-50 grayscale"
                        }`}
                        style={{ backgroundColor: pos.color }}
                      >
                        <span className="text-lg md:text-2xl">{pos.icon}</span>
                      </div>
                      <h3 className="text-sm md:text-lg font-bold">{pos.name}</h3>
                      <Badge
                        className={`text-xs md:text-sm px-2 py-1 ${isAlive ? "bg-green-500" : "bg-red-500"}`}
                        style={{ backgroundColor: isAlive ? pos.color : "#666" }}
                      >
                        HP: {Math.max(0, playerState.hp)}
                      </Badge>
                    </div>
                  )
                })}
              </div>

              {isWinner && (
                <div className="text-center space-y-2">
                  <p className="text-2xl md:text-3xl font-bold text-green-400">+{winnings} Credits Won!</p>
                  <p className="text-xs md:text-sm text-gray-400">
                    Platform fee: {gameState.wager * 2 - winnings} credits
                  </p>
                </div>
              )}

              {gameState.winner === "tie" && <p className="text-xl md:text-2xl text-yellow-400">Entry fee returned!</p>}
            </div>
          </Card>

          <Button
            onClick={() =>
              setGameState((prev) => ({
                ...prev,
                phase: "menu",
                credits: prev.credits + winnings + (gameState.winner === "tie" ? gameState.wager : 0),
              }))
            }
            className="text-lg md:text-2xl px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-500 to-purple-500 font-bold"
          >
            BATTLE AGAIN
          </Button>
        </div>
      </div>
    )
  }

  // NEW LAYOUT: Map on Left (2/3) + Controls on Right (1/3)
  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden flex">
      {/* LEFT SIDE: Game Map (2/3 of screen) */}
      <div className="w-2/3 h-full flex flex-col">
        {/* Compact Header */}
        <div className="flex-shrink-0 p-3 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
          <div className="text-center mb-2">
            <h2 className={`text-2xl font-bold ${gameState.phase === "prep" ? "text-blue-400" : "text-red-400"}`}>
              {gameState.phase === "prep" ? "🏗️ PREPARATION" : "⚔️ 4-PLAYER BATTLE"}
            </h2>
            <Badge className="text-lg px-4 py-2 bg-yellow-600 mt-1">
              <Timer className="w-4 h-4 mr-2" />
              {formatTime(gameState.phaseTime)}
            </Badge>
          </div>

          {/* 4-Player Stats - Compact */}
          <div className="grid grid-cols-4 gap-2 text-sm">
            {Object.entries(PLAYER_POSITIONS).map(([player, pos]) => {
              const playerState = gameState.players[player as PlayerType]
              const isAlive = gameState.alivePlayers.includes(player as PlayerType)

              return (
                <div key={player} className={`flex items-center space-x-1 ${!isAlive ? "opacity-50" : ""}`}>
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: pos.color }}
                  >
                    <span className="text-xs">{pos.icon}</span>
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">{pos.name}</div>
                    <div>HP: {Math.max(0, playerState.hp)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Game Grid - Takes remaining space */}
        <div className="flex-1 flex justify-center items-center p-4">
          <div
            className="grid gap-0 border-4 border-gray-600 bg-gray-800 rounded-lg relative shadow-2xl"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: "min(90%, 600px)",
              height: "min(90%, 600px)",
              aspectRatio: "1/1",
            }}
          >
            {gameState.grid.map((row, y) =>
              row.map((tile, x) => (
                <div
                  key={`${x}-${y}`}
                  className={`
                    border border-gray-600 cursor-pointer transition-all duration-150
                    flex items-center justify-center relative
                    hover:brightness-125 hover:border-yellow-400
                    ${gameState.selectedCard ? "hover:ring-1 hover:ring-yellow-400" : ""}
                    ${gameState.hoveredTile?.x === x && gameState.hoveredTile?.y === y ? "ring-1 ring-blue-400" : ""}
                    ${gameState.selectedUnit && tile.owner === "player1" ? "hover:ring-1 hover:ring-green-400" : ""}
                  `}
                  style={{ backgroundColor: getTileColor(tile) }}
                  onClick={(e) => handleTileClick(x, y, e)}
                  onMouseEnter={() => handleTileHover(x, y)}
                  onMouseLeave={handleTileLeave}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleTileClick(x, y, e)
                  }}
                >
                  {/* Range indicators */}
                  {gameState.showRanges &&
                    tile.building &&
                    BUILDINGS[tile.building.type].range > 0 &&
                    gameState.grid.map((gridRow, gridY) =>
                      gridRow.map((gridTile, gridX) => {
                        const building = tile.building!
                        const buildingStats = BUILDINGS[building.type]
                        const inRange = isInRange(x, y, gridX, gridY, buildingStats.range, buildingStats.minRange)
                        const inMinRange = isInRange(x, y, gridX, gridY, buildingStats.minRange, 0)

                        if (inRange && !(gridX === x && gridY === y)) {
                          return (
                            <div
                              key={`range-${gridX}-${gridY}`}
                              className="absolute bg-yellow-400 opacity-20 pointer-events-none"
                              style={{
                                left: `${((gridX - x) * 100) / GRID_SIZE}%`,
                                top: `${((gridY - y) * 100) / GRID_SIZE}%`,
                                width: `${100 / GRID_SIZE}%`,
                                height: `${100 / GRID_SIZE}%`,
                              }}
                            />
                          )
                        } else if (inMinRange && buildingStats.minRange > 0 && !(gridX === x && gridY === y)) {
                          return (
                            <div
                              key={`deadzone-${gridX}-${gridY}`}
                              className="absolute bg-red-500 opacity-30 pointer-events-none"
                              style={{
                                left: `${((gridX - x) * 100) / GRID_SIZE}%`,
                                top: `${((gridY - y) * 100) / GRID_SIZE}%`,
                                width: `${100 / GRID_SIZE}%`,
                                height: `${100 / GRID_SIZE}%`,
                              }}
                            />
                          )
                        }
                        return null
                      }),
                    )}

                  {/* Targeting lines */}
                  {tile.building && tile.building.targetX !== undefined && tile.building.targetY !== undefined && (
                    <>
                      <div
                        className="absolute bg-red-500 opacity-60 pointer-events-none"
                        style={{
                          left: "50%",
                          top: "50%",
                          width: "1px",
                          height: `${Math.sqrt(
                            Math.pow((tile.building.targetX - x) * 25, 2) +
                              Math.pow((tile.building.targetY - y) * 25, 2),
                          )}px`,
                          transformOrigin: "top",
                          transform: `rotate(${
                            Math.atan2(tile.building.targetY - y, tile.building.targetX - x) * (180 / Math.PI) + 90
                          }deg)`,
                        }}
                      />
                      {tile.building.type === "cannon" && (
                        <Crosshair className="absolute top-0 right-0 w-1.5 h-1.5 text-red-400 animate-pulse" />
                      )}
                    </>
                  )}

                  {/* Enhanced Building */}
                  {tile.building && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className={`absolute inset-0 rounded opacity-50`}
                        style={{
                          backgroundColor: PLAYER_POSITIONS[tile.building.owner]?.color || "#666",
                          border: `1px solid ${PLAYER_POSITIONS[tile.building.owner]?.color || "#666"}`,
                        }}
                      />

                      <span
                        className={`text-xs font-bold relative z-10 ${
                          gameState.selectedBuilding?.id === tile.building.id ? "animate-pulse" : ""
                        } ${tile.building.charging && tile.building.charging > 5 ? "animate-bounce" : ""}`}
                        style={{
                          transform: tile.building.aimAngle ? `rotate(${tile.building.aimAngle}rad)` : "none",
                          filter: tile.building.charging ? `brightness(${1 + tile.building.charging * 0.1})` : "none",
                          textShadow: "1px 1px 2px #000",
                          color: "white",
                        }}
                      >
                        {BUILDINGS[tile.building.type].icon}
                      </span>

                      <div className="absolute bottom-0 right-0 bg-black text-white text-xs px-1 rounded font-bold">
                        {tile.building.hp}
                      </div>
                      {tile.building.cooldown > 0 && (
                        <div className="absolute top-0 left-0 bg-yellow-500 text-black text-xs px-1 rounded font-bold">
                          {Math.ceil(tile.building.cooldown / 10)}
                        </div>
                      )}
                      {tile.building.charging && tile.building.charging > 0 && (
                        <div className="absolute -top-0.5 -left-0.5 w-full h-0.5 bg-yellow-400 rounded animate-pulse" />
                      )}
                    </div>
                  )}

                  {/* Enhanced Interactive Units */}
                  {tile.units.length > 0 && (
                    <div className="absolute inset-0 flex flex-wrap items-center justify-center">
                      {tile.units.slice(0, 4).map((unit, i) => (
                        <div key={unit.id} className="relative">
                          {/* Enhanced ownership background */}
                          <div
                            className={`absolute inset-0 rounded-full opacity-60 -m-0.5 ${
                              gameState.selectedUnit?.id === unit.id ? "ring-2 ring-yellow-400 animate-pulse" : ""
                            }`}
                            style={{
                              backgroundColor: PLAYER_POSITIONS[unit.owner]?.color || "#666",
                              border: `1px solid ${PLAYER_POSITIONS[unit.owner]?.color || "#666"}`,
                            }}
                          />

                          <span
                            className={`text-xs font-bold relative z-10 text-white ${
                              unit.lastDamage ? "animate-bounce" : ""
                            } ${unit.isMoving ? "animate-pulse" : ""}`}
                            style={{
                              filter: unit.frozen > 0 ? "brightness(0.5) sepia(1) hue-rotate(180deg)" : "none",
                              transform: `scale(${UNITS[unit.type].size * 0.8})`,
                              textShadow: "1px 1px 2px #000",
                            }}
                          >
                            {UNITS[unit.type].icon}
                          </span>

                          {/* Target indicator */}
                          {unit.targetX !== undefined && unit.targetY !== undefined && (
                            <div className="absolute -top-1 -right-1 w-1 h-1 bg-yellow-400 rounded-full animate-ping" />
                          )}

                          {/* Clearer ownership indicator */}
                          <div
                            className="absolute -top-1 -left-1 w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: PLAYER_POSITIONS[unit.owner]?.color || "#666" }}
                          />

                          {unit.frozen > 0 && (
                            <Snowflake className="absolute -top-1 -right-1 w-1.5 h-1.5 text-blue-400" />
                          )}
                          {unit.hp < unit.maxHp && (
                            <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-gray-800 rounded border">
                              <div
                                className="h-full rounded"
                                style={{
                                  backgroundColor: PLAYER_POSITIONS[unit.owner]?.color || "#666",
                                  width: `${(unit.hp / unit.maxHp) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                          {unit.moveCooldown > 0 && (
                            <div className="absolute -top-2 left-0 w-full h-0.5 bg-blue-400 rounded opacity-80" />
                          )}
                        </div>
                      ))}
                      {tile.units.length > 4 && (
                        <span className="text-xs text-yellow-300 font-bold bg-black px-1 rounded">
                          +{tile.units.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )),
            )}

            {/* Enhanced Projectiles */}
            {gameState.projectiles.map((projectile) => (
              <div key={projectile.id}>
                {/* Projectile trail */}
                {projectile.trail.map((trailPoint, index) => (
                  <div
                    key={`trail-${index}`}
                    className="absolute w-1 h-1 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: projectile.color,
                      left: `${(trailPoint.x / GRID_SIZE) * 100}%`,
                      top: `${(trailPoint.y / GRID_SIZE) * 100}%`,
                      opacity: 0.3 * (index / projectile.trail.length),
                    }}
                  />
                ))}

                {/* Main projectile */}
                <div
                  className="absolute w-1.5 h-1.5 rounded-full pointer-events-none animate-pulse"
                  style={{
                    backgroundColor: projectile.color,
                    left: `${(projectile.currentX / GRID_SIZE) * 100}%`,
                    top: `${(projectile.currentY / GRID_SIZE) * 100}%`,
                    boxShadow: `0 0 8px ${projectile.color}`,
                  }}
                />
              </div>
            ))}

            {/* Enhanced Explosions */}
            {gameState.explosions.map((explosion) => (
              <div
                key={explosion.id}
                className="absolute rounded-full pointer-events-none animate-ping"
                style={{
                  backgroundColor: explosion.color,
                  left: `${(explosion.x / GRID_SIZE) * 100}%`,
                  top: `${(explosion.y / GRID_SIZE) * 100}%`,
                  width: `${(explosion.radius / GRID_SIZE) * 100}%`,
                  height: `${(explosion.radius / GRID_SIZE) * 100}%`,
                  opacity: explosion.opacity,
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 ${explosion.radius * 10}px ${explosion.color}`,
                }}
              />
            ))}

            {/* Enhanced Damage Numbers */}
            {gameState.damageNumbers.map((damageNum) => (
              <div
                key={damageNum.id}
                className={`absolute pointer-events-none font-bold text-xs ${
                  damageNum.isHealing ? "text-green-400" : "text-red-400"
                }`}
                style={{
                  left: `${(damageNum.x / GRID_SIZE) * 100}%`,
                  top: `${(damageNum.y / GRID_SIZE) * 100}%`,
                  opacity: damageNum.opacity,
                  transform: `translateY(-${(1 - damageNum.opacity) * 20}px) translateX(${damageNum.velocity.x * 50}px)`,
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {damageNum.isHealing ? "+" : "-"}
                {damageNum.damage}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Controls Panel (1/3 of screen) */}
      <div className="w-1/3 h-full bg-gray-800/80 backdrop-blur-sm border-l border-gray-700 flex flex-col overflow-y-auto">
        {/* Player Status */}
        <div className="flex-shrink-0 p-4 border-b border-gray-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-400">YOUR STATUS</h3>
              <Badge className="bg-green-600">
                <Zap className="w-3 h-3 mr-1" />
                {gameState.players.player1.mana}/{MANA_MAX}
              </Badge>
            </div>

            <Progress value={(gameState.players.player1.mana / MANA_MAX) * 100} className="h-3 bg-gray-700" />

            <div className="flex justify-between items-center">
              <span className="text-sm">HP: {gameState.players.player1.hp}/300</span>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setGameState((prev) => ({ ...prev, showRanges: !prev.showRanges }))}
                  variant="outline"
                  size="sm"
                  className="px-2 py-1 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Ranges
                </Button>
                <Button
                  onClick={() => setGameState((prev) => ({ ...prev, isPaused: !prev.isPaused }))}
                  variant="outline"
                  size="sm"
                  className="px-2 py-1 text-xs"
                >
                  {gameState.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Card Deck - Show ALL cards */}
        <div className="flex-1 p-4">
          <Card className="p-4 bg-gray-900 border-gray-600 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{gameState.phase === "prep" ? "🏗️ BUILD" : "⚔️ DEPLOY"}</h3>
              <div className="text-xs text-gray-400">Hold card to place multiple</div>
            </div>

            {/* All Cards Grid - 2x4 layout */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {gameState.deck.map((card, index) => {
                const cost = getCardCost(card)
                const canAfford = gameState.players.player1.mana >= cost
                const isSelected = gameState.selectedCard === card

                return (
                  <Button
                    key={index}
                    onMouseDown={() => {
                      setGameState((prev) => ({
                        ...prev,
                        selectedCard: prev.selectedCard === card ? null : card,
                      }))
                    }}
                    onMouseUp={() => {
                      // Clear selection after a delay if not placing
                      setTimeout(() => {
                        if (!gameState.selectedCard) return
                      }, 100)
                    }}
                    disabled={!canAfford}
                    variant={isSelected ? "default" : "outline"}
                    className={`
              flex flex-col items-center p-2 h-20 text-sm
              ${!canAfford ? "opacity-50" : ""}
              ${isSelected ? "ring-2 ring-yellow-400 animate-pulse bg-yellow-600" : ""}
              hover:scale-105 transition-all duration-200
              active:scale-95
            `}
                  >
                    <span className="text-lg mb-1">{getCardIcon(card)}</span>
                    <span className="capitalize font-bold text-xs truncate w-full text-center">{card}</span>
                    <Badge className="text-xs px-1 py-0.5 bg-purple-500 mt-1">{cost} ⚡</Badge>
                  </Button>
                )
              })}
            </div>

            {/* Enhanced Status Display */}
            <div className="space-y-3 flex-1">
              <p className="text-sm text-gray-300 text-center">
                {gameState.phase === "prep"
                  ? "🏗️ Build in your CORNER territory!"
                  : "⚔️ CORNER CONQUEST! Click & hold cards to place multiple!"}
              </p>

              {gameState.selectedCard && (
                <div className="bg-yellow-900/50 rounded p-3 text-sm border border-yellow-600">
                  <p className="text-yellow-400 font-bold">
                    Selected: {gameState.selectedCard} (Cost: {getCardCost(gameState.selectedCard)} mana)
                  </p>
                  <p className="text-gray-300 text-xs mt-1">{getCardDescription(gameState.selectedCard)}</p>
                  <p className="text-blue-300 text-xs mt-1">💡 Hold card selected to place multiple items!</p>
                </div>
              )}

              {gameState.selectedUnit && (
                <div className="bg-green-900/50 rounded p-3 text-sm border border-green-600">
                  <p className="text-green-400 font-bold">
                    Unit: {gameState.selectedUnit.type} (HP: {gameState.selectedUnit.hp}/{gameState.selectedUnit.maxHp})
                  </p>
                  <p className="text-gray-300 text-xs mt-1">Click tile to set target!</p>
                </div>
              )}

              {gameState.selectedBuilding && (
                <div className="bg-blue-900/50 rounded p-3 text-sm border border-blue-600">
                  <p className="text-blue-400 font-bold">
                    Building: {gameState.selectedBuilding.type} (HP: {gameState.selectedBuilding.hp}/
                    {gameState.selectedBuilding.maxHp})
                  </p>
                  <p className="text-gray-300 text-xs mt-1">{getCardDescription(gameState.selectedBuilding.type)}</p>
                </div>
              )}

              {gameState.phase === "battle" && gameState.gameMode === "4player" && (
                <div className="bg-red-900/50 rounded p-3 text-sm border border-red-600">
                  <p className="text-red-400 font-bold">🔥 4-PLAYER CORNER CONQUEST:</p>
                  <ul className="text-gray-300 text-xs mt-1 space-y-1">
                    <li>• Each player starts in a corner</li>
                    <li>• Defeat enemies to claim their territory</li>
                    <li>• Units only target ALIVE players</li>
                    <li>• Last corner standing wins!</li>
                  </ul>
                </div>
              )}

              <div className="bg-gray-700/50 rounded p-3 text-sm border border-gray-500">
                <p className="text-gray-300 font-bold">🎮 CONTROLS:</p>
                <ul className="text-gray-400 text-xs mt-1 space-y-1">
                  <li>• Click card once to select</li>
                  <li>• Hold selection to place multiple</li>
                  <li>• Click units to command them</li>
                  <li>• Right-click to deselect</li>
                </ul>
              </div>

              {gameState.spectators > 0 && (
                <div className="text-center">
                  <Badge className="px-3 py-1 bg-purple-500 text-sm">
                    <Users className="w-3 h-3 mr-1" />
                    {gameState.spectators} watching
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
