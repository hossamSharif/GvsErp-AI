/**
 * Company heading shared by the invoice templates: the tenant logo with the
 * company name under it, or the name as the heading when there's no logo or
 * it fails to load (never a broken-image icon on paper).
 */

import { useEffect, useState } from 'react';

interface InvoiceCompanyHeadingProps {
  logoUrl?: string;
  companyName: string;
}

export function InvoiceCompanyHeading({ logoUrl, companyName }: InvoiceCompanyHeadingProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUrl]);

  if (!logoUrl || failed) {
    return (
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{companyName}</h1>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={companyName}
        className="h-14 w-auto max-w-[220px] object-contain mb-3"
        // CORS-enabled fetch so html-to-image can rasterize it into the shared PDF.
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <p className="text-base font-semibold text-slate-900">{companyName}</p>
    </>
  );
}
