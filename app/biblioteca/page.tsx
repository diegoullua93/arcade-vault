import { Library } from "@/components/library";

export default function BibliotecaPage() {
  return (
    <main className="av-main fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>
      <Library />
    </main>
  );
}
