import { createIntl, createIntlCache } from 'react-intl'
import en from './en.json'

export const defaultLocale = 'en'
export const messages = { en }

const cache = createIntlCache()
export const intl = createIntl({ locale: 'en', messages: en }, cache)
