import invariant from 'tiny-invariant'

import { PrivateAnnouncementType } from 'components/Announcement/type'

import { ENV_TYPE } from './type'

const required = (envKey: string): string => {
  const key = 'VITE_' + envKey
  const envValue = import.meta.env[key]
  invariant(envValue, `env ${key} is missing`)
  return envValue
}

export const GOOGLE_RECAPTCHA_KEY = required('GOOGLE_RECAPTCHA_KEY')
export const PRICE_API = required('PRICE_API')
export const AGGREGATOR_API = required('AGGREGATOR_API')
export const SENTRY_DNS = required('SENTRY_DNS')
export const REWARD_SERVICE_API = required('REWARD_SERVICE_API')
export const KS_SETTING_API = required('KS_SETTING_API')
export const BLOCK_SERVICE_API = required('BLOCK_SERVICE_API')
export const PRICE_CHART_API = required('PRICE_CHART_API')
export const AGGREGATOR_STATS_API = required('AGGREGATOR_STATS_API')
export const NOTIFICATION_API = required('NOTIFICATION_API')
export const TRANSAK_URL = required('TRANSAK_URL')
export const TRANSAK_API_KEY = required('TRANSAK_API_KEY')
export const TYPE_AND_SWAP_URL = required('TYPE_AND_SWAP_URL')
export const POOL_FARM_BASE_URL = required('POOL_FARM_BASE_URL')
export const MIXPANEL_PROJECT_TOKEN = required('MIXPANEL_PROJECT_TOKEN')
export const CAMPAIGN_BASE_URL = required('CAMPAIGN_BASE_URL')
export const GTM_ID = import.meta.env.VITE_GTM_ID
export const TAG = import.meta.env.VITE_TAG || 'localhost'
export const ENV_LEVEL = !import.meta.env.VITE_TAG
  ? ENV_TYPE.LOCAL
  : import.meta.env.VITE_TAG.startsWith('adpr')
  ? ENV_TYPE.ADPR
  : import.meta.env.VITE_TAG.startsWith('main-stg')
  ? ENV_TYPE.STG
  : import.meta.env.VITE_TAG.startsWith('main')
  ? ENV_TYPE.DEV
  : ENV_TYPE.PROD

export const LIMIT_ORDER_API_READ = required('LIMIT_ORDER_API_READ')
export const LIMIT_ORDER_API_WRITE = required('LIMIT_ORDER_API_WRITE')
export const KYBER_DAO_STATS_API = required('KYBER_DAO_STATS_API')

export const OAUTH_CLIENT_ID = required('OAUTH_CLIENT_ID')
export const BFF_API = required('BFF_API')
export const KYBER_AI_REFERRAL_ID = required('KYBER_AI_REFERRAL_ID')
export const KYBER_AI_TOPIC_ID = required('KYBER_AI_TOPIC_ID')
export const PRICE_ALERT_TOPIC_ID = required('PRICE_ALERT_TOPIC_ID')
export const ELASTIC_POOL_TOPIC_ID = required('ELASTIC_POOL_TOPIC_ID')
export const BUCKET_NAME = required('BUCKET_NAME')
export const WALLETCONNECT_PROJECT_ID = required('WALLETCONNECT_PROJECT_ID')

type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  databaseURL?: string
  appId: string
  measurementId?: string
}

export const FIREBASE: { [key: string]: { DEFAULT: FirebaseConfig; LIMIT_ORDER?: FirebaseConfig } } = {
  development: {
    LIMIT_ORDER: {
      apiKey: 'AIzaSyBHRrinrQ3CXVrevZN442fjG0EZ-nYNNaU',
      authDomain: 'limit-order-dev.firebaseapp.com',
      projectId: 'limit-order-dev',
      storageBucket: 'limit-order-dev.appspot.com',
      messagingSenderId: '522790089501',
      appId: '1:522790089501:web:524403003ae65c09c727f4',
    },
    DEFAULT: {
      apiKey: 'AIzaSyD1UhS2D-a5D6e20SuKgx87FGitbQUL_V8',
      authDomain: 'notification-local-73771.firebaseapp.com',
      projectId: 'notification-local-73771',
      storageBucket: 'notification-local-73771.appspot.com',
      messagingSenderId: '227120017035',
      appId: '1:227120017035:web:36592ab3e81b5614b7ae8e',
      measurementId: 'G-Q3EPQSWMM5',
    },
  },
  staging: {
    LIMIT_ORDER: {
      apiKey: 'AIzaSyDVtU3R0ZWgO4YzKbvjP372E8sgvz1vAqc',
      authDomain: 'staging-339203.firebaseapp.com',
      projectId: 'staging-339203',
      storageBucket: 'staging-339203.appspot.com',
      messagingSenderId: '641432115631',
      appId: '1:641432115631:web:1ae29340e7e34e0c08f75a',
    },
    DEFAULT: {
      apiKey: 'AIzaSyAXTm2d_yT2r_hP-WJk68Aj_aGZOqPYIK8',
      authDomain: 'notification---staging.firebaseapp.com',
      projectId: 'notification---staging',
      storageBucket: 'notification---staging.appspot.com',
      messagingSenderId: '46809442918',
      appId: '1:46809442918:web:b9775a502e72f395541ba7',
    },
  },
  production: {
    DEFAULT: {
      apiKey: 'AIzaSyA1K_JAB8h0NIvjtFLHvZhfkFjW4Bls0bw',
      authDomain: 'notification---production.firebaseapp.com',
      projectId: 'notification---production',
      storageBucket: 'notification---production.appspot.com',
      messagingSenderId: '541963997326',
      appId: '1:541963997326:web:a6cc676067bc65f32679df',
    },
  },
}

const ANNOUNCEMENT_TEMPLATE_IDS: { [key: string]: { [type: string]: string } } = {
  development: {
    [PrivateAnnouncementType.PRICE_ALERT]: '53',
    [PrivateAnnouncementType.LIMIT_ORDER]: '8,9,10,11,33,34,35,36',
    [PrivateAnnouncementType.BRIDGE_ASSET]: '37,38',
    [PrivateAnnouncementType.CROSS_CHAIN]: '48,49',
    [PrivateAnnouncementType.KYBER_AI]: '46',
    [PrivateAnnouncementType.ELASTIC_POOLS]: '39,40',
    EXCLUDE: '2,29,1,47,50,44,45',
  },
  staging: {
    [PrivateAnnouncementType.PRICE_ALERT]: '30',
    [PrivateAnnouncementType.LIMIT_ORDER]: '14,15,16,17',
    [PrivateAnnouncementType.BRIDGE_ASSET]: '12,13',
    [PrivateAnnouncementType.CROSS_CHAIN]: '25,26',
    [PrivateAnnouncementType.KYBER_AI]: '27',
    [PrivateAnnouncementType.ELASTIC_POOLS]: '20,21',
    EXCLUDE: '2,11,1,28,29,22,23',
  },
  production: {
    [PrivateAnnouncementType.PRICE_ALERT]: '29',
    [PrivateAnnouncementType.LIMIT_ORDER]: '12,13,14,15',
    [PrivateAnnouncementType.BRIDGE_ASSET]: '10,11',
    [PrivateAnnouncementType.CROSS_CHAIN]: '27,28',
    [PrivateAnnouncementType.KYBER_AI]: '26',
    [PrivateAnnouncementType.ELASTIC_POOLS]: '17,18',
    EXCLUDE: '2,16,19,9,25,24,21,22',
  },
}

export const ENV_KEY: 'production' | 'staging' | 'development' = import.meta.env.VITE_ENV

export const getAnnouncementsTemplateIds = (type: PrivateAnnouncementType | 'EXCLUDE') => {
  return ANNOUNCEMENT_TEMPLATE_IDS[ENV_KEY]?.[type]
}

const mock = localStorage.getItem('mock')?.split(',') ?? []
export const MOCK_ACCOUNT_EVM = mock[0] ?? ''
export const MOCK_ACCOUNT_SOLANA = mock[1] ?? ''

const isSupportTestNet = ENV_LEVEL < ENV_TYPE.PROD && new URLSearchParams(window.location.search).get('test')
export const CROSS_CHAIN_CONFIG = {
  AXELAR_SCAN_URL: isSupportTestNet ? 'https://testnet.axelarscan.io/gmp/' : 'https://axelarscan.io/gmp/',
  API_DOMAIN: isSupportTestNet ? 'https://testnet.api.0xsquid.com' : 'https://api.0xsquid.com',
  INTEGRATOR_ID: 'kyberswap-api',
}
