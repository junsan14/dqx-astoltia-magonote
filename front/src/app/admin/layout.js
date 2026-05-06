import {NextIntlClientProvider} from "next-intl";
import {getMessages, setRequestLocale} from "next-intl/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthGuard from '@/components/AuthGuard'

export default async function LocaleLayout({children, params}) {
  const {locale} = await params;

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
     
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthGuard>
        <Header />
        {children}
        <Footer />
      
          </AuthGuard>
    </NextIntlClientProvider>
  
  );
}