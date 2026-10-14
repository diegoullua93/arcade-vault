export default function Home() {
  return (
    <main className="av-main">
      <section className="av-hero fade-in">
        <h1 className="flicker">ARCADE VAULT</h1>
        <p className="sub">
          INSERTA UNA MONEDA<span className="blink">_</span>
        </p>
        <div className="detail-actions" style={{ justifyContent: "center", marginTop: 32 }}>
          <button className="btn lg pulse">JUGAR</button>
          <button className="btn lg magenta">SALÓN DE LA FAMA</button>
        </div>
      </section>
    </main>
  );
}
