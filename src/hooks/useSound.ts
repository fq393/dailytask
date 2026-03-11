import { useRef } from 'react'

// Simple beep sound using Web Audio API
export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  const playSound = (type: 'success' | 'pop' = 'success') => {
    // Create audio context if it doesn't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }

    const ctx = audioContextRef.current
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    if (type === 'success') {
      // Play a pleasant "ding" sound
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2) // G5
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } else if (type === 'pop') {
      // Play a short "pop" sound
      oscillator.frequency.setValueAtTime(440, ctx.currentTime)
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.1)
    }
  }

  return { playSound }
}
