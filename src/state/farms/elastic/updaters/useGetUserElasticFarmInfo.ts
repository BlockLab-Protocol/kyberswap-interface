import { gql, useLazyQuery } from '@apollo/client'
import { defaultAbiCoder } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'
import { Currency, CurrencyAmount } from '@kyberswap/ks-sdk-core'
import { BigNumber } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { useCallback, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'

import NFTPositionManagerABI from 'constants/abis/v2/ProAmmNFTPositionManager.json'
import ELASTIC_FARM_ABI from 'constants/abis/v2/farm.json'
import { NETWORKS_INFO, isEVM } from 'constants/networks'
import { useActiveWeb3React } from 'hooks'
import { useMulticallContract } from 'hooks/useContract'
import { useKyberSwapConfig } from 'state/application/hooks'
import { useAppSelector } from 'state/hooks'
import { usePoolBlocks } from 'state/prommPools/hooks'

import { setLoadingUserInfo, setPoolFeeData, setUserFarmInfo } from '..'
import { NFTPosition, UserFarmInfo } from '../types'

const farmInterface = new Interface(ELASTIC_FARM_ABI)
const positionManagerInterface = new Interface(NFTPositionManagerABI.abi)

const POOL_FEE_HISTORY = gql`
  query poolFees($block: Int!, $poolIds: [String]!) {
    pools(block: { number: $block }, where: { id_in: $poolIds }) {
      id
      feesUSD
    }
  }
`

const defaultChainData = {
  loading: false,
  farms: null,
  poolFeeLast24h: {},
}
const useGetUserFarmingInfo = (interval?: boolean) => {
  const dispatch = useDispatch()
  const { chainId, account } = useActiveWeb3React()
  const multicallContract = useMulticallContract()
  const { elasticClient } = useKyberSwapConfig()

  const elasticFarm = useAppSelector(state => state.elasticFarm[chainId || 1]) || defaultChainData

  const getUserFarmInfo = useCallback(async () => {
    const farmAddresses = elasticFarm.farms?.map(farm => farm.id)

    if (isEVM(chainId) && account && farmAddresses?.length && multicallContract) {
      dispatch(setLoadingUserInfo({ loading: true, chainId }))
      // get userDepositedNFTs
      const userDepositedNFTsFragment = farmInterface.getFunction('getDepositedNFTs')
      const callData = farmInterface.encodeFunctionData(userDepositedNFTsFragment, [account])

      const chunks = farmAddresses.map(address => ({
        target: address,
        callData,
      }))

      const multicallRes = await multicallContract.callStatic.tryBlockAndAggregate(false, chunks)
      const returnData = multicallRes.returnData
      // listNFTs by contract
      const nftResults: Array<Array<BigNumber>> = returnData.map((data: [boolean, string]) => {
        try {
          return data[0] ? farmInterface.decodeFunctionResult(userDepositedNFTsFragment, data[1]).listNFTs : []
        } catch {
          return []
        }
      })

      /*
       * GET DETAIL NFT
       */
      const allNFTs = nftResults.flat()
      const nftDetailFragment = positionManagerInterface.getFunction('positions')
      const nftDetailChunks = allNFTs.map(id => ({
        target: NETWORKS_INFO[chainId].elastic.nonfungiblePositionManager,
        callData: positionManagerInterface.encodeFunctionData(nftDetailFragment, [id]),
      }))

      const detailNFTMultiCallData = (await multicallContract.callStatic.tryBlockAndAggregate(false, nftDetailChunks))
        .returnData

      const nftDetailResult = detailNFTMultiCallData.map((data: [boolean, string]) =>
        data[0] ? positionManagerInterface.decodeFunctionResult(nftDetailFragment, data[1]) : null,
      )

      type NFT_INFO = {
        [id: string]: {
          poolAddress: string
          liquidity: BigNumber
          tickLower: BigNumber
          tickUpper: BigNumber
        }
      }
      const nftInfos = nftDetailResult.reduce((acc: NFT_INFO, item: any, index: number) => {
        if (!item) return acc
        return {
          ...acc,
          [allNFTs[index].toString()]: {
            poolAddress: getCreate2Address(
              NETWORKS_INFO[chainId].elastic.coreFactory,
              keccak256(
                ['bytes'],
                [
                  defaultAbiCoder.encode(
                    ['address', 'address', 'uint24'],
                    [item.info.token0, item.info.token1, item.info.fee],
                  ),
                ],
              ),
              NETWORKS_INFO[chainId].elastic.initCodeHash,
            ),
            liquidity: item.pos.liquidity,
            tickLower: item.pos.tickLower,
            tickUpper: item.pos.tickUpper,
          },
        }
      }, {} as NFT_INFO)

      const promises =
        elasticFarm.farms?.map(async (farm, index) => {
          const nfts = nftResults[index]

          const depositedPositions: NFTPosition[] = []
          const joinedPositions: { [pid: string]: NFTPosition[] } = {}
          const rewardPendings: { [pid: string]: CurrencyAmount<Currency>[] } = {}
          const rewardByNft: { [pid_nftId: string]: CurrencyAmount<Currency>[] } = {}

          const userInfoParams: Array<[BigNumber, string]> = []
          nfts.forEach(id => {
            const matchedPools = farm.pools.filter(
              p => p.poolAddress.toLowerCase() === nftInfos[id.toString()]?.poolAddress.toLowerCase(),
            )

            matchedPools.forEach(pool => {
              userInfoParams.push([id, pool.pid])
            })

            if (matchedPools?.[0]) {
              const pos = new NFTPosition({
                nftId: id,
                pool: matchedPools[0].pool,
                liquidity: nftInfos[id.toString()].liquidity,
                tickLower: nftInfos[id.toString()].tickLower,
                tickUpper: nftInfos[id.toString()].tickUpper,
              })
              depositedPositions.push(pos)
            }
          })

          const getUserInfoFragment = farmInterface.getFunction('getUserInfo')
          if (nfts.length) {
            const returnData = (
              await multicallContract.callStatic.tryBlockAndAggregate(
                false,
                userInfoParams.map(params => {
                  return {
                    target: farm.id,
                    callData: farmInterface.encodeFunctionData(getUserInfoFragment, params),
                  }
                }),
              )
            ).returnData.map((item: [boolean, string]) => item[1])

            const result = returnData.map((data: string) => {
              try {
                return farmInterface.decodeFunctionResult(getUserInfoFragment, data)
              } catch (e) {
                return e
              }
            })
            userInfoParams.forEach((param, index) => {
              const pid = param[1].toString()
              const nftId = param[0]
              if (!(result[index] instanceof Error)) {
                if (!joinedPositions[pid]) {
                  joinedPositions[pid] = []
                }

                const depositedPos = depositedPositions.find(pos => pos.nftId.eq(nftId))
                const farmingPool = farm.pools.find(p => p.pid === pid)

                if (depositedPos && farmingPool) {
                  const pos = new NFTPosition({
                    nftId,
                    liquidity: result[index].liquidity,
                    tickLower: depositedPos.tickLower,
                    tickUpper: depositedPos.tickUpper,
                    pool: depositedPos.pool,
                  })
                  joinedPositions[pid].push(pos)

                  const id = `${pid}_${nftId.toString()}`
                  if (!rewardByNft[id]) {
                    rewardByNft[id] = []
                  }
                  if (!rewardPendings[pid]) {
                    rewardPendings[pid] = []
                  }
                  farmingPool.rewardTokens.forEach((currency, i) => {
                    const amount = CurrencyAmount.fromRawAmount(currency, result[index].rewardPending[i])
                    rewardByNft[id][i] = amount

                    if (!rewardPendings[pid][i]) {
                      rewardPendings[pid][i] = amount
                    } else {
                      rewardPendings[pid][i] = rewardPendings[pid][i].add(amount)
                    }
                  })
                }
              }
            })
          }
          return {
            depositedPositions,
            joinedPositions,
            rewardPendings,
            rewardByNft,
          }
        }) || []

      const res = await Promise.all(promises)

      const userInfo = elasticFarm.farms?.reduce((userInfo, farm, index) => {
        return {
          ...userInfo,
          [farm.id]: res[index],
        }
      }, {} as UserFarmInfo)

      dispatch(setLoadingUserInfo({ chainId, loading: false }))
      if (userInfo) dispatch(setUserFarmInfo({ chainId, userInfo }))
    }
  }, [elasticFarm.farms, chainId, account, multicallContract, dispatch])

  const getUserFarmInfoRef = useRef(getUserFarmInfo)
  getUserFarmInfoRef.current = getUserFarmInfo

  useEffect(() => {
    getUserFarmInfoRef.current()

    const i = interval
      ? setInterval(() => {
          getUserFarmInfoRef.current()
        }, 10_000)
      : undefined
    return () => {
      i && clearInterval(i)
    }
  }, [interval, account, elasticFarm.farms?.length])

  const { blockLast24h } = usePoolBlocks()
  const [getPoolInfo, { data: poolFeeData }] = useLazyQuery(POOL_FEE_HISTORY, {
    client: elasticClient,
    fetchPolicy: 'network-only',
  })

  useEffect(() => {
    if (poolFeeData?.pools?.length) {
      const poolFeeMap = poolFeeData.pools.reduce(
        (acc: { [id: string]: number }, cur: { id: string; feesUSD: string }) => {
          return {
            ...acc,
            [cur.id]: Number(cur.feesUSD),
          }
        },
        {} as { [id: string]: number },
      )

      dispatch(setPoolFeeData({ chainId, data: poolFeeMap }))
    }
  }, [poolFeeData, chainId, dispatch])

  useEffect(() => {
    if (!isEVM(chainId)) return
    const poolIds = elasticFarm.farms?.map(item => item.pools.map(p => p.poolAddress.toLowerCase())).flat()

    if (blockLast24h && poolIds?.length) {
      getPoolInfo({
        variables: {
          block: Number(blockLast24h),
          poolIds,
        },
      })
    }
  }, [elasticFarm.farms, blockLast24h, getPoolInfo, chainId])
}

export default useGetUserFarmingInfo
