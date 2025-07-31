"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Zap, Crown, Coins, Timer, Users, Eye, Play, Pause, Swords, Bot, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

// --- GAME CONSTANTS AND DATA ---
const GRID_SIZE = 24
const PREP_TIME = 60
const BATTLE_TIME = 240
const MANA_MAX = 25
const MANA_REGEN_RATE = 1500

const PLAYER_POSITIONS_4P = {
  player1: { towerX: 12, towerY: 21, color: "#22C55E", name: "YOU", icon: "👑" },
  player2: { towerX: 2, towerY: 12, color: "#EF4444", name: "WEST", icon: "🔴" },
  player3: { towerX: 12, towerY: 2, color: "#3B82F6", name: "NORTH", icon: "🔵" },
  player4: { towerX: 21, towerY: 12, color: "#F59E0B", name: "EAST", icon: "🟡" },
}
const PLAYER_POSITIONS_2P = {
  player1: { towerX: 12, towerY: 22, color: "#22C55E", name: "YOU", icon: "👑" },
  player2: { towerX: 12, towerY: 1, color: "#EF4444", name: "OPPONENT", icon: "🔴" },
}

const UNITS = {
  knight: { name: "Knight", cost: 3, hp: 120, damage: 35, range: 1, icon: "⚔️", color: "#8B5CF6", moveDelay: 18, size: 1.2, description: "Tanky melee fighter" },
  archer: { name: "Archer", cost: 2, hp: 70, damage: 25, range: 3, icon: "🏹", color: "#10B981", moveDelay: 12, size: 1.0, description: "Ranged damage dealer" },
  wizard: { name: "Wizard", cost: 4, hp: 90, damage: 50, range: 2, icon: "🧙", color: "#3B82F6", moveDelay: 15, size: 1.1, description: "Magic damage caster" },
  giant: { name: "Giant", cost: 6, hp: 300, damage: 60, range: 1, icon: "🗿", color: "#6B7280", moveDelay: 30, size: 1.5, description: "Massive tank unit" },
  healer: { name: "Healer", cost: 3, hp: 80, damage: 0, range: 2, icon: "✨", color: "#F59E0B", moveDelay: 15, size: 1.0, description: "Heals friendly units" },
}
const SPELLS = {
  fireball: { name: "Fireball", cost: 4, damage: 100, radius: 2, icon: "🔥", color: "#DC2626", description: "Area fire damage" },
  freeze: { name: "Freeze", cost: 3, duration: 40, radius: 2, icon: "❄️", color: "#06B6D4", description: "Freezes enemies" },
  lightning: { name: "Lightning", cost: 5, damage: 150, radius: 1, icon: "⚡", color: "#A855F7", description: "High single damage" },
  heal: { name: "Heal", cost: 2, healing: 80, radius: 2, icon: "💚", color: "#22C55E", description: "Heals friendly units" },
}
const BUILDINGS = {
  tower: { name: "Tower", cost: 4, hp: 200, damage: 40, range: 4, icon: "🏰", color: "#1F2937", attackSpeed: 25, minRange: 0, description: "Defensive structure" },
  wall: { name: "Wall", cost: 1, hp: 500, damage: 0, range: 0, icon: "🧱", color: "#6B7280", attackSpeed: 0, minRange: 0, description: "Blocks movement. High HP." },
  cannon: { name: "Cannon", cost: 3, hp: 100, damage: 80, range: 7, icon: "💣", color: "#7C2D12", attackSpeed: 45, minRange: 3, description: "Long-range artillery" },
  tesla: { name: "Tesla", cost: 4, hp: 100, damage: 60, range: 3, icon: "⚡", color: "#7C3AED", attackSpeed: 20, minRange: 0, description: "Electric tower" },
}

// --- TYPE DEFINITIONS ---
type PlayerType = "player1" | "player2" | "player3" | "player4"
interface Profile {
  id: string
  username: string
  credits: number
  wins: number
  losses: number
}
interface LobbyPlayer {
  id: string;
  username: string
  color: string
  isReady: boolean
  isAI: boolean
  slot: PlayerType
}
interface Lobby {
  id: number;
  code: string
  host_id: string
  players: LobbyPlayer[]
  game_mode: "2player" | "4player"
  wager: number
  is_private: boolean
  status: "waiting" | "starting" | "in-game"
  created_at: string;
}
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
  username: string
  color: string
}
interface GameState {
  currentUser: User | null
  currentProfile: Profile | null
  currentLobby: Lobby | null
  phase: "login" | "menu" | "lobby" | "prep" | "battle" | "result"
  phaseTime: number
  players: Record<PlayerType, PlayerState>
  grid: Tile[][]
  selectedCard: string | null
  selectedUnit: Unit | null
  hoveredTile: { x: number; y: number } | null
  deck: string[]
  winner: PlayerType | "tie" | null
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
  loginForm: { email: string; password: string; username: string }
  joinLobbyCode: string
  wager: number
  menuSelection: '2p' | '4p' | null;
}

export default function FourPlayerBattleArena() {
  const [gameState, setGameState] = useState<GameState>({
    currentUser: null,
    currentProfile: null,
    currentLobby: null,
    phase: "login",
    phaseTime: 0,
    players: {} as Record<PlayerType, PlayerState>,
    grid: [],
    selectedCard: null,
    selectedUnit: null,
    hoveredTile: null,
    deck: ["knight", "archer", "wizard", "fireball", "tower", "wall", "cannon", "heal"],
    winner: null,
    spectators: 0,
    projectiles: [],
    damageNumbers: [],
    explosions: [],
    showRanges: false,
    selectedBuilding: null,
    isPaused: false,
    gameSpeed: 1.0,
    gameMode: "4player",
    alivePlayers: [],
    loginForm: { email: "", password: "", username: "" },
    joinLobbyCode: "",
    wager: 25,
    menuSelection: null,
  })

  const gameLoopRef = useRef<number>()
  const manaTimerRef = useRef<NodeJS.Timeout>()

  // --- AUTH & PROFILE MANAGEMENT (Supabase) ---
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setGameState((p) => ({ ...p, currentUser: session.user }))
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
        if (profile) {
          setGameState((p) => ({ ...p, currentProfile: profile, phase: "menu" }))
        } else {
          setGameState((p) => ({ ...p, phase: "login" }))
        }
      }
    }
    getSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        getSession()
      }
      if (event === "SIGNED_OUT") {
        setGameState((p) => ({ ...p, currentUser: null, currentProfile: null, phase: "login" }))
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const createAccount = async () => {
    const { email, password, username } = gameState.loginForm
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username } },
    })
    if (error) alert(error.message)
    else alert("Account created! Please check your email to verify.")
  }

  const login = async () => {
    const { email, password } = gameState.loginForm
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!gameState.currentUser) return
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", gameState.currentUser.id)
      .select()
      .single()
    if (error) {
      console.error("Error updating profile:", error)
    } else if (data) {
      setGameState((p) => ({ ...p, currentProfile: data }))
    }
  }

  // --- LOBBY MANAGEMENT ---
  const createLobby = async (gameMode: "2player" | "4player", isPrivate: boolean, wager: number) => {
    if (!gameState.currentProfile || !gameState.currentUser) return alert("You must be logged in.");
    if (wager > 0 && gameState.currentProfile.credits < wager) return alert("Not enough credits!");

    const playerPositions = gameMode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P;
    const newLobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const hostPlayer: LobbyPlayer = {
      id: gameState.currentUser.id,
      username: gameState.currentProfile.username,
      color: playerPositions.player1.color,
      isReady: true,
      isAI: false,
      slot: "player1",
    };

    const playersList: LobbyPlayer[] = [hostPlayer];
    
    // If it's a public game vs AI, fill the slots now
    if (!isPrivate) {
      const maxPlayers = gameMode === "4player" ? 4 : 2;
      for (let i = 1; i < maxPlayers; i++) {
        const slot = `player${i + 1}` as PlayerType;
        playersList.push({
          id: `ai-${i}`,
          username: `AI Bot ${i}`,
          color: playerPositions[slot].color,
          isReady: true,
          isAI: true,
          slot,
        });
      }
    }

    const { data, error } = await supabase
      .from("lobbies")
      .insert({
        code: newLobbyCode,
        host_id: gameState.currentUser.id,
        players: playersList,
        game_mode: gameMode,
        wager: wager,
        is_private: isPrivate,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating lobby:", error);
      alert("Could not create lobby.");
    } else if (data) {
        if(isPrivate) {
            setGameState((p) => ({ ...p, currentLobby: data, phase: "lobby" }));
        } else {
            // If it's a game vs AI, start immediately
            startGame(data);
        }
    }
  };
  
  const joinLobby = async () => {
    const code = gameState.joinLobbyCode.toUpperCase();
    if (!code) return alert("Please enter a lobby code.");
    if (!gameState.currentProfile || !gameState.currentUser) return alert("You must be logged in to join a lobby.");

    const { data: lobby, error } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !lobby) {
        return alert(`Lobby "${code}" not found.`);
    }
    
    const maxPlayers = lobby.game_mode === "4player" ? 4 : 2;
    if (lobby.players.length >= maxPlayers) {
        return alert("Lobby is full.");
    }

    if (lobby.players.some((p: LobbyPlayer) => p.id === gameState.currentUser?.id)) {
       setGameState((p) => ({ ...p, currentLobby: lobby as Lobby, phase: "lobby" }));
       return;
    }

    if (gameState.currentProfile.credits < lobby.wager) {
        return alert("You don't have enough credits to join this lobby.");
    }

    const playerPositions = lobby.game_mode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P;
    const nextSlot = `player${lobby.players.length + 1}` as PlayerType;

    const newPlayer: LobbyPlayer = {
        id: gameState.currentUser.id,
        username: gameState.currentProfile.username,
        color: playerPositions[nextSlot].color,
        isReady: false,
        isAI: false,
        slot: nextSlot
    };

    const { data: updatedLobby, error: updateError } = await supabase
        .from('lobbies')
        .update({ players: [...lobby.players, newPlayer] })
        .eq('code', code)
        .select()
        .single();
    
    if (updateError) {
        return alert("Failed to join lobby.");
    }
    
    setGameState((p) => ({ ...p, currentLobby: updatedLobby as Lobby, phase: "lobby" }));
  };

  const leaveLobby = async () => {
    if (!gameState.currentLobby || !gameState.currentUser) return;
    
    const updatedPlayers = gameState.currentLobby.players.filter(p => p.id !== gameState.currentUser?.id);

    // If host leaves, delete lobby. Otherwise, just update players.
    if (gameState.currentUser.id === gameState.currentLobby.host_id) {
        await supabase.from('lobbies').delete().eq('id', gameState.currentLobby.id);
    } else {
        await supabase.from('lobbies').update({ players: updatedPlayers }).eq('id', gameState.currentLobby.id);
    }

    setGameState((p) => ({ ...p, currentLobby: null, phase: "menu" }));
  }

  const startGame = (lobby: Lobby) => {
    if (!gameState.currentProfile) return;
    
    let currentPlayers = [...lobby.players];
    const maxPlayers = lobby.game_mode === '4player' ? 4 : 2;
    const playerPositions = lobby.game_mode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P;

    // Fill remaining slots with AI if lobby isn't full
    while (currentPlayers.length < maxPlayers) {
        const slot = `player${currentPlayers.length + 1}` as PlayerType;
        currentPlayers.push({
            id: `ai-${currentPlayers.length}`,
            username: `AI Bot ${currentPlayers.length}`,
            color: playerPositions[slot].color,
            isReady: true,
            isAI: true,
            slot,
        });
    }

    if (lobby.wager > 0) {
        updateProfile({ credits: gameState.currentProfile.credits - lobby.wager });
    }

    const players: Record<PlayerType, PlayerState> = {} as any;
    const alivePlayers: PlayerType[] = [];
    currentPlayers.forEach((lp) => {
      players[lp.slot] = {
        hp: 300,
        mana: MANA_MAX,
        isAlive: true,
        isAI: lp.isAI,
        username: lp.username,
        color: lp.color,
      }
      alivePlayers.push(lp.slot)
    })

    setGameState((p) => ({
      ...p,
      phase: "prep",
      phaseTime: PREP_TIME,
      players,
      alivePlayers,
      grid: initializeGrid(lobby.game_mode),
      gameMode: lobby.game_mode,
      currentLobby: lobby,
    }));
  }

  // --- REAL-TIME LOBBY SUBSCRIPTION ---
  useEffect(() => {
    if (gameState.phase !== "lobby" || !gameState.currentLobby) return;

    const channel = supabase
      .channel(`lobby-${gameState.currentLobby.code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lobbies",
          filter: `code=eq.${gameState.currentLobby.code}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
              alert("The host has left the lobby.");
              setGameState((p) => ({ ...p, currentLobby: null, phase: "menu" }));
          } else {
              setGameState((p) => ({ ...p, currentLobby: payload.new as Lobby }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameState.phase, gameState.currentLobby]);

  // --- CORE GAME LOGIC ---
  const initializeGrid = useCallback((mode: "2player" | "4player"): Tile[][] => {
    const grid: Tile[][] = Array.from({ length: GRID_SIZE }, (_, y) =>
      Array.from({ length: GRID_SIZE }, (_, x) => ({ x, y, owner: "neutral", units: [] })),
    )
    const playerPositions = mode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P

    grid.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (mode === "4player") {
          const territorySize = 6
          if (Math.abs(x - 12) + Math.abs(y - 21) <= territorySize) tile.owner = "player1"
          else if (Math.abs(x - 2) + Math.abs(y - 12) <= territorySize) tile.owner = "player2"
          else if (Math.abs(x - 12) + Math.abs(y - 2) <= territorySize) tile.owner = "player3"
          else if (Math.abs(x - 21) + Math.abs(y - 12) <= territorySize) tile.owner = "player4"
        } else {
          if (y >= GRID_SIZE - 6) tile.owner = "player1"
          if (y < 6) tile.owner = "player2"
        }
      }),
    )

    Object.entries(playerPositions).forEach(([player, pos]) => {
      grid[pos.towerY][pos.towerX].building = {
        id: `${player}-main`,
        type: "tower",
        owner: player as PlayerType,
        x: pos.towerX,
        y: pos.towerY,
        hp: 300,
        maxHp: 300,
        cooldown: 0,
        isMainTower: true,
      }
    })
    return grid
  }, [])

  const getNextMovePosition = useCallback(
    (unit: Unit, currentX: number, currentY: number, alivePlayers: PlayerType[], gameMode: "2player" | "4player") => {
      if (unit.targetX !== undefined && unit.targetY !== undefined) {
        const dx = unit.targetX - currentX,
          dy = unit.targetY - currentY
        if (dx === 0 && dy === 0) return null
        if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? currentX + 1 : currentX - 1, y: currentY }
        else if (dy !== 0) return { x: currentX, y: dy > 0 ? currentY + 1 : currentY - 1 }
      }
      let nearestTower: { x: number; y: number; distance: number } | null = null
      const positions = gameMode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P
      Object.entries(positions).forEach(([player, pos]) => {
        if (player !== unit.owner && alivePlayers.includes(player as PlayerType)) {
          const distance = Math.hypot(pos.towerX - currentX, pos.towerY - currentY)
          if (!nearestTower || distance < nearestTower.distance)
            nearestTower = { x: pos.towerX, y: pos.towerY, distance }
        }
      })
      if (nearestTower) {
        const dx = nearestTower.x - currentX,
          dy = nearestTower.y - currentY
        if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? currentX + 1 : currentX - 1, y: currentY }
        else if (dy !== 0) return { x: currentX, y: dy > 0 ? currentY + 1 : currentY - 1 }
      }
      return { x: currentX, y: currentY }
    },
    [],
  )

  const conquestTerritory = (defeatedPlayer: PlayerType, conqueror: PlayerType, grid: Tile[][]) => {
    if (defeatedPlayer === conqueror) return
    grid.flat().forEach((tile) => {
      if (tile.owner === defeatedPlayer) {
        tile.owner = conqueror
        if (tile.building && tile.building.owner === defeatedPlayer) tile.building.owner = conqueror
      }
    })
  }

  useEffect(() => {
    if (["login", "menu", "lobby", "result"].includes(gameState.phase) || gameState.isPaused) return
    const timer = setInterval(() => {
      setGameState((p) => {
        if (p.phaseTime <= 1) {
          if (p.phase === "prep") return { ...p, phase: "battle", phaseTime: BATTLE_TIME }
          else {
            let winner: PlayerType | "tie" | null = "tie",
              maxHp = -1
            p.alivePlayers.forEach((pl) => {
              if (p.players[pl].hp > maxHp) {
                maxHp = p.players[pl].hp
                winner = pl
              } else if (p.players[pl].hp === maxHp) winner = "tie"
            })
            return { ...p, phase: "result", winner }
          }
        }
        return { ...p, phaseTime: p.phaseTime - 1 }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [gameState.phase, gameState.isPaused])

  useEffect(() => {
    if (gameState.phase !== "battle" || gameState.isPaused) return
    manaTimerRef.current = setInterval(() => {
      setGameState((p) => ({
        ...p,
        players: Object.fromEntries(
          Object.entries(p.players).map(([id, s]) => [id, { ...s, mana: Math.min(MANA_MAX, s.mana + 1) }]),
        ) as any,
      }))
    }, MANA_REGEN_RATE)
    return () => {
      if (manaTimerRef.current) clearInterval(manaTimerRef.current)
    }
  }, [gameState.phase, gameState.isPaused])

  useEffect(() => {
    if (gameState.phase !== "battle" || gameState.isPaused) return
    const gameLoop = () => {
      setGameState((prev) => {
        const newGrid = prev.grid.map((row) =>
          row.map((tile) => ({
            ...tile,
            units: tile.units.map((u) => ({ ...u })),
            building: tile.building ? { ...tile.building } : undefined,
          })),
        )
        const newPlayers = JSON.parse(JSON.stringify(prev.players))
        let newProjectiles = [...prev.projectiles]
        const newDamageNumbers = [...prev.damageNumbers]
          .map((d) => ({ ...d, opacity: d.opacity - 0.015, y: d.y - 0.02 }))
          .filter((d) => d.opacity > 0)
        const newExplosions = [...prev.explosions]
          .map((e) => ({ ...e, radius: e.radius + 0.1, opacity: e.opacity - 0.05 }))
          .filter((e) => e.opacity > 0)

        newProjectiles = newProjectiles
          .map((p) => ({
            ...p,
            currentX: p.currentX + p.velocity.x,
            currentY: p.currentY + p.velocity.y,
            progress: p.progress + p.speed,
          }))
          .filter((p) => {
            if (Math.hypot(p.currentX - p.toX, p.currentY - p.toY) < 0.5 || p.progress >= 1) {
              const hitX = Math.floor(p.toX),
                hitY = Math.floor(p.toY)
              if (hitX >= 0 && hitX < GRID_SIZE && hitY >= 0 && hitY < GRID_SIZE) {
                const targetTile = newGrid[hitY][hitX]
                newExplosions.push({
                  id: `e-${Math.random()}`,
                  x: p.toX,
                  y: p.toY,
                  radius: 0,
                  maxRadius: 1.5,
                  opacity: 1,
                  color: p.color,
                })
                targetTile.units.forEach((u) => {
                  if (u.owner !== p.owner) {
                    u.hp = Math.max(0, u.hp - p.damage)
                    newDamageNumbers.push({
                      id: `d-${Math.random()}`,
                      x: u.x,
                      y: u.y,
                      damage: p.damage,
                      opacity: 1,
                      velocity: { x: 0, y: -0.03 },
                    })
                  }
                })
                if (targetTile.building && targetTile.building.owner !== p.owner) {
                  const b = targetTile.building
                  b.hp = Math.max(0, b.hp - p.damage)
                  newDamageNumbers.push({
                    id: `d-${Math.random()}`,
                    x: b.x,
                    y: b.y,
                    damage: p.damage,
                    opacity: 1,
                    velocity: { x: 0, y: -0.04 },
                  })
                  if (b.isMainTower) newPlayers[b.owner].hp = b.hp
                }
              }
              return false
            }
            return true
          })

        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const tile = newGrid[y][x]
            tile.units = tile.units
              .map((u) => ({
                ...u,
                cooldown: Math.max(0, u.cooldown - 1),
                frozen: Math.max(0, u.frozen - 1),
                moveCooldown: Math.max(0, u.moveCooldown - 1),
              }))
              .filter((u) => u.hp > 0)
            if (tile.building) tile.building.cooldown = Math.max(0, tile.building.cooldown - 1)
            tile.units.forEach((unit) => {
              if (unit.frozen > 0 || unit.cooldown > 0) return
              const stats = UNITS[unit.type]
              let target: Unit | Building | null = null
              for (let dy = -stats.range; dy <= stats.range; dy++) {
                for (let dx = -stats.range; dx <= stats.range; dx++) {
                  const checkX = x + dx,
                    checkY = y + dy
                  if (checkX >= 0 && checkX < GRID_SIZE && checkY >= 0 && checkY < GRID_SIZE) {
                    const checkTile = newGrid[checkY][checkX]
                    const potentialUnit = checkTile.units.find((u) => u.owner !== unit.owner)
                    if (potentialUnit) {
                      target = potentialUnit
                      break
                    }
                    if (checkTile.building && checkTile.building.owner !== unit.owner) {
                      target = checkTile.building
                      break
                    }
                  }
                }
                if (target) break
              }
              if (target) {
                unit.cooldown = 30
                if (stats.range > 1) {
                  const angle = Math.atan2(target.y - unit.y, target.x - unit.x),
                    speed = 0.2
                  newProjectiles.push({
                    id: `p-${Math.random()}`,
                    fromX: unit.x,
                    fromY: unit.y,
                    toX: target.x,
                    toY: target.y,
                    currentX: unit.x,
                    currentY: unit.y,
                    progress: 0,
                    damage: stats.damage,
                    type: unit.type,
                    color: stats.color,
                    speed,
                    velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                    trail: [],
                    owner: unit.owner,
                  })
                } else {
                  target.hp = Math.max(0, target.hp - stats.damage)
                  newDamageNumbers.push({
                    id: `d-${Math.random()}`,
                    x: target.x,
                    y: target.y,
                    damage: stats.damage,
                    opacity: 1,
                    velocity: { x: 0, y: -0.03 },
                  })
                  if ("isMainTower" in target && target.isMainTower) newPlayers[target.owner].hp = target.hp
                }
              } else if (unit.moveCooldown === 0) {
                const nextPos = getNextMovePosition(unit, x, y, prev.alivePlayers, prev.gameMode)
                if (nextPos && (nextPos.x !== x || nextPos.y !== y)) {
                  const nextTile = newGrid[nextPos.y]?.[nextPos.x]
                  if (nextTile && nextTile.units.length < 3 && !nextTile.building) {
                    nextTile.units.push({ ...unit, x: nextPos.x, y: nextPos.y, moveCooldown: stats.moveDelay })
                    tile.units = tile.units.filter((u) => u.id !== unit.id)
                    if (unit.targetX === nextPos.x && unit.targetY === nextPos.y) {
                      unit.targetX = undefined
                      unit.targetY = undefined
                    }
                  }
                } else if (!nextPos) {
                  unit.targetX = undefined
                  unit.targetY = undefined
                }
              }
            })
          }
        }
        newGrid.forEach((row) =>
          row.forEach((tile) => {
            if (tile.building && tile.building.hp <= 0) tile.building = undefined
          }),
        )

        prev.alivePlayers.forEach((player) => {
          if (newPlayers[player].isAI && Math.random() < 0.06 && newPlayers[player].mana >= 2) {
            const affordable = prev.deck.filter((c) => getCardCost(c) <= newPlayers[player].mana)
            if (affordable.length > 0) {
              const card = affordable[Math.floor(Math.random() * affordable.length)]
              const cost = getCardCost(card)
              const territory = newGrid.flat().filter((t) => t.owner === player && !t.building && t.units.length < 2)
              if (territory.length > 0) {
                const tile = territory[Math.floor(Math.random() * territory.length)]
                if (UNITS[card as keyof typeof UNITS]) {
                  const stats = UNITS[card as keyof typeof UNITS]
                  tile.units.push({
                    id: `${player}-${Math.random()}`,
                    type: card as keyof typeof UNITS,
                    owner: player,
                    x: tile.x,
                    y: tile.y,
                    hp: stats.hp,
                    maxHp: stats.hp,
                    cooldown: 0,
                    frozen: 0,
                    moveCooldown: 0,
                    healCooldown: 0,
                    isMoving: false,
                    isSelected: false,
                  })
                  newPlayers[player].mana -= cost
                }
              }
            }
          }
        })

        const stillAlive = prev.alivePlayers.filter((pId) => {
          if (newPlayers[pId].hp <= 0) {
            const conqueror = prev.alivePlayers.find((p) => p !== pId && newPlayers[p].isAlive)
            if (conqueror) conquestTerritory(pId, conqueror, newGrid)
            newPlayers[pId].isAlive = false
            return false
          }
          return true
        })

        if (stillAlive.length <= 1 && prev.alivePlayers.length > 1) {
          return { ...prev, phase: "result", winner: stillAlive.length === 1 ? stillAlive[0] : "tie" }
        }

        return {
          ...prev,
          grid: newGrid,
          players: newPlayers,
          projectiles: newProjectiles,
          damageNumbers: newDamageNumbers,
          explosions: newExplosions,
          alivePlayers: stillAlive,
        }
      })
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
    gameLoopRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
    }
  }, [gameState.phase, gameState.isPaused, getNextMovePosition])

  // --- USER ACTIONS ---
  const deployCard = (x: number, y: number) => {
    if (!gameState.selectedCard || gameState.phase === "menu" || gameState.phase === "result") return
    const card = gameState.selectedCard,
      cost = getCardCost(card)
    if (gameState.grid[y][x].owner !== "player1" || gameState.players.player1.mana < cost) return
    setGameState((prev) => {
      const newGrid = prev.grid.map((r) => r.map((t) => ({ ...t, units: [...t.units] })))
      const newPlayers = { ...prev.players }
      if (UNITS[card as keyof typeof UNITS]) {
        const stats = UNITS[card as keyof typeof UNITS]
        newGrid[y][x].units.push({
          id: `p1-${Date.now()}`,
          type: card as keyof typeof UNITS,
          owner: "player1",
          x,
          y,
          hp: stats.hp,
          maxHp: stats.hp,
          cooldown: 0,
          frozen: 0,
          healCooldown: 0,
          moveCooldown: 0,
          isMoving: false,
          isSelected: false,
        })
      } else if (BUILDINGS[card as keyof typeof BUILDINGS]) {
        if (newGrid[y][x].building) return prev
        const stats = BUILDINGS[card as keyof typeof BUILDINGS]
        newGrid[y][x].building = {
          id: `p1-bld-${Date.now()}`,
          type: card as keyof typeof BUILDINGS,
          owner: "player1",
          x,
          y,
          hp: stats.hp,
          maxHp: stats.hp,
          cooldown: 0,
        }
      }
      newPlayers.player1.mana -= cost
      return { ...prev, grid: newGrid, players: newPlayers }
    })
  }
  const handleTileClick = (x: number, y: number, event?: React.MouseEvent) => {
    if (event?.button === 2) {
      setGameState((p) => ({ ...p, selectedCard: null, selectedUnit: null, selectedBuilding: null }))
      return
    }
    const tile = gameState.grid[y][x]
    if (gameState.selectedUnit) {
      setGameState((p) => {
        const newGrid = p.grid.map((row) =>
          row.map((tile) => ({
            ...tile,
            units: tile.units.map((u) => (u.id === p.selectedUnit?.id ? { ...u, targetX: x, targetY: y } : u)),
          })),
        )
        return { ...p, grid: newGrid, selectedUnit: null }
      })
      return
    }
    if (tile.units.length > 0 && tile.units[0].owner === "player1") {
      setGameState((p) => ({ ...p, selectedUnit: p.selectedUnit?.id === tile.units[0].id ? null : tile.units[0] }))
    } else if (tile.building && tile.building.owner === "player1") {
      setGameState((p) => ({
        ...p,
        selectedBuilding: p.selectedBuilding?.id === tile.building?.id ? null : tile.building,
      }))
    } else {
      deployCard(x, y)
    }
  }

  // --- HELPERS & RENDERERS ---
  const getPlayerInfo = (pId: PlayerType) => {
    if (!pId) return null
    const positions = gameState.gameMode === "4player" ? PLAYER_POSITIONS_4P : PLAYER_POSITIONS_2P
    return positions[pId]
  }
  const getTileColor = (tile: Tile) => {
    const playerInfo = getPlayerInfo(tile.owner as PlayerType)
    if (playerInfo) return `${playerInfo.color}66`
    return "rgba(107, 114, 128, 0.15)"
  }
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  const getCardCost = (c: string) =>
    UNITS[c as keyof typeof UNITS]?.cost ||
    SPELLS[c as keyof typeof SPELLS]?.cost ||
    BUILDINGS[c as keyof typeof BUILDINGS]?.cost ||
    0
  const getCardIcon = (c: string) =>
    UNITS[c as keyof typeof UNITS]?.icon ||
    SPELLS[c as keyof typeof SPELLS]?.icon ||
    BUILDINGS[c as keyof typeof BUILDINGS]?.icon ||
    "❓"
  const getCardDescription = (c: string) =>
    UNITS[c as keyof typeof UNITS]?.description ||
    SPELLS[c as keyof typeof SPELLS]?.description ||
    BUILDINGS[c as keyof typeof BUILDINGS]?.description ||
    "Unknown"

  // --- RENDER LOGIC ---
  if (gameState.phase === "login")
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Card className="w-full max-w-sm bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-mono">GRID CONQUEST</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={gameState.loginForm.username}
                onChange={(e) =>
                  setGameState((p) => ({ ...p, loginForm: { ...p.loginForm, username: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={gameState.loginForm.email}
                onChange={(e) => setGameState((p) => ({ ...p, loginForm: { ...p.loginForm, email: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={gameState.loginForm.password}
                onChange={(e) =>
                  setGameState((p) => ({ ...p, loginForm: { ...p.loginForm, password: e.target.value } }))
                }
              />
            </div>
            <div className="flex space-x-2">
              <Button className="w-full" onClick={login}>
                Login
              </Button>
              <Button className="w-full" variant="secondary" onClick={createAccount}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )

  if (gameState.phase === "menu")
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-8 max-w-4xl w-full">
          <h1 className="text-4xl md:text-8xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
            GRID CONQUEST
          </h1>
          <p className="text-lg md:text-2xl text-gray-300">Welcome, {gameState.currentProfile?.username}</p>
          <div className="flex justify-center space-x-4 md:space-x-8">
            <Badge className="text-lg md:text-2xl px-4 md:px-6 py-2 md:py-3 bg-green-500/20 border-green-500">
              <Coins className="w-4 md:w-6 h-4 md:h-6 mr-2" />
              Credits: {gameState.currentProfile?.credits}
            </Badge>
            <Badge className="text-lg md:text-2xl px-4 md:px-6 py-2 md:py-3 bg-purple-500/20 border-purple-500">
              <Users className="w-4 md:w-6 h-4 md:h-6 mr-2" />
              Online: {Math.floor(Math.random() * 2000) + 3000}
            </Badge>
          </div>
          <Card className="p-6 md:p-8 bg-gray-800/50 border-gray-600">
            <h3 className="text-2xl md:text-3xl font-bold mb-6 text-yellow-400">CHOOSE YOUR BATTLE</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button onClick={() => createLobby(gameState.gameMode, false, 0)} className="w-full text-lg py-6 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 font-bold flex-col h-auto">
                    <Bot className="w-8 h-8 mb-2" />
                    Play vs. AI (Free)
                </Button>
                <Button onClick={() => createLobby(gameState.gameMode, true, gameState.wager)} className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 font-bold flex-col h-auto">
                    <Swords className="w-8 h-8 mb-2" />
                    Create Private Lobby
                </Button>
                <div className="space-y-2">
                     <Input
                        id="lobby-code"
                        placeholder="LOBBY CODE"
                        className="bg-gray-900 text-center h-12 text-lg"
                        value={gameState.joinLobbyCode}
                        onChange={(e) => setGameState((p) => ({ ...p, joinLobbyCode: e.target.value.toUpperCase() }))}
                      />
                    <Button onClick={joinLobby} className="w-full text-lg py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 font-bold">
                        <UserPlus className="w-5 h-5 mr-2" />
                        Join Lobby
                    </Button>
                </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Label className="text-lg font-semibold">Game Mode:</Label>
                <Button onClick={() => setGameState(p => ({...p, gameMode: '2player'}))} variant={gameState.gameMode === '2player' ? 'secondary' : 'outline'}>2 Players</Button>
                <Button onClick={() => setGameState(p => ({...p, gameMode: '4player'}))} variant={gameState.gameMode === '4player' ? 'secondary' : 'outline'}>4 Players</Button>
              </div>

              <div>
                <Label className="text-lg font-semibold mb-3 block">Entry Fee (for Private Lobbies):</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => setGameState((p) => ({ ...p, wager: amount }))}
                      variant={gameState.wager === amount ? "secondary" : "outline"}
                      className="text-sm md:text-lg py-2 md:py-3"
                      disabled={gameState.currentProfile!.credits < amount}
                    >
                      {amount} Credits
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Button variant="destructive" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>
    )

  if (gameState.phase === "lobby")
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-mono">GAME LOBBY</CardTitle>
            <div className="text-center text-gray-400">
              Code: <Badge>{gameState.currentLobby?.code}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("grid gap-4", gameState.currentLobby?.game_mode === "4player" ? "grid-cols-2" : "grid-cols-1")}>
              {gameState.currentLobby?.players.map((player) => (
                <Card key={player.slot} className="p-4 bg-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: player.color }}></div>
                    <span className="font-bold">{player.username}</span>
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="destructive" onClick={leaveLobby}>
                Leave
              </Button>
              {gameState.currentUser?.id === gameState.currentLobby?.host_id && (
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => startGame(gameState.currentLobby!)}>
                    START GAME
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )

  if (gameState.phase === "result") {
    const isWinner = gameState.winner === "player1"
    const wager = gameState.currentLobby?.wager || 0
    const winnings = isWinner ? Math.floor(wager * 1.8) : 0
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
              <div className="text-center space-y-2">
                <p className="text-2xl md:text-3xl font-bold text-green-400">
                  {wager > 0 ? (isWinner
                    ? `+${winnings} Credits Won!`
                    : gameState.winner !== "tie"
                      ? `-${wager} Credits Lost`
                      : "No credits changed.") : "Good game!"}
                </p>
              </div>
            </div>
          </Card>
          <Button
            onClick={() => {
                if (wager > 0) {
                    const creditChange = isWinner ? winnings : gameState.winner === "tie" ? 0 : -wager
                    updateProfile({
                        credits: gameState.currentProfile!.credits + creditChange,
                        wins: gameState.currentProfile!.wins + (isWinner ? 1 : 0),
                        losses: gameState.currentProfile!.losses + (!isWinner && gameState.winner !== "tie" ? 1 : 0),
                    })
                }
              setGameState((p) => ({ ...p, phase: "menu", currentLobby: null }))
            }}
            className="text-lg md:text-2xl px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-500 to-purple-500 font-bold"
          >
            BATTLE AGAIN
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden flex">
      <div className="w-2/3 h-full flex flex-col">
        <div className="flex-shrink-0 p-3 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
          <div className="text-center mb-2">
            <h2 className={`text-2xl font-bold ${gameState.phase === "prep" ? "text-blue-400" : "text-red-400"}`}>
              {gameState.phase === "prep" ? "🏗️ PREPARATION" : "⚔️ BATTLE"}
            </h2>
            <Badge className="text-lg px-4 py-2 bg-yellow-600 mt-1">
              <Timer className="w-4 h-4 mr-2" />
              {formatTime(gameState.phaseTime)}
            </Badge>
          </div>
          <div className={cn("grid gap-2 text-sm", gameState.gameMode === "4player" ? "grid-cols-4" : "grid-cols-2")}>
            {Object.values(gameState.players).map((playerState) => {
              const pId = Object.keys(gameState.players).find(
                (key) => gameState.players[key as PlayerType] === playerState,
              ) as PlayerType
              const playerInfo = getPlayerInfo(pId)
              if (!playerInfo || !playerState.isAlive) return null
              return (
                <div key={pId} className={`flex items-center space-x-1 ${!playerState.isAlive ? "opacity-50" : ""}`}>
                  <div
                    className="w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: playerInfo?.color }}
                  >
                    <span className="text-xs">{playerInfo?.icon}</span>
                  </div>
                  <div className="text-xs">
                    <div className="font-bold">{playerState.username}</div>
                    <div>HP: {Math.max(0, playerState.hp)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex-1 flex justify-center items-center p-4">
          <div
            className="grid gap-0 border-4 border-gray-600 bg-gray-800 rounded-lg relative shadow-2xl"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              width: "min(90%, 700px)",
              height: "min(90%, 700px)",
              aspectRatio: "1/1",
            }}
          >
            {gameState.grid.map((row, y) =>
              row.map((tile, x) => (
                <div
                  key={`${x}-${y}`}
                  className="border border-gray-600/50 cursor-pointer transition-all duration-150 flex items-center justify-center relative hover:brightness-125"
                  style={{ backgroundColor: getTileColor(tile) }}
                  onClick={(e) => handleTileClick(x, y, e)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleTileClick(x, y, e)
                  }}
                >
                  {tile.building && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div
                        className="absolute inset-0 rounded opacity-50"
                        style={{
                          backgroundColor: getPlayerInfo(tile.building.owner)?.color || "#666",
                          border: `1px solid ${getPlayerInfo(tile.building.owner)?.color || "#666"}`,
                        }}
                      />
                      <span
                        className="text-2xl font-bold relative z-10"
                        style={{ textShadow: "1px 1px 2px #000", color: "white" }}
                      >
                        {BUILDINGS[tile.building.type].icon}
                      </span>
                      <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded font-bold">
                        {tile.building.hp}
                      </div>
                    </div>
                  )}
                  {tile.units.length > 0 && (
                    <div className="absolute inset-0 flex flex-wrap items-center justify-center z-20 pointer-events-none">
                      {tile.units.slice(0, 4).map((unit) => (
                        <div key={unit.id} className="relative">
                          {unit.id === gameState.selectedUnit?.id && (
                            <div className="absolute -inset-1 rounded-full ring-2 ring-yellow-400 animate-pulse" />
                          )}
                          <div
                            className="absolute inset-0 rounded-full opacity-60 -m-0.5"
                            style={{
                              backgroundColor: getPlayerInfo(unit.owner)?.color || "#666",
                              border: `1px solid ${getPlayerInfo(unit.owner)?.color || "#666"}`,
                            }}
                          />
                          <span
                            className="text-lg font-bold relative z-10 text-white"
                            style={{
                              transform: `scale(${UNITS[unit.type].size * 0.8})`,
                              textShadow: "1px 1px 2px #000",
                            }}
                          >
                            {UNITS[unit.type].icon}
                          </span>
                          {unit.hp < unit.maxHp && (
                            <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-gray-800 rounded border border-black">
                              <div
                                className="h-full rounded"
                                style={{
                                  backgroundColor: getPlayerInfo(unit.owner)?.color || "#666",
                                  width: `${(unit.hp / unit.maxHp) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )),
            )}
            {gameState.projectiles.map((p) => (
              <div
                key={p.id}
                className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
                style={{
                  backgroundColor: p.color,
                  left: `${(p.currentX / GRID_SIZE) * 100}%`,
                  top: `${(p.currentY / GRID_SIZE) * 100}%`,
                  boxShadow: `0 0 8px ${p.color}`,
                }}
              />
            ))}
            {gameState.explosions.map((e) => (
              <div
                key={e.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  backgroundColor: e.color,
                  left: `${(e.x / GRID_SIZE) * 100}%`,
                  top: `${(e.y / GRID_SIZE) * 100}%`,
                  width: `${(e.radius / GRID_SIZE) * 200}%`,
                  height: `${(e.radius / GRID_SIZE) * 200}%`,
                  opacity: e.opacity,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
            {gameState.damageNumbers.map((d) => (
              <div
                key={d.id}
                className={`absolute pointer-events-none font-bold text-sm ${d.isHealing ? "text-green-400" : "text-red-400"}`}
                style={{
                  left: `${(d.x / GRID_SIZE) * 100}%`,
                  top: `${(d.y / GRID_SIZE) * 100}%`,
                  opacity: d.opacity,
                  transform: `translateY(-${(1 - d.opacity) * 20}px)`,
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {d.isHealing ? "+" : "-"}
                {d.damage}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-1/3 h-full bg-gray-800/80 backdrop-blur-sm border-l border-gray-700 flex flex-col overflow-y-auto p-4 space-y-4">
        <div className="flex-shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-400">YOUR STATUS</h3>
              <Badge className="bg-green-600">
                <Zap className="w-3 h-3 mr-1" />
                {gameState.players.player1?.mana}/{MANA_MAX}
              </Badge>
            </div>
            <Progress value={(gameState.players.player1?.mana / MANA_MAX) * 100} className="h-3 bg-gray-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm">HP: {gameState.players.player1?.hp}/300</span>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setGameState((p) => ({ ...p, showRanges: !p.showRanges }))}
                  variant="outline"
                  size="sm"
                  className="px-2 py-1 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Ranges
                </Button>
                <Button
                  onClick={() => setGameState((p) => ({ ...p, isPaused: !p.isPaused }))}
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
        <Card className="p-4 bg-gray-900 border-gray-600 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">{gameState.phase === "prep" ? "🏗️ BUILD" : "⚔️ DEPLOY"}</h3>
            <div className="text-xs text-gray-400">Hold to place multiple</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {gameState.deck.map((card) => {
              const cost = getCardCost(card),
                canAfford = gameState.players.player1?.mana >= cost,
                isSelected = gameState.selectedCard === card
              return (
                <Button
                  key={card}
                  onMouseDown={() =>
                    setGameState((p) => ({ ...p, selectedCard: p.selectedCard === card ? null : card }))
                  }
                  disabled={!canAfford}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "flex flex-col items-center p-2 h-20 text-sm hover:scale-105 transition-transform",
                    !canAfford && "opacity-50",
                    isSelected && "ring-2 ring-yellow-400 bg-yellow-600",
                  )}
                >
                  <span className="text-lg mb-1">{getCardIcon(card)}</span>
                  <span className="capitalize font-bold text-xs truncate w-full text-center">{card}</span>
                  <Badge className="text-xs px-1 py-0.5 bg-purple-500 mt-1">{cost} ⚡</Badge>
                </Button>
              )
            })}
          </div>
          <div className="space-y-3 flex-1">
            {gameState.selectedCard && (
              <div className="bg-yellow-900/50 rounded p-3 text-sm border border-yellow-600">
                <p className="text-yellow-400 font-bold">Selected: {gameState.selectedCard}</p>
                <p className="text-gray-300 text-xs mt-1">{getCardDescription(gameState.selectedCard)}</p>
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
          </div>
        </Card>
      </div>
    </div>
  )
}
