import { Info, Leaf, ScanQrCode, ShieldCheck } from "lucide-react";
import { PageShell } from "../components/ui";

export default function About() {
  return (
    <PageShell>
      <main className="inner-page about-page">
        <div className="about-hero">
          <div className="eyebrow">ABOUT SEEDSURE</div>
          <h1>Making seed information<br /><em>easier to understand.</em></h1>
          <p>SeedSure brings seed batch information and basic growing guidance into one accessible place. Scan the QR code on a packet and see what has been recorded for that batch.</p>
        </div>
        <div className="about-cards">
          <article><span><ScanQrCode /></span><h3>Accessible lookup</h3><p>Scan with your camera, upload a photo of the code, or type the batch identifier.</p></article>
          <article><span><ShieldCheck /></span><h3>Clear status labels</h3><p>See whether a batch is marked verified, pending, or rejected, and whether it has expired.</p></article>
          <article><span><Leaf /></span><h3>Growing information</h3><p>Review general crop, soil, sowing, and fertilizer notes.</p></article>
        </div>
        <div className="disclaimer"><Info size={18} /><p>SeedSure shows information entered by its administrators. It is not an official government seed certification service. Always confirm important decisions with your local agriculture office.</p></div>
      </main>
    </PageShell>
  );
}
