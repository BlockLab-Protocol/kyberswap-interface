import { datadogRum } from '@datadog/browser-rum'
import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'
import { Web3ReactHooks, Web3ReactProvider } from '@web3-react/core'
import { Connector } from '@web3-react/types'
import AOS from 'aos'
import 'aos/dist/aos.css'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import 'inter-ui'
import mixpanel from 'mixpanel-browser'
import { StrictMode, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import TagManager from 'react-gtm-module'
import 'react-loading-skeleton/dist/skeleton.css'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import 'swiper/swiper-bundle.min.css'
import 'swiper/swiper.min.css'

import SolanaWalletContext from 'components/SolanaWalletContext'
import { ENV_LEVEL, GTM_ID, MIXPANEL_PROJECT_TOKEN, SENTRY_DNS, TAG } from 'constants/env'
import { ENV_TYPE } from 'constants/type'
import { connections } from 'constants/wallets'

import SEO from './components/SEO'
import { sentryRequestId } from './constants'
import { LanguageProvider } from './i18n'
import App from './pages/App'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import store from './state'
import ApplicationUpdater from './state/application/updater'
import CustomizeDexesUpdater from './state/customizeDexes/updater'
import ListsUpdater from './state/lists/updater'
import MulticallUpdater from './state/multicall/updater'
import TransactionUpdater from './state/transactions/updater'
import UserUpdater from './state/user/updater'
import ThemeProvider, { FixedGlobalStyle, ThemedGlobalStyle } from './theme'

dayjs.extend(utc)
dayjs.extend(duration)
dayjs.extend(relativeTime)

mixpanel.init(MIXPANEL_PROJECT_TOKEN, {
  debug: ENV_LEVEL < ENV_TYPE.PROD,
})

if (ENV_LEVEL > ENV_TYPE.LOCAL) {
  datadogRum.init({
    applicationId: '5bd0c243-6141-4bab-be21-5dac9b9efa9f',
    clientToken: 'pub9163f29b2cdb31314b89ae232af37d5a',
    site: 'datadoghq.eu',
    service: 'kyberswap-interface',

    version: TAG,
    sampleRate: ENV_LEVEL === ENV_TYPE.PROD ? 10 : 100,
    sessionReplaySampleRate: 100,
    trackInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  })
  datadogRum.startSessionReplayRecording()

  Sentry.init({
    dsn: SENTRY_DNS,
    environment: 'production',
    ignoreErrors: ['AbortError'],
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
  })
  Sentry.configureScope(scope => {
    scope.setTag('request_id', sentryRequestId)
    scope.setTag('version', TAG)
  })

  if (GTM_ID) {
    TagManager.initialize({
      gtmId: GTM_ID,
    })
  }
}

AOS.init()

if (window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
}

function Updaters() {
  return (
    <>
      <ListsUpdater />
      <UserUpdater />
      <ApplicationUpdater />
      <TransactionUpdater />
      <MulticallUpdater />
      <CustomizeDexesUpdater />
    </>
  )
}

const preloadhtml = document.querySelector('.preloadhtml')
const preloadhtmlStyle = document.querySelector('.preloadhtml-style')

const hideLoader = () => {
  setTimeout(() => {
    preloadhtml?.remove()
    preloadhtmlStyle?.remove()
  }, 100)
}

// Google ReCaptcha use it, don't remove.
window.recaptchaOptions = {
  useRecaptchaNet: true,
}

const ReactApp = () => {
  useEffect(hideLoader, [])
  const connectors: [Connector, Web3ReactHooks][] = useMemo(
    () => connections.map(({ hooks, connector }) => [connector, hooks]),
    [],
  )
  const key = useMemo(() => connections.map(connection => connection.name).join('-'), [])

  return (
    <StrictMode>
      <SEO
        title="KyberSwap - Trading Smart"
        description="KyberSwap is DeFi‚Äôs first Dynamic Market Maker; a decentralized exchange protocol that provides frictionless crypto liquidity with extremely high flexibility and capital efficiency. KyberSwap is the first major protocol in Kyber‚Äôs liquidity hub."
      />
      <FixedGlobalStyle />
      <Provider store={store}>
        <SolanaWalletContext>
          <BrowserRouter>
            <LanguageProvider>
              <Web3ReactProvider connectors={connectors} key={key}>
                <Updaters />
                <ThemeProvider>
                  <ThemedGlobalStyle />
                  <App />
                </ThemeProvider>
              </Web3ReactProvider>
            </LanguageProvider>
          </BrowserRouter>
        </SolanaWalletContext>
      </Provider>
    </StrictMode>
  )
}

const container = document.getElementById('app') as HTMLElement
const root = createRoot(container)
root.render(<ReactApp />)

serviceWorkerRegistration.unregister()
//serviceWorkerRegistration.register({
//  onSuccess: () => {
//    //
//  },
//  onUpdate: serviceWorkerRegistration => {
//    store.dispatch(updateServiceWorker(serviceWorkerRegistration))
//  },
//})
