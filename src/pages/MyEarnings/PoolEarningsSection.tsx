import { ChainId, WETH } from '@kyberswap/ks-sdk-core'
import { t } from '@lingui/macro'
import { useMemo } from 'react'
import { useMedia } from 'react-use'
import { Box, Flex } from 'rebass'
import { HistoricalSingleData } from 'services/earning/types'
import styled from 'styled-components'

import { useGetNativeTokenLogo } from 'components/CurrencyLogo'
import { NativeCurrencies } from 'constants/tokens'
import useTheme from 'hooks/useTheme'
import { calculateEarningStatsTick, getToday } from 'pages/MyEarnings/utils'
import { useAppSelector } from 'state/hooks'
import { MEDIA_WIDTHS } from 'theme'
import { EarningStatsTick, EarningsBreakdown } from 'types/myEarnings'
import { isAddress } from 'utils'

import OriginalEarningsBreakdownPanel from './EarningsBreakdownPanel'
import OriginalMyEarningsOverTimePanel from './MyEarningsOverTimePanel'

const VerticalSeparator = () => {
  const theme = useTheme()
  return (
    <Box
      sx={{
        flex: '0 0 1px',
        alignSelf: 'stretch',
        padding: '24px 0',
        width: '1px',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          background: theme.border,
          opacity: 0.5,
        }}
      />
    </Box>
  )
}

const HorizontalSeparator = () => {
  const theme = useTheme()
  return (
    <Box
      sx={{
        flex: '0 0 1px',
        alignSelf: 'stretch',
        width: '100%',
        borderBottom: '1px solid transparent',
        borderBottomColor: theme.border,
      }}
    />
  )
}

const EarningsBreakdownPanel = styled(OriginalEarningsBreakdownPanel)`
  border: none;
  background: unset;

  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    padding: 0;
    width: 100%;
    flex: 0 0 auto;
  `}
`

const MyEarningsOverTimePanel = styled(OriginalMyEarningsOverTimePanel)`
  border: none;
  background: unset;

  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    border-radius: 0;
    padding: 0;
    flex: 0 0 420px;
  `}
`

type Props = {
  chainId: ChainId
  historicalEarning: HistoricalSingleData[]
}
const PoolEarningsSection: React.FC<Props> = ({ historicalEarning, chainId }) => {
  const theme = useTheme()
  const upToExtraSmall = useMedia(`(max-width: ${MEDIA_WIDTHS.upToExtraSmall}px)`)
  const tokensByChainId = useAppSelector(state => state.lists.mapWhitelistTokens)
  const nativeLogo = useGetNativeTokenLogo(chainId)

  const earningBreakdown: EarningsBreakdown | undefined = useMemo(() => {
    const data = historicalEarning
    const today = getToday()

    const latestData =
      data?.[0]?.day === today
        ? data?.[0].total
            ?.filter(tokenData => {
              const tokenAddress = isAddress(chainId, tokenData.token)
              if (!tokenAddress) {
                return false
              }

              const currency = tokensByChainId[chainId][tokenAddress]
              return !!currency
            })
            .map(tokenData => {
              const tokenAddress = isAddress(chainId, tokenData.token)
              const currency = tokensByChainId[chainId][String(tokenAddress)]
              const isNative = currency.isNative || tokenAddress === WETH[chainId].address
              const symbol = (isNative ? NativeCurrencies[chainId].symbol : currency.symbol) || 'NO SYMBOL'
              const logoUrl = (isNative ? nativeLogo : currency.logoURI) || ''

              return {
                address: tokenAddress,
                logoUrl,
                symbol,
                amountUSD: Number(tokenData.amountUSD),
                chainId,
              }
            }) || []
        : []
    latestData.sort((data1, data2) => data2.amountUSD - data1.amountUSD)

    const totalValue = latestData.reduce((sum, { amountUSD }) => {
      return sum + amountUSD
    }, 0)

    const totalValueOfOthers = latestData.slice(9).reduce((acc, data) => acc + data.amountUSD, 0)

    const isAllZero = latestData.every(data => data.amountUSD === 0)

    const visibleItems = latestData.length <= 10 ? latestData.length : 10

    const breakdowns: EarningsBreakdown['breakdowns'] =
      latestData.length <= 10
        ? latestData.map(data => ({
            logoUrl: data.logoUrl,
            symbol: data.symbol,
            value: String(data.amountUSD),
            percent: isAllZero ? (1 / visibleItems) * 100 : (data.amountUSD / totalValue) * 100,
          }))
        : [
            ...latestData.slice(0, 9).map(data => ({
              logoUrl: data.logoUrl,
              symbol: data.symbol,
              value: String(data.amountUSD),
              percent: isAllZero ? 10 : (data.amountUSD / totalValue) * 100,
            })),
            {
              symbol: t`Others`,
              value: String(totalValueOfOthers),
              percent: isAllZero ? 10 : (totalValueOfOthers / totalValue) * 100,
            },
          ]

    return {
      totalValue,
      breakdowns,
    }
  }, [chainId, historicalEarning, tokensByChainId, nativeLogo])

  // format pool value
  const ticks: EarningStatsTick[] | undefined = useMemo(() => {
    return calculateEarningStatsTick({ data: historicalEarning, chainId, tokensByChainId, nativeLogo })
  }, [chainId, historicalEarning, tokensByChainId, nativeLogo])

  if (upToExtraSmall) {
    return (
      <Flex
        sx={{
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <EarningsBreakdownPanel isLoading={false} data={earningBreakdown} />
        <HorizontalSeparator />
        <MyEarningsOverTimePanel isLoading={false} ticks={ticks} isContainerSmall />
      </Flex>
    )
  }

  return (
    <Flex
      sx={{
        background: theme.buttonBlack,
        borderRadius: '20px',
      }}
    >
      <EarningsBreakdownPanel isLoading={false} data={earningBreakdown} />
      <VerticalSeparator />
      <MyEarningsOverTimePanel isLoading={false} ticks={ticks} />
    </Flex>
  )
}

export default PoolEarningsSection
