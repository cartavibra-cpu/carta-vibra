'use client';
import { use } from 'react';
import TopNav from '@/components/TopNav';
import VenueManager from '@/components/VenueManager';

export default function VenuePanelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(700px 500px at 50% -10%, rgba(var(--cv-accent-rgb),.12), transparent 60%), var(--cv-bg)' }}>
      <TopNav />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>
        <a href="/panel" className="cv-mono" style={{ fontSize: 12, color: 'var(--cv-mono-2)', textDecoration: 'none', display: 'inline-block', marginBottom: 18 }}>← Mis locales</a>
        <section className="cv-card" style={{ padding: '22px 24px' }}>
          <VenueManager slug={slug} showHeader />
        </section>
      </div>
    </main>
  );
}
