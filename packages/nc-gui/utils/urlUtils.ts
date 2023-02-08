import isURL from 'validator/lib/isURL'

export const replaceUrlsWithLink = (text: string): boolean | string => {
  if (!text) {
    return false
  }

  const rawText = text.toString()
  let found = false
  const out = rawText.replace(/URI::\((.*?)\)/g, (_, url) => {
    found = true
    const a = document.createElement('a')
    a.textContent = url
    a.setAttribute('href', url)
    a.setAttribute('target', '_blank')
    return a.outerHTML
  })

  return found && out
}

export const isValidURL = (str: string) => {
  return isURL(`${str}`, protocols = ['http', 'https', 'ftp', 'file'])
}

export const openLink = (path: string, baseURL?: string, target = '_blank') => {
  const url = new URL(path, baseURL)
  window.open(url.href, target)
}
