import { useState, useEffect } from "react"
import { getMembership } from "../../core/misc"
import { useUserInfo } from "../../core/useSupabaseAuth"

interface UserTier {
  isPro: boolean
  tierLoading: boolean
}

export function useUserTier(): UserTier {
  const { user } = useUserInfo()
  const [isPro, setIsPro] = useState(false)
  const [tierLoading, setTierLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsPro(false)
      return
    }

    setTierLoading(true)
    getMembership()
      .then((data) => {
        setIsPro(data?.membership === "pro")
      })
      .catch(() => {
        setIsPro(false)
      })
      .finally(() => {
        setTierLoading(false)
      })
  }, [user])

  return { isPro, tierLoading }
}
