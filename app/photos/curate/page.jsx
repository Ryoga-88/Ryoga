import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { photoCuration, localAccessAllowed } from "app/lib/photo-curation";
import Curator from "./Curator";

export const dynamic = "force-dynamic";
export const metadata = { title: "写真を選ぶ", robots: { index: false, follow: false } };

export default async function CuratePage() {
  if (!localAccessAllowed(await headers(), { navigation: true })) notFound();
  try {
    const data = await photoCuration.clientData();
    return <Curator initialData={data} />;
  } catch {
    return <div className="mx-auto max-w-page px-4 py-14"><h1 className="text-2xl font-bold">写真を取り込んでください</h1><p className="mt-4">ターミナルで <code>npm run photos:import</code> を実行してから、このページを開き直してください。</p></div>;
  }
}
