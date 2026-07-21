import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'NOCTURNE — Campus Network & Ecosystem Analytics',
  description: 'Real-time command-center dashboard for a university campus: live engagement, network health, authentication flows, marketplace velocity.'
};

export const viewport: Viewport = {
  themeColor: '#161B2E',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <a href='#main' className='sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:bg-night-indigo-deep focus:px-3 focus:py-2 focus:text-fiber-cyan'>
          Skip to command center
        </a>
        {children}
      </body>
    </html>
  );
}
