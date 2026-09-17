import type { Metadata, Viewport } from 'next'
import { Inter, Space_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Toaster } from 'sonner'

import { localeToHtmlLang } from '@/lib/i18n'
import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const _spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-space-mono' })

export const metadata: Metadata = {
  title: 'SuKo Shop - Email Temporario',
  description: 'Acesse sua caixa de entrada temporaria nos dominios SuKo',
}

export const viewport: Viewport = {
  themeColor: '#6b46c1',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'
  const htmlLang = localeToHtmlLang(locale)

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body suppressHydrationWarning className={`${_inter.variable} ${_spaceMono.variable} font-sans antialiased`}>
        {children}
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
