import type { ReactNode } from "react";

// Marco común de las pantallas de acceso: tarjeta con la marca y un subtítulo de estado.
export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="auth-sub">{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Salida estilo terminal para los estados «hecho» (mismo lenguaje que el formulario de contacto).
export function AuthTerminal({
  command,
  lines,
  result,
  children,
}: {
  command: string;
  lines: string[];
  result: string;
  children?: ReactNode;
}) {
  return (
    <div className="terminal-success" role="status">
      <div className="term-bar">
        <span className="dot r"></span>
        <span className="dot y"></span>
        <span className="dot g"></span>
        <span className="term-title">VAULT-OS // AUTH</span>
      </div>
      <div className="term-body">
        <div className="line">
          <span className="prompt">vault@arcade:~$</span> {command}
        </div>
        {lines.map((l) => (
          <div className="line dim" key={l}>
            [OK] {l}
          </div>
        ))}
        <div className="line success">
          &gt; {result}
          <span className="caret">_</span>
        </div>
        {children && <div style={{ marginTop: 18 }}>{children}</div>}
      </div>
    </div>
  );
}
