import Script from "next/script";
import { gaMeasurementId } from "@/lib/site";

/** Loads GA4 only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set. */
export function GoogleAnalytics() {
  const id = gaMeasurementId();
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
