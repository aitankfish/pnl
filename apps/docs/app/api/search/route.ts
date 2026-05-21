import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// Default Orama search index built from the MDX source.
export const { GET } = createFromSource(source);
