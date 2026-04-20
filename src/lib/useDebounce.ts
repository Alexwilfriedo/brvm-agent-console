import { useEffect, useState } from 'react'

/**
 * Retourne une version debouncée de la valeur (utile pour la recherche).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(h)
  }, [value, delayMs])
  return debounced
}
