/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChainId } from '@kyberswap/ks-sdk-core'
import { Connection } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  KyberSwapConfig,
  KyberswapConfigurationResponse,
  KyberswapGlobalConfigurationResponse,
  useGetKyberswapGlobalConfigurationQuery,
  useLazyGetKyberswapConfigurationQuery,
} from 'services/ksSetting'

import { AGGREGATOR_API } from 'constants/env'
import { NETWORKS_INFO, SUPPORTED_NETWORKS, isEVM, isSolana } from 'constants/networks'
import ethereumInfo from 'constants/networks/ethereum'
import solanaInfo from 'constants/networks/solana'
import { AppJsonRpcProvider } from 'constants/providers'
import { AppState } from 'state'
import { createClient } from 'utils/client'

const cacheRPC: { [chainId in ChainId]?: { [rpc: string]: AppJsonRpcProvider } } = {}

const parseResponse = (
  responseData: KyberswapConfigurationResponse | undefined,
  defaultChainId: ChainId,
): KyberSwapConfig => {
  const data = responseData?.data?.config
  const rpc = data?.rpc || NETWORKS_INFO[defaultChainId].defaultRpcUrl

  if (!cacheRPC[defaultChainId]?.[rpc]) {
    if (!cacheRPC[defaultChainId]) cacheRPC[defaultChainId] = {}
    cacheRPC[defaultChainId]![rpc] = new AppJsonRpcProvider(rpc, defaultChainId)
  }
  const provider = cacheRPC[defaultChainId]![rpc]

  return {
    rpc,
    prochart: data?.prochart || false,
    isEnableBlockService: data?.isEnableBlockService || false,
    blockClient: isEVM(defaultChainId)
      ? createClient(data?.blockSubgraph || NETWORKS_INFO[defaultChainId].defaultBlockSubgraph)
      : createClient(ethereumInfo.defaultBlockSubgraph),
    classicClient: isEVM(defaultChainId)
      ? createClient(data?.classicSubgraph || NETWORKS_INFO[defaultChainId].classic.defaultSubgraph)
      : createClient(ethereumInfo.classic.defaultSubgraph),
    elasticClient: isEVM(defaultChainId)
      ? createClient(data?.elasticSubgraph || NETWORKS_INFO[defaultChainId].elastic.defaultSubgraph)
      : createClient(ethereumInfo.elastic.defaultSubgraph),
    readProvider: isEVM(defaultChainId) ? provider : undefined,
    connection: isSolana(defaultChainId)
      ? new Connection(data?.rpc || solanaInfo.defaultRpcUrl, { commitment: 'confirmed' })
      : undefined,
  }
}

type KyberswapGlobalConfig = {
  aggregatorDomain: string
  aggregatorAPI: string
  isEnableAuthenAggregator: boolean
}

const parseGlobalResponse = (
  responseData: KyberswapGlobalConfigurationResponse | undefined,
  chainId: ChainId,
): KyberswapGlobalConfig => {
  const data = responseData?.data?.config
  const aggregatorDomain = data?.aggregator ?? AGGREGATOR_API
  const isEnableAuthenAggregator = !!data?.isEnableAuthenAggregator
  return {
    aggregatorDomain,
    aggregatorAPI: `${aggregatorDomain}/${NETWORKS_INFO[chainId].aggregatorRoute}/route/encode`,
    isEnableAuthenAggregator,
  }
}
export const useLazyKyberswapConfig = (): ((customChainId?: ChainId) => Promise<KyberSwapConfig>) => {
  const storeChainId = useSelector<AppState, ChainId>(state => state.user.chainId) || ChainId.MAINNET // read directly from store instead of useActiveWeb3React to prevent circular loop
  const [getKyberswapConfiguration] = useLazyGetKyberswapConfigurationQuery()
  const fetchKyberswapConfig = useCallback(
    async (customChainId?: ChainId) => {
      const chainId = customChainId ?? storeChainId
      try {
        const { data } = await getKyberswapConfiguration(chainId)
        return parseResponse(data, chainId)
      } catch {
        return parseResponse(undefined, chainId)
      }
    },
    [getKyberswapConfiguration, storeChainId],
  )
  return fetchKyberswapConfig
}

export const useKyberswapGlobalConfig = () => {
  const chainId = useSelector<AppState, ChainId>(state => state.user.chainId) || ChainId.MAINNET // read directly from store instead of useActiveWeb3React to prevent circular loop
  const { data } = useGetKyberswapGlobalConfigurationQuery(undefined)
  const result = useMemo(() => parseGlobalResponse(data, chainId), [data, chainId])
  return result
}

export const useAllKyberswapConfig = (): {
  [chain in ChainId]: KyberSwapConfig
} => {
  const [allKyberswapConfig, setAllKyberswapConfig] = useState<
    | {
        [chain in ChainId]: KyberSwapConfig
      }
    | null
  >(null)
  const [getKyberswapConfiguration] = useLazyGetKyberswapConfigurationQuery()

  useEffect(() => {
    const run = async () => {
      const fetches = SUPPORTED_NETWORKS.map(async chainId => {
        try {
          const { data } = await getKyberswapConfiguration(chainId)
          return {
            chainId,
            result: parseResponse(data, chainId),
          }
        } catch {
          return {
            chainId,
            result: parseResponse(undefined, chainId),
          }
        }
      })
      const results = await Promise.all(fetches)
      setAllKyberswapConfig(
        results.reduce(
          (acc, cur) => {
            acc[cur.chainId] = cur.result
            return acc
          },
          {} as {
            [chainId in ChainId]: KyberSwapConfig
          },
        ),
      )
    }
    run()
  }, [getKyberswapConfiguration])

  const defaultConfig = useMemo(
    () =>
      SUPPORTED_NETWORKS.reduce(
        (acc, cur) => {
          acc[cur] = parseResponse(undefined, cur)
          return acc
        },
        {} as {
          [chainId in ChainId]: KyberSwapConfig
        },
      ),
    [],
  )

  return allKyberswapConfig ?? defaultConfig
}
