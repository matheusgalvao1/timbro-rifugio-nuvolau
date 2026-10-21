import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_LANG, dictionaries, type Dictionary, type Lang } from './dictionaries'

const STORE_KEY = 'nuvolau_lang'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Dictionary
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function initialLang(): Lang {
  const saved = localStorage.getItem(STORE_KEY)
  return saved === 'en' || saved === 'it' ? saved : DEFAULT_LANG
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (next: Lang) => {
    localStorage.setItem(STORE_KEY, next)
    setLangState(next)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT(): LanguageContextValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useT used outside LanguageProvider')
  return value
}
