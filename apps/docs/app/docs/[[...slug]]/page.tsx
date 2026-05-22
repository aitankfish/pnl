import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Cards, Card } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Callout } from 'fumadocs-ui/components/callout';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import DocsPreface from '../_components/DocsPreface';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;

  // The /docs index renders as a book preface — fully custom editorial
  // layout, no DocsPage / DocsTitle / DocsDescription chrome. Sub-pages
  // continue to render through the MDX path below.
  if (!params.slug || params.slug.length === 0) {
    return <DocsPreface />;
  }

  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={{
            ...defaultMdxComponents,
            // Mintlify-compatible aliases so existing MDX renders without surgery
            Cards,
            Card,
            CardGroup: Cards,
            Steps,
            Step,
            Callout,
            Tabs,
            Tab,
            // Mintlify component aliases (Tip / Note / Warning) → Callout variants
            Tip: (props: any) => <Callout type="info" {...props} />,
            Note: (props: any) => <Callout {...props} />,
            Warning: (props: any) => <Callout type="warn" {...props} />,
            CodeGroup: Tabs,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

// Per-page metadata + OG image.
//
// We can't drop an `opengraph-image.tsx` next to this file because the
// optional catch-all `[[...slug]]` segment triggers a known Next.js
// route-sort crash when paired with a metadata file. Workaround: point
// openGraph.images at /api/og?... with the page title/description as
// query params. The /api/og endpoint renders the shared OG template.
function ogImageUrl(title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set('subtitle', subtitle);
  return `/api/og?${params.toString()}`;
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  // The /docs index has a custom preface — return its hand-curated metadata
  // rather than running through source.getPage (which would NotFound on
  // an empty slug if we ever delete content/docs/index.mdx).
  if (!params.slug || params.slug.length === 0) {
    const title = 'Documentation';
    const description =
      'PNL documentation — manifesto, mechanics, build, transparency. Edition 001 · May 2026.';
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [ogImageUrl(title, description)],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl(title, description)],
      },
    };
  }
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const title: string = page.data.title;
  const description: string | undefined = page.data.description;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImageUrl(title, description)],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl(title, description)],
    },
  };
}
