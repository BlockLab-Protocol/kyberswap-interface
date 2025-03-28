import { ApolloClient, NormalizedCacheObject, useQuery } from '@apollo/client'
import { ChainId, WETH } from '@kyberswap/ks-sdk-core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
  POOLS_BULK_FROM_LIST,
  POOLS_BULK_WITH_PAGINATION,
  POOLS_HISTORICAL_BULK_FROM_LIST,
  POOLS_HISTORICAL_BULK_WITH_PAGINATION,
  POOL_COUNT,
  POOL_DATA,
  USER_POSITIONS,
} from 'apollo/queries'
import { ONLY_DYNAMIC_FEE_CHAINS } from 'constants/networks'
import { useActiveWeb3React } from 'hooks'
import { useETHPrice, useKyberSwapConfig } from 'state/application/hooks'
import { AppState } from 'state/index'
import { get24hValue, getBlocksFromTimestamps, getPercentChange, getTimestampsForChanges } from 'utils'

import { setError, setLoading, setSharedPoolId, updatePools } from './actions'

export interface SubgraphPoolData {
  id: string
  amp: string
  fee: number
  reserve0: string
  reserve1: string
  vReserve0: string
  vReserve1: string
  totalSupply: string
  reserveUSD: string
  volumeUSD: string
  feeUSD: string
  oneDayVolumeUSD: string
  oneDayVolumeUntracked: string
  oneDayFeeUSD: string
  oneDayFeeUntracked: string
  token0: {
    id: string
    symbol: string
    name: string
    decimals: string
    totalLiquidity: string
    derivedETH: string
  }
  token1: {
    id: string
    symbol: string
    name: string
    decimals: string
    totalLiquidity: string
    derivedETH: string
  }
}

export interface UserLiquidityPosition {
  id: string
  liquidityTokenBalance: string
  pool: {
    id: string
    token0: {
      id: string
    }
    token1: {
      id: string
    }
    reserveUSD: string
    totalSupply: string
  }
}

interface UserLiquidityPositionResult {
  loading: boolean
  error: any
  data: {
    liquidityPositions: UserLiquidityPosition[]
  }
}

/**
 * Get my liquidity for all pools
 *
 * @param user string
 */
export function useUserLiquidityPositions(chainId?: ChainId): UserLiquidityPositionResult {
  const { isEVM, account } = useActiveWeb3React()
  const { classicClient } = useKyberSwapConfig(chainId)
  const { loading, error, data } = useQuery(USER_POSITIONS, {
    client: classicClient,
    variables: {
      user: account?.toLowerCase(),
    },
    fetchPolicy: 'no-cache',
    skip: !isEVM || !account,
  })

  return useMemo(() => ({ loading, error, data }), [data, error, loading])
}

function parseData(data: any, oneDayData: any, ethPrice: any, oneDayBlock: any, chainId?: ChainId): SubgraphPoolData {
  // get volume changes
  const oneDayVolumeUSD = get24hValue(data?.volumeUSD, oneDayData?.volumeUSD)
  const oneDayFeeUSD = get24hValue(data?.feeUSD, oneDayData?.feeUSD)
  const oneDayVolumeUntracked = get24hValue(data?.untrackedVolumeUSD, oneDayData?.untrackedVolumeUSD)
  const oneDayFeeUntracked = get24hValue(data?.untrackedFeeUSD, oneDayData?.untrackedFeeUSD)

  // set volume properties
  data.oneDayVolumeUSD = oneDayVolumeUSD
  data.oneDayFeeUSD = oneDayFeeUSD
  data.oneDayFeeUntracked = oneDayFeeUntracked
  data.oneDayVolumeUntracked = oneDayVolumeUntracked

  // set liquiditry properties
  data.trackedReserveUSD = data.trackedReserveETH * ethPrice
  data.liquidityChangeUSD = getPercentChange(data.reserveUSD, oneDayData?.reserveUSD)

  // format if pool hasnt existed for a day or a week
  if (!oneDayData && data) {
    if (data.createdAtBlockNumber > oneDayBlock) data.oneDayVolumeUSD = parseFloat(data.volumeUSD)
    else data.oneDayVolumeUSD = 0
  }

  if (chainId && WETH[chainId].address.toLowerCase() === data?.token0?.id) {
    data.token0 = { ...data.token0, name: WETH[chainId].name, symbol: WETH[chainId].symbol }
  }
  if (chainId && WETH[chainId].address.toLowerCase() === data?.token1?.id) {
    data.token1 = { ...data.token1, name: WETH[chainId].name, symbol: WETH[chainId].symbol }
  }

  return data
}

export async function getBulkPoolDataFromPoolList(
  isEnableBlockService: boolean,
  poolList: string[],
  apolloClient: ApolloClient<NormalizedCacheObject>,
  blockClient: ApolloClient<NormalizedCacheObject>,
  chainId: ChainId,
  ethPrice: string | undefined,
  signal: AbortSignal,
): Promise<any> {
  try {
    const current = await apolloClient.query({
      query: POOLS_BULK_FROM_LIST(poolList, chainId && !ONLY_DYNAMIC_FEE_CHAINS.includes(chainId)),
      fetchPolicy: 'network-only',
    })
    let poolData
    const [t1] = getTimestampsForChanges()
    const blocks = await getBlocksFromTimestamps(isEnableBlockService, blockClient, [t1], chainId, signal)
    if (!blocks.length) {
      return current.data.pools
    } else {
      const [{ number: b1 }] = blocks

      const [oneDayResult] = await Promise.all(
        [b1].map(async block => {
          const result = apolloClient.query({
            query: POOLS_HISTORICAL_BULK_FROM_LIST(
              block,
              poolList,
              chainId && !ONLY_DYNAMIC_FEE_CHAINS.includes(chainId),
            ),
            fetchPolicy: 'network-only',
          })
          return result
        }),
      )

      const oneDayData = oneDayResult?.data?.pools.reduce((obj: any, cur: any) => {
        return { ...obj, [cur.id]: cur }
      }, {})

      poolData = await Promise.all(
        current &&
          current.data.pools.map(async (pool: any) => {
            let data = { ...pool }
            let oneDayHistory = oneDayData?.[pool.id]
            if (!oneDayHistory) {
              const newData = await apolloClient.query({
                query: POOL_DATA(pool.id, b1, !ONLY_DYNAMIC_FEE_CHAINS.includes(chainId)),
                fetchPolicy: 'network-only',
              })
              oneDayHistory = newData.data.pools[0]
            }

            data = parseData(data, oneDayHistory, ethPrice, b1, chainId)

            return data
          }),
      )
    }

    return poolData
  } catch (e) {
    console.error(e)
    throw e
  }
}

export async function getBulkPoolDataWithPagination(
  isEnableBlockService: boolean,
  first: number,
  skip: number,
  apolloClient: ApolloClient<NormalizedCacheObject>,
  blockClient: ApolloClient<NormalizedCacheObject>,
  ethPrice: string,
  chainId: ChainId,
  signal: AbortSignal,
): Promise<any> {
  try {
    const [t1] = getTimestampsForChanges()
    const blocks = await getBlocksFromTimestamps(isEnableBlockService, blockClient, [t1], chainId, signal)

    // In case we can't get the block one day ago then we set it to 0 which is fine
    // because our subgraph never syncs from block 0 => response is empty
    const [{ number: b1 }] = blocks.length ? blocks : [{ number: 0 }]
    const [oneDayResult, current] = await Promise.all(
      [b1]
        .map(async block => {
          const result = apolloClient
            .query({
              query: POOLS_HISTORICAL_BULK_WITH_PAGINATION(
                first,
                skip,
                block,
                chainId && !ONLY_DYNAMIC_FEE_CHAINS.includes(chainId),
              ),
              fetchPolicy: 'network-only',
            })
            .catch(err => {
              return err
            })
          return result
        })
        .concat(
          apolloClient.query({
            query: POOLS_BULK_WITH_PAGINATION(first, skip, chainId && !ONLY_DYNAMIC_FEE_CHAINS.includes(chainId)),
            fetchPolicy: 'network-only',
          }),
        ),
    )

    const oneDayData = oneDayResult?.data?.pools.reduce((obj: any, cur: any) => {
      return { ...obj, [cur.id]: cur }
    }, {})

    const poolData = await Promise.all(
      current &&
        current.data.pools.map(async (pool: any) => {
          let data = { ...pool }
          const oneDayHistory = oneDayData?.[pool.id]
          // TODO nguyenhuudungz: If number of pools > 1000 then uncomment this.
          // if (!oneDayHistory) {
          //   const newData = await apolloClient.query({
          //     query: POOL_DATA(pool.id, b1),
          //     fetchPolicy: 'network-only'
          //   })
          //   oneDayHistory = newData.data.pools[0]
          // }

          data = parseData(data, oneDayHistory, ethPrice, b1, chainId)

          return data
        }),
    )

    return poolData
  } catch (e) {
    console.error(e)
    throw e
  }
}

export function useResetPools(chainId: ChainId) {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(updatePools({ pools: [] }))
    dispatch(setError(undefined))
  }, [chainId, dispatch])
}

function usePoolCountInSubgraph(): number {
  const [poolCount, setPoolCount] = useState(0)
  const { isEVM, networkInfo } = useActiveWeb3React()
  const { classicClient } = useKyberSwapConfig()

  useEffect(() => {
    if (!isEVM) return
    const getPoolCount = async () => {
      const result = await classicClient.query({
        query: POOL_COUNT,
        fetchPolicy: 'network-only',
      })
      setPoolCount(
        result?.data.dmmFactories.reduce((count: number, factory: { poolCount: number }) => {
          return count + factory.poolCount
        }, 0) || 0,
      )
    }

    getPoolCount()
  }, [networkInfo, isEVM, classicClient])

  return poolCount
}

export function useAllPoolsData(): {
  loading: AppState['pools']['loading']
  error: AppState['pools']['error']
  data: AppState['pools']['pools']
} {
  const dispatch = useDispatch()
  const { chainId, isEVM, networkInfo } = useActiveWeb3React()

  const poolsData = useSelector((state: AppState) => state.pools.pools)
  const loading = useSelector((state: AppState) => state.pools.loading)
  const error = useSelector((state: AppState) => state.pools.error)

  const { currentPrice: ethPrice } = useETHPrice()
  const { classicClient, blockClient, isEnableBlockService } = useKyberSwapConfig()

  const poolCountSubgraph = usePoolCountInSubgraph()
  useEffect(() => {
    if (!isEVM) return
    const controller = new AbortController()

    const getPoolsData = async () => {
      try {
        if (poolCountSubgraph > 0 && poolsData.length === 0 && !error && ethPrice) {
          dispatch(setLoading(true))
          const ITEM_PER_CHUNK = Math.min(1000, poolCountSubgraph) // GraphNode can handle max 1000 records per query.
          const promises = []
          for (let i = 0, j = poolCountSubgraph; i < j; i += ITEM_PER_CHUNK) {
            promises.push(() =>
              getBulkPoolDataWithPagination(
                isEnableBlockService,
                ITEM_PER_CHUNK,
                i,
                classicClient,
                blockClient,
                ethPrice,
                chainId,
                controller.signal,
              ),
            )
          }
          const pools = (await Promise.all(promises.map(callback => callback()))).flat()
          if (controller.signal.aborted) return
          dispatch(updatePools({ pools }))
          dispatch(setLoading(false))
        }
      } catch (error) {
        if (controller.signal.aborted) return
        dispatch(setError(error as Error))
        dispatch(setLoading(false))
      }
    }

    getPoolsData()

    return () => controller.abort()
  }, [
    chainId,
    dispatch,
    error,
    ethPrice,
    poolCountSubgraph,
    poolsData.length,
    isEVM,
    networkInfo,
    classicClient,
    blockClient,
    isEnableBlockService,
  ])

  return useMemo(() => ({ loading, error, data: poolsData }), [error, loading, poolsData])
}

export function useSelectedPool() {
  return useSelector((state: AppState) => state.pools.selectedPool)
}

export function useSinglePoolData(
  poolAddress: string | undefined,
  ethPrice?: string,
): {
  loading: boolean
  error?: Error
  data?: SubgraphPoolData
} {
  const { chainId, isEVM, networkInfo } = useActiveWeb3React()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [poolData, setPoolData] = useState<SubgraphPoolData>()
  const { classicClient, blockClient, isEnableBlockService } = useKyberSwapConfig()

  useEffect(() => {
    if (!isEVM) return
    const controller = new AbortController()

    async function checkForPools() {
      setLoading(true)

      try {
        if (poolAddress && !error) {
          const pools = await getBulkPoolDataFromPoolList(
            isEnableBlockService,
            [poolAddress],
            classicClient,
            blockClient,
            chainId,
            ethPrice,
            controller.signal,
          )
          if (controller.signal.aborted) return
          if (pools.length > 0) {
            setPoolData(pools[0])
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setError(error as Error)
      }

      setLoading(false)
    }

    checkForPools()

    return () => controller.abort()
  }, [ethPrice, error, poolAddress, chainId, isEVM, networkInfo, classicClient, blockClient, isEnableBlockService])

  return { loading, error, data: poolData }
}

export function useSharedPoolIdManager(): [string | undefined, (newSharedPoolId: string | undefined) => void] {
  const dispatch = useDispatch()
  const sharedPoolId = useSelector((state: AppState) => state.pools.sharedPoolId)

  const onSetSharedPoolId = useCallback(
    (newSharedPoolId: string | undefined) => {
      dispatch(setSharedPoolId({ poolId: newSharedPoolId }))
    },
    [dispatch],
  )

  return useMemo(() => [sharedPoolId, onSetSharedPoolId], [onSetSharedPoolId, sharedPoolId])
}
