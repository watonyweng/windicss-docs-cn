import docsearch from '@docsearch/js'
import { useData, useRoute, useRouter } from 'vitepress'
import { getCurrentInstance, onMounted, watch } from 'vue'
import React from 'preact/compat'

import type { DefaultTheme } from '@/config'

export function useSearchBox(props: Readonly<{
  options: DefaultTheme.AlgoliaSearchOptions
  multilang?: boolean
  id?: string
}>) {
  const vm = getCurrentInstance()
  const route = useRoute()
  const router = useRouter()

  const searchId = props.id || 'docsearch'

  watch(
    () => props.options,
    (value) => {
      update(value)
    },
  )

  onMounted(() => {
    initialize(props.options)
  })

  function isSpecialClick(event: MouseEvent) {
    return (
      event.button === 1
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
    )
  }

  function getRelativePath(absoluteUrl: string) {
    const { pathname, hash } = new URL(absoluteUrl)
    return pathname + hash
  }

  function update(options: DefaultTheme.AlgoliaSearchOptions) {
    if (vm && vm.vnode.el) {
      vm.vnode.el.innerHTML
        = `<div class="algolia-search-box" id="${searchId}"></div>`
      initialize(options)
    }
  }

  const { lang } = useData()

  function initialize(userOptions: DefaultTheme.AlgoliaSearchOptions) {
    // if the user has multiple locales, the search results should be filtered
    // based on the language
    const facetFilters = props.multilang ? [`language:${lang.value}`] : []
    docsearch(
      Object.assign({}, userOptions, {
        container: '#docsearch',
        searchParameters: Object.assign({}, userOptions.searchParameters, {
          // pass a custom lang facetFilter to allow multiple language search
          // https://github.com/algolia/docsearch-configs/pull/3942
          facetFilters: facetFilters.concat(
            userOptions.searchParameters?.facetFilters || [],
          ),
        }),
        navigator: {
          navigate: ({ itemUrl }) => {
            const { pathname: hitPathname } = new URL(
              window.location.origin + itemUrl,
            )
            // Router doesn't handle same-page navigation so we use the native
            // browser location API for anchor navigation
            if (route.path === hitPathname)
              window.location.assign(window.location.origin + itemUrl)
            else
              router.go(itemUrl)
          },
        },
        transformItems: (items) => {
          return items.map((item) => {
            return Object.assign({}, item, {
              url: getRelativePath(item.url),
            })
          })
        },
        hitComponent: ({
          hit,
          children,
        }) => {
          const relativeHit = hit.url.startsWith('http')
            ? getRelativePath(hit.url as string)
            : hit.url
          // @ts-ignore
          return React.createElement('a',
            {
              href: hit.url,
              onClick: (event: MouseEvent) => {
                if (isSpecialClick(event))
                  return

                // we rely on the native link scrolling when user is already on
                // the right anchor because Router doesn't support duplicated
                // history entries
                if (route.path === relativeHit)
                  return

                // if the hits goes to another page, we prevent the native link
                // behavior to leverage the Router loading feature
                if (route.path !== relativeHit)
                  event.preventDefault()

                router.go(relativeHit)
              },
            },
            children,
          )
        },
      } as Omit<Parameters<typeof docsearch>[0], 'appId' | 'apiKey' | 'indexName'>),
    )
  }

  return {
    searchId,
    initialize,
    update,
  }
}
