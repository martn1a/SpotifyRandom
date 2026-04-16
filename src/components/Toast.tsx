import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface ToastProps {
  message: string
  onClear: () => void
}

export default function Toast({ message, onClear }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClear, 3000)
    return () => clearTimeout(t)
  }, [onClear])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-card-raised border border-border rounded-full px-5 py-2.5 text-sm font-medium text-ink shadow-lg whitespace-nowrap"
    >
      {message}
    </motion.div>
  )
}
