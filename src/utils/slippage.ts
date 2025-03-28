import { ChainId } from '@kyberswap/ks-sdk-core'

import { DEFAULT_SLIPPAGE, DEFAULT_SLIPPAGE_STABLE_PAIR_SWAP, DEFAULT_SLIPPAGE_TESTNET } from 'constants/index'

export enum SLIPPAGE_STATUS {
  NORMAL,
  LOW,
  HIGH,
}

export const getDefaultSlippage = (chainId: ChainId, isStablePairSwap: boolean): number => {
  if (chainId === ChainId.LINEA_TESTNET) {
    return DEFAULT_SLIPPAGE_TESTNET
  }

  return isStablePairSwap ? DEFAULT_SLIPPAGE_STABLE_PAIR_SWAP : DEFAULT_SLIPPAGE
}

export const checkRangeSlippage = (slippage: number, isStablePairSwap: boolean): SLIPPAGE_STATUS => {
  if (isStablePairSwap) {
    if (slippage >= 100) {
      return SLIPPAGE_STATUS.HIGH
    }

    return SLIPPAGE_STATUS.NORMAL
  }

  if (slippage < 10) {
    return SLIPPAGE_STATUS.LOW
  }

  if (slippage >= 500) {
    return SLIPPAGE_STATUS.HIGH
  }

  return SLIPPAGE_STATUS.NORMAL
}

export const checkWarningSlippage = (slippage: number, isStablePairSwap: boolean) => {
  return checkRangeSlippage(slippage, isStablePairSwap) !== SLIPPAGE_STATUS.NORMAL
}

export const formatSlippage = (slp: number, withPercent = true) => {
  let text
  if (slp % 100 === 0) {
    text = String(slp / 100)
  } else if (slp % 10 === 0) {
    text = (slp / 100).toFixed(1)
  } else {
    text = (slp / 100).toFixed(2)
  }

  if (withPercent) {
    text += '%'
  }

  return text
}
