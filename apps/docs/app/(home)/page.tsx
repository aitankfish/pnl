import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function HomePage() {
  return (
    <HomeLayout {...baseOptions}>
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6 text-center">
        <p className="text-sm uppercase tracking-[0.32em] text-fd-muted-foreground mb-4">
          Docs
        </p>
        <h1 className="text-4xl md:text-6xl font-serif font-light mb-6 leading-tight max-w-3xl">
          The launchpad where the crowd decides which ideas deserve to launch.
        </h1>
        <p className="text-lg text-fd-muted-foreground max-w-2xl mb-10">
          Idea tokenization on Solana. Believers and critics stake SOL — winning
          conviction launches the idea as a token. Live on mainnet.
        </p>
        <div className="flex gap-4">
          <Link
            href="/docs"
            className="px-6 py-3 bg-fd-primary text-fd-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Read the docs →
          </Link>
          <Link
            href="https://pnl.market"
            className="px-6 py-3 border border-fd-border hover:border-fd-primary transition-colors"
          >
            Open the app
          </Link>
        </div>
      </main>
    </HomeLayout>
  );
}
