import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { PRODUCT_NAME } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: {
    default: `${PRODUCT_NAME} · ${t("Development Lifecycle Traceability Platform")}`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: t("Development Lifecycle Traceability Platform"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#14161d" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("poc-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(!t&&d)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased"><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
