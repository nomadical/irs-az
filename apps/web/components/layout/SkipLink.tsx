'use client';

/** Skips to the text on reading pages, to the main region elsewhere */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        const target = document.getElementById('text') ?? document.getElementById('main');
        if (!target) return;
        e.preventDefault();
        target.focus();
        target.scrollIntoView();
      }}
    >
      {label}
    </a>
  );
}
