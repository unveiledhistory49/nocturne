'use client';

import dynamic from 'next/dynamic';

const CommandCenter = dynamic(() => import('@/components/CommandCenter').then(m => m.CommandCenter), { ssr: false });

export default function Page() {
  return <CommandCenter />;
}
