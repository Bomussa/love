if (typeof window !== 'undefined' && window.location.hostname === 'www.mmc-mms.com') {
  window.location.replace(`https://mmc-mms.com${window.location.pathname}${window.location.search}${window.location.hash}`)
}
