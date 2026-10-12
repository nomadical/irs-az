import '@/styles/globals.css';
import '@/styles/skin-clean.css';
import { Metadata } from "next";
import { ReactNode } from "react";
import { getLocale } from 'next-intl/server';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: 'IRS.AZ — Azərbaycan mədəniyyəti',
    template: '%s | IRS.AZ',
  },
  description: 'Azərbaycan ədəbiyyatı, fəlsəfəsi və mədəniyyəti',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
};


export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var d=document.documentElement;d.setAttribute('data-theme',t);var s=localStorage.getItem('skin');if(s==='clean')d.setAttribute('data-skin',s)}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
