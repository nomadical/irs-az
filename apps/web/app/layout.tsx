import '@/styles/globals.css';
import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
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


export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="az" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
