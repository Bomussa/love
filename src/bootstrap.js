import api from '../frontend/src/lib/api-unified.js'

if (typeof window !== 'undefined' && window.location.hostname === 'www.mmc-mms.com') {
  window.location.replace(`https://mmc-mms.com${window.location.pathname}${window.location.search}${window.location.hash}`)
}

export default api
