'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container page-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Xəta baş verdi</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
        Səhifə yüklənərkən problem yarandı.
      </p>
      <button onClick={reset} className="btn btn-primary">
        ◆ Yenidən cəhd et
      </button>
    </div>
  );
}
