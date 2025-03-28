import { ChainId, Currency } from '@kyberswap/ks-sdk-core'
import { CSSProperties, useState } from 'react'
import { HelpCircle } from 'react-feather'
import { ImageProps } from 'rebass'

import { useGetNativeTokenLogo } from 'components/CurrencyLogo'
import { NETWORKS_INFO } from 'constants/networks'
import { WrappedTokenInfo } from 'state/lists/wrappedTokenInfo'
import { useIsDarkMode } from 'state/user/hooks'

const BAD_SRCS: { [tokenAddress: string]: true } = {}

interface LogoProps extends Pick<ImageProps, 'style' | 'alt' | 'className'> {
  srcs: string[]
}

/**
 * Renders an image by sequentially trying a list of URIs, and then eventually a fallback triangle alert
 */
export default function Logo({ srcs, alt, ...rest }: LogoProps) {
  const [, refresh] = useState<number>(0)

  const src: string | undefined = srcs.find(src => !BAD_SRCS[src])

  if (src) {
    return (
      <img
        {...rest}
        alt={alt}
        src={src}
        onError={() => {
          if (src) BAD_SRCS[src] = true
          refresh(i => i + 1)
        }}
      />
    )
  }

  return <HelpCircle {...rest} />
}

export function NetworkLogo({ chainId, style = {} }: { chainId: ChainId; style?: CSSProperties }) {
  const isDarkMode = useIsDarkMode()
  const { iconDark, icon } = NETWORKS_INFO[chainId]
  const iconSrc = isDarkMode && iconDark ? iconDark : icon
  if (!iconSrc) return null
  return <img src={iconSrc} alt="Switch Network" style={style} />
}

export function TokenLogoWithChain(data: { tokenLogo: string; chainId: ChainId; size: number | string }): JSX.Element
export function TokenLogoWithChain(data: { size: number | string; currency: Currency | WrappedTokenInfo }): JSX.Element
export function TokenLogoWithChain(data: any) {
  const { tokenLogo: tokenLogoParam, chainId: chainParam, size, currency } = data

  const chainId: ChainId = currency?.chainId || chainParam
  const nativeLogo = useGetNativeTokenLogo(chainId)
  const tokenLogo = (currency?.isNative ? nativeLogo : currency?.logoURI) || tokenLogoParam
  const ratio = 0.7
  const networkSize = ratio * parseInt(size + '')

  return (
    <div style={{ position: 'relative', height: size }}>
      <Logo
        srcs={[tokenLogo ?? '']}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
        }}
      />
      <NetworkLogo
        chainId={chainId}
        style={{
          position: 'absolute',
          width: networkSize,
          height: networkSize,
          top: -8 * ratio,
          right: -8 * ratio,
          zIndex: 1,
        }}
      />
    </div>
  )
}
