export default function Loading() {
  return (
    <div className="container page-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div className="ornament" />
      <p style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '0.75rem',
        color: 'var(--muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginTop: '1.5rem',
      }}>
        Yüklənir...
      </p>
    </div>
  );
}
